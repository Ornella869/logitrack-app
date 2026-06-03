// Validación de Código Postal Argentino combinando dos fuentes:
//   1. Nominatim (OpenStreetMap)  → resuelve CP → localidad/provincia.
//   2. Georef (datos.gob.ar)      → valida oficialmente que la localidad exista.
// Si la red falla, hace fallback a validar solo el formato (4 dígitos).
// Referencia: G1L-10 ("código postal con formato válido") + UH nueva Sprint 2.

import { normalizeProvincia } from '../utils/provincias'

const AR_POSTAL_FORMAT = /^\d{4}$/

// Cache persistente de geocodificación de direcciones (sobrevive recargas de página).
const GEO_ADDR_CACHE_KEY = 'logitrack_geo_addr_v1'

function buildGeoKey(street: string, city: string, postalCode?: string): string {
  return `${street.trim().toLowerCase()}|${city.trim().toLowerCase()}|${(postalCode ?? '').trim()}`
}

function readGeoCache(): Record<string, { lat: number; lng: number } | null> {
  try {
    const raw = localStorage.getItem(GEO_ADDR_CACHE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, { lat: number; lng: number } | null>) : {}
  } catch {
    return {}
  }
}

function writeGeoCache(key: string, value: { lat: number; lng: number } | null): void {
  try {
    const cache = readGeoCache()
    cache[key] = value
    // Limitar a 200 entradas para no saturar localStorage.
    const entries = Object.entries(cache)
    const trimmed = entries.length > 200
      ? Object.fromEntries(entries.slice(entries.length - 200))
      : cache
    localStorage.setItem(GEO_ADDR_CACHE_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage no disponible (modo incógnito, cuota llena, etc.)
  }
}

export interface PostalCodeValidation {
  valid: boolean
  city?: string
  province?: string
  /** true cuando no se pudo consultar la API y solo se validó el formato local */
  fallback?: boolean
  /** true cuando Nominatim resolvió la localidad pero Georef no la pudo confirmar */
  unverified?: boolean
  error?: string
}

interface NominatimResult {
  display_name: string
  address?: {
    city?: string
    town?: string
    village?: string
    locality?: string
    municipality?: string
    county?: string
    state_district?: string
    state?: string
    province?: string
    country?: string
    country_code?: string
    postcode?: string
  }
}

interface GeorefLocalidad {
  nombre: string
  provincia?: { nombre: string }
}

interface GeorefResponse {
  localidades?: GeorefLocalidad[]
}

const cache = new Map<string, PostalCodeValidation>()

const FETCH_TIMEOUT_MS = 5000

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

interface NominatimLookup {
  city?: string
  province?: string
  /** El CP existe en Argentina aunque OSM no haya devuelto localidad ni provincia. */
  foundInArgentina: boolean
}

async function fetchFromNominatim(cp: string): Promise<NominatimLookup | null> {
  const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(
    cp,
  )}&country=Argentina&format=json&limit=1&addressdetails=1`
  const res = await fetchWithTimeout(url, {
    headers: { 'Accept-Language': 'es' },
  })
  if (!res.ok) return null
  const data = (await res.json()) as NominatimResult[]
  if (!data?.length) return null
  const addr = data[0].address ?? {}

  // Si OSM confirma que está en Argentina, ya sabemos que el CP existe.
  // Lo que no siempre sabe es la localidad: en CPs chicos como 9410 (Ushuaia)
  // el `address` viene solo con `postcode + country`. En 9420 (Paso de Indios,
  // Chubut) viene con `state_district + state` pero sin city. Hacemos fallback
  // hasta donde se pueda y devolvemos el flag para que el caller no rechace.
  const isArgentina = addr.country_code === 'ar' || addr.country === 'Argentina'
  if (!isArgentina) return null

  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.locality ||
    addr.municipality ||
    addr.state_district ||
    addr.county
  const province = addr.state || addr.province

  return { city, province, foundInArgentina: true }
}

async function validateWithGeoref(
  city: string,
  province?: string,
): Promise<{ verified: boolean; normalizedName?: string; province?: string }> {
  const params = new URLSearchParams({
    nombre: city,
    max: '1',
    aplanar: 'true',
    campos: 'nombre,provincia.nombre',
  })
  if (province) params.set('provincia', province)
  const res = await fetchWithTimeout(
    `https://apis.datos.gob.ar/georef/api/localidades?${params.toString()}`,
  )
  if (!res.ok) return { verified: false }
  const data = (await res.json()) as GeorefResponse
  const found = data.localidades?.[0]
  if (!found) return { verified: false }
  return {
    verified: true,
    normalizedName: found.nombre,
    province: found.provincia?.nombre,
  }
}

export interface AddressValidation {
  valid: boolean
  /** true cuando Nominatim no estaba disponible y no se pudo verificar */
  fallback?: boolean
  error?: string
}

