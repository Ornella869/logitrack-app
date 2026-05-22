import type { UserRole } from '../types'

// Compatibilidad con sesiones/API antiguas: se normaliza transportista -> repartidor.
const REPARTIDOR_ALIASES = new Set(['repartidor', 'transportista'])
// Portal de cliente: el backend devuelve "UsuarioPortal" → se normaliza a 'cliente'.
const CLIENTE_PORTAL_ALIASES = new Set(['usuarioportal', 'clienteportal', 'cliente'])

const KNOWN_ROLES = new Set<UserRole>(['administrador', 'supervisor', 'operador', 'repartidor', 'gerente', 'cliente'])

export const normalizeUserRole = (rawRole: unknown): UserRole => {
  const role = String(rawRole ?? '').trim().toLowerCase()

  if (REPARTIDOR_ALIASES.has(role)) {
    return 'repartidor'
  }

  if (CLIENTE_PORTAL_ALIASES.has(role)) {
    return 'cliente'
  }

  if (KNOWN_ROLES.has(role as UserRole)) {
    return role as UserRole
  }

  return 'operador'
}

export const isRepartidorRole = (rawRole: unknown): boolean => {
  const role = String(rawRole ?? '').trim().toLowerCase()
  return REPARTIDOR_ALIASES.has(role)
}
