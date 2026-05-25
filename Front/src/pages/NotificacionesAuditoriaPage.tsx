import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import NotificationsIcon from '@mui/icons-material/Notifications'
import { notificationService, type AppNotification } from '../services/notificationService'
import type { User } from '../types'
import { formatInstantArgentina } from '../utils/argentinaDate'

const ROLES = ['todos', 'supervisor', 'repartidor', 'operador', 'administrador', 'gerente', 'cliente']

const TYPE_LABELS: Record<string, string> = {
  calendarizacion: 'Calendarización',
  'ruta-asignada': 'Ruta asignada',
  incidencia: 'Incidencia',
  mensaje: 'Mensaje',
  otro: 'Otro',
}

const TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  calendarizacion: { bg: '#e3f2fd', color: '#0d47a1' },
  'ruta-asignada': { bg: '#e8f5e9', color: '#1b5e20' },
  incidencia: { bg: '#fff3e0', color: '#bf360c' },
  mensaje: { bg: '#f3e5f5', color: '#4a148c' },
  otro: { bg: '#f5f5f5', color: '#37474f' },
}

// UH admin auditoría de notificaciones: muestra log con fecha, hora, tipo, rol destinatario.
export default function NotificacionesAuditoriaPage() {
  const user = useOutletContext<User>()
  const [notifs, setNotifs] = useState<AppNotification[]>([])
  const [rolFiltro, setRolFiltro] = useState('todos')

  useEffect(() => {
    setNotifs(notificationService.getAllForAudit())
    const handler = () => setNotifs(notificationService.getAllForAudit())
    window.addEventListener('logitrack:notification', handler)
    window.addEventListener('storage', (e: StorageEvent) => {
      if (e.key === 'logitrack_notifications') handler()
    })
    return () => window.removeEventListener('logitrack:notification', handler)
  }, [])

  if (user.role !== 'administrador') {
    return <Alert severity="warning">Solo el Administrador puede ver la auditoría de notificaciones.</Alert>
  }

  const notifsFiltradas = rolFiltro === 'todos'
    ? notifs
    : notifs.filter((n) => n.recipientId === rolFiltro || n.recipientId.toLowerCase().includes(rolFiltro))

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <NotificationsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Auditoría de Notificaciones
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Log de todas las notificaciones generadas en el sistema, con fecha, hora, tipo y rol destinatario.
          </Typography>
        </Box>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filtrar por rol</InputLabel>
          <Select
            value={rolFiltro}
            label="Filtrar por rol"
            onChange={(e) => setRolFiltro(e.target.value)}
          >
            {ROLES.map((r) => (
              <MenuItem key={r} value={r}>
                {r === 'todos' ? 'Todos los roles' : r.charAt(0).toUpperCase() + r.slice(1)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {notifsFiltradas.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          No hay notificaciones registradas{rolFiltro !== 'todos' ? ` para el rol "${rolFiltro}"` : ''}.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha y hora</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Rol destinatario</TableCell>
                <TableCell>Título</TableCell>
                <TableCell>Mensaje</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {notifsFiltradas.map((n) => {
                const typeStyle = TYPE_COLORS[n.type] ?? TYPE_COLORS.otro!
                return (
                  <TableRow key={n.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12, fontFamily: 'monospace' }}>
                      {formatInstantArgentina(n.createdAt, {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={TYPE_LABELS[n.type] ?? n.type}
                        sx={{ bgcolor: typeStyle.bg, color: typeStyle.color, fontWeight: 600, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={n.recipientId}
                        variant="outlined"
                        sx={{ fontSize: 11, fontFamily: 'monospace' }}
                      />
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {n.title}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                      {n.message}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
        {notifsFiltradas.length} de {notifs.length} notificaciones mostradas · máx. 200 almacenadas
      </Typography>
    </Box>
  )
}
