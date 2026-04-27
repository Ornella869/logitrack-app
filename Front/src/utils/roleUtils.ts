import type { UserRole } from '../types'

// Compatibilidad con sesiones/API antiguas: se normaliza transportista -> repartidor.
const REPARTIDOR_ALIASES = new Set(['repartidor', 'transportista'])

const KNOWN_ROLES = new Set<UserRole>(['administrador', 'supervisor', 'operador', 'repartidor'])

export const normalizeUserRole = (rawRole: unknown): UserRole => {
  const role = String(rawRole ?? '').trim().toLowerCase()

  if (REPARTIDOR_ALIASES.has(role)) {
    return 'repartidor'
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
