import type { UserRole } from '../types'

export type NotifType = 'calendarizacion' | 'ruta-asignada' | 'incidencia' | 'mensaje' | 'otro'

export interface AppNotification {
  id: string
  type: NotifType
  title: string
  message: string
  /** userId específico O nombre de rol ('supervisor', 'repartidor', etc.) para broadcast */
  recipientId: string
  /** Cuando está presente en un broadcast de rol, limita la visibilidad a esa sucursal */
  sucursalId?: string
  createdAt: string
  navigateTo?: string
}

const NOTIF_KEY = 'logitrack_notifications'
const READ_KEY = (userId: string) => `logitrack_notif_read_${userId}`
const MAX_STORED = 200

function loadAll(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '[]') as AppNotification[]
  } catch {
    return []
  }
}

function saveAll(items: AppNotification[]): void {
  const trimmed = items.length > MAX_STORED ? items.slice(items.length - MAX_STORED) : items
  localStorage.setItem(NOTIF_KEY, JSON.stringify(trimmed))
}

function loadReadIds(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(READ_KEY(userId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveReadIds(userId: string, ids: Set<string>): void {
  localStorage.setItem(READ_KEY(userId), JSON.stringify([...ids]))
}

function dispatch(): void {
  window.dispatchEvent(new Event('logitrack:notification'))
}

function sameId(a?: string | null, b?: string | null): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()
}

export const notificationService = {
  /** Devuelve todas las notificaciones del sistema (para auditoría) */
  getAllForAudit(): AppNotification[] {
    return loadAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  /** Devuelve todas las notificaciones dirigidas a este usuario (por id o por rol).
   *  sucursalId: cuando se provee, los broadcasts de rol con sucursalId solo se muestran si coinciden. */
  getForUser(userId: string, role: UserRole, sucursalId?: string): AppNotification[] {
    return loadAll()
      .filter((n) => {
        if (sameId(n.recipientId, userId)) return true
        if (n.recipientId.toLowerCase() === role.toLowerCase()) {
          // Sin sucursalId en la notificación → broadcast global (compatible con datos viejos)
          if (!n.sucursalId) return true
          return sameId(n.sucursalId, sucursalId)
        }
        return false
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  getUnreadCount(userId: string, role: UserRole, sucursalId?: string): number {
    const notifs = notificationService.getForUser(userId, role, sucursalId)
    const readIds = loadReadIds(userId)
    return notifs.filter((n) => !readIds.has(n.id)).length
  },

  isRead(userId: string, notifId: string): boolean {
    return loadReadIds(userId).has(notifId)
  },

  add(notif: Omit<AppNotification, 'id' | 'createdAt'>): AppNotification {
    const all = loadAll()
    const newNotif: AppNotification = {
      ...notif,
      id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    }
    all.push(newNotif)
    saveAll(all)
    dispatch()
    return newNotif
  },

  markRead(userId: string, notifId: string): void {
    const ids = loadReadIds(userId)
    ids.add(notifId)
    saveReadIds(userId, ids)
    dispatch()
  },

  markAllRead(userId: string, role: UserRole, sucursalId?: string): void {
    const notifs = notificationService.getForUser(userId, role, sucursalId)
    const ids = loadReadIds(userId)
    notifs.forEach((n) => ids.add(n.id))
    saveReadIds(userId, ids)
    dispatch()
  },
}