export const postalCodeService = {
  isValidFormat(cp: string): boolean {
    return AR_POSTAL_FORMAT.test(cp.trim())
  },

  async validateStreetAddress(street: string, cp: string, province?: string): Promise<AddressValidation> {
    const tryNominatim = async (url: string): Promise<NominatimResult[] | null> => {
      try {
        const res = await fetchWithTimeout(url, { headers: { 'Accept-Language': 'es' } })
        if (!res.ok) return null
        const data = (await res.json()) as NominatimResult[]
        return data?.length ? data : null
      } catch {
        return null
      }
    }

    // 1) Búsqueda estructurada: calle + CP + provincia
    let params = `street=${encodeURIComponent(street)}&postalcode=${encodeURIComponent(cp)}&country=Argentina&format=json&limit=1&addressdetails=1`
    if (province) params += `&state=${encodeURIComponent(province)}`
    let results = await tryNominatim(`https://nominatim.openstreetmap.org/search?${params}`)

    // 2) Si no encontró, intenta free-text (Nominatim interpola mejor con texto libre)
    if (!results) {
      const query = province
        ? `${street}, ${province}, Argentina`
        : `${street}, Argentina`
      results = await tryNominatim(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&countrycodes=ar&format=json&limit=1&addressdetails=1`,
      )
    }

    // Si ninguna búsqueda encontró nada, el service no está disponible o la
    // dirección no existe en OSM — dejamos pasar con fallback para no bloquear.
    if (!results) return { valid: true, fallback: true }

    const addr = results[0].address
    if (province && addr) {
      const foundProvince = addr.state || addr.province || ''
      const normalizedFound = normalizeProvincia(foundProvince)
      const normalizedExpected = normalizeProvincia(province)
      if (normalizedFound && normalizedExpected && normalizedFound !== normalizedExpected) {
        return {
          valid: false,
          error: `La calle pertenece a ${normalizedFound}, no a ${normalizedExpected}.`,
        }
      }
    }
    return { valid: true }
  },

  async geocodeAddress(
    street: string,
    city: string,
    postalCode?: string,
  ): Promise<{ lat: number; lng: number } | null> {
    const cacheKey = buildGeoKey(street, city, postalCode)
    const cached = readGeoCache()
    if (Object.prototype.hasOwnProperty.call(cached, cacheKey)) return cached[cacheKey]

    const tryQuery = async (params: Record<string, string>): Promise<{ lat: number; lng: number } | null> => {
      try {
        const qs = new URLSearchParams({ ...params, countrycodes: 'ar', format: 'json', limit: '1' }).toString()
        const res = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${qs}`, {
          headers: { 'Accept-Language': 'es' },
        })
        if (!res.ok) return null
        const data = (await res.json()) as Array<{ lat: string; lon: string }>
        const first = data[0]
        if (!first) return null
        const lat = parseFloat(first.lat)
        const lng = parseFloat(first.lon)
        return Number.isNaN(lat) || Number.isNaN(lng) ? null : { lat, lng }
      } catch {
        return null
      }
    }
    let result: { lat: number; lng: number } | null = null
    if (postalCode) {
      result = await tryQuery({ street, city, postalcode: postalCode })
    }
    if (!result) result = await tryQuery({ street, city })

    // Solo cachear resultados positivos; los null pueden ser fallas transitorias de red.
    if (result) writeGeoCache(cacheKey, result)
    return result
  },

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
      const res = await fetchWithTimeout(url, { headers: { 'Accept-Language': 'es' } })
      if (!res.ok) return null
      const data = (await res.json()) as { address?: { state?: string } }
      return data.address?.state?.trim() ?? null
    } catch {
      return null
    }
  },

  async validate(cp: string): Promise<PostalCodeValidation> {
    const trimmed = cp.trim()

    if (!this.isValidFormat(trimmed)) {
      return { valid: false, error: 'El CP debe tener 4 dígitos' }
    }

    const cached = cache.get(trimmed)
    if (cached) return cached

    let nominatimResult: NominatimLookup | null = null
    try {
      nominatimResult = await fetchFromNominatim(trimmed)
    } catch {
      // Sin red: aceptamos el CP por formato. No es ideal pero no bloquea al operador.
      return { valid: true, fallback: true }
    }

    if (!nominatimResult) {
      const result: PostalCodeValidation = {
        valid: false,
        error: 'No se encontró ninguna localidad con ese CP',
      }
      cache.set(trimmed, result)
      return result
    }

    // Si Nominatim confirmó que el CP existe en Argentina pero no nos dio
    // localidad, lo aceptamos sin verificar contra Georef (no tendríamos qué
    // pasarle). El operador puede ingresar la localidad a mano. Cubre CPs como
    // 9410 (Ushuaia) y 9420 (Río Grande / Paso de Indios) que OSM no mapea.
    if (!nominatimResult.city) {
      const result: PostalCodeValidation = {
        valid: true,
        province: nominatimResult.province,
        unverified: true,
      }
      cache.set(trimmed, result)
      return result
    }

    let verified = false
    let normalizedName = nominatimResult.city
    let provinceName = nominatimResult.province
    try {
      const georefResult = await validateWithGeoref(
        nominatimResult.city,
        nominatimResult.province,
      )
      verified = georefResult.verified
      if (georefResult.verified) {
        normalizedName = georefResult.normalizedName ?? normalizedName
        provinceName = georefResult.province ?? provinceName
      }
    } catch {
      // Si Georef cae no rechazamos: ya tenemos data de Nominatim.
    }

    const result: PostalCodeValidation = {
      valid: true,
      city: normalizedName,
      province: provinceName,
      unverified: !verified,
    }
    cache.set(trimmed, result)
    return result
  },
}
