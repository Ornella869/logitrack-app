export interface MensajeIncidencia {
  id: string
  incidenciaId: string
  de: string
  deNombre: string
  deRol: 'repartidor' | 'supervisor'
  texto: string
  fecha: string
  leido: boolean
}

const STORAGE_KEY = 'logitrack_mensajes_incidencia'

function loadAll(): MensajeIncidencia[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as MensajeIncidencia[]
  } catch {
    return []
  }
}

function saveAll(items: MensajeIncidencia[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  window.dispatchEvent(new Event('logitrack:mensajes_incidencia'))
}

export const mensajeIncidenciaService = {
  getByIncidencia(incidenciaId: string): MensajeIncidencia[] {
    return loadAll()
      .filter((m) => m.incidenciaId === incidenciaId)
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
  },

  countUnreadForRepartidor(repartidorId: string): number {
    return loadAll().filter(
      (m) => m.deRol === 'supervisor' && !m.leido &&
        // mensajes dirigidos a este repartidor: filtramos por incidencias del repartidor
        // El campo 'de' no tiene recipientId, así que usamos una convención:
        // guardamos el recipientId en el id del mensaje como sufijo
        m.id.includes(`_r${repartidorId}_`),
    ).length
  },

  countUnreadForSupervisorInIncidencia(incidenciaId: string): number {
    return loadAll().filter(
      (m) => m.incidenciaId === incidenciaId && m.deRol === 'repartidor' && !m.leido,
    ).length
  },

  send(msg: Omit<MensajeIncidencia, 'id' | 'fecha' | 'leido'>, recipientId: string): MensajeIncidencia {
    const all = loadAll()
    const nuevo: MensajeIncidencia = {
      ...msg,
      id: `msg_${Date.now()}_r${recipientId}_${Math.random().toString(36).slice(2, 5)}`,
      fecha: new Date().toISOString(),
      leido: false,
    }
    all.push(nuevo)
    saveAll(all)
    return nuevo
  },

  markReadByRole(incidenciaId: string, readerRole: 'repartidor' | 'supervisor'): void {
    const all = loadAll()
    const senderRole = readerRole === 'repartidor' ? 'supervisor' : 'repartidor'
    let changed = false
    all.forEach((m) => {
      if (m.incidenciaId === incidenciaId && m.deRol === senderRole && !m.leido) {
        m.leido = true
        changed = true
      }
    })
    if (changed) saveAll(all)
  },

  countUnreadFromSupervisorForRepartidor(repartidorIncidenciaIds: string[]): number {
    if (!repartidorIncidenciaIds.length) return 0
    return loadAll().filter(
      (m) => repartidorIncidenciaIds.includes(m.incidenciaId) && m.deRol === 'supervisor' && !m.leido,
    ).length
  },
}
