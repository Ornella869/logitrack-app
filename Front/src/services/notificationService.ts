import type { UserRole } from '../types'

export type NotifType = 'calendarizacion' | 'ruta-asignada' | 'incidencia' | 'mensaje' | 'otro'

export interface AppNotification {
  id: string
  type: NotifType
  title: string
  message: string
  /** userId específico O nombre de rol ('supervisor', 'repartidor', etc.) para broadcast */
  recipientId: string
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

export const notificationService = {
  /** Devuelve todas las notificaciones dirigidas a este usuario (por id o por rol) */
  getForUser(userId: string, role: UserRole): AppNotification[] {
    return loadAll()
      .filter((n) => n.recipientId === userId || n.recipientId === role)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  },

  getUnreadCount(userId: string, role: UserRole): number {
    const notifs = notificationService.getForUser(userId, role)
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

  markAllRead(userId: string, role: UserRole): void {
    const notifs = notificationService.getForUser(userId, role)
    const ids = loadReadIds(userId)
    notifs.forEach((n) => ids.add(n.id))
    saveReadIds(userId, ids)
    dispatch()
  },
}
