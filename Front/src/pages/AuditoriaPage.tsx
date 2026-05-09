import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material'
import type { PagedResult } from '../types'
import HistoryIcon from '@mui/icons-material/History'
import RefreshIcon from '@mui/icons-material/Refresh'
import api from '../services/api'
import type { User } from '../types'

type LogAuditoria = {
  id: string
  timestamp: string
  usuarioId: string | null
  usuarioNombre: string
  usuarioRol: string
  accion: string
  recursoId: string | null
  descripcion: string
  contexto: string | null
}

const ACCIONES = [
  'Todas',
  'CreacionEnvio',
  'EdicionEnvio',
  'CambioEstadoEnvio',
  'CancelacionEnvio',
  'Calendarizacion',
  'Recalendarizacion',
  'CreacionUsuario',
  'DesactivacionUsuario',
  'CambioRol',
  'LoginFallido',
  'Otro',
] as const

const ACCION_COLORS: Record<string, { bg: string; color: string }> = {
  Calendarizacion: { bg: '#e3f2fd', color: '#0d47a1' },
  Recalendarizacion: { bg: '#fff3e0', color: '#ed6c02' },
  CreacionEnvio: { bg: '#e8f5e9', color: '#2e7d32' },
  CambioEstadoEnvio: { bg: '#f3e5f5', color: '#6a1b9a' },
  CancelacionEnvio: { bg: '#ffebee', color: '#c62828' },
  EdicionEnvio: { bg: '#fff8e1', color: '#7b5e00' },
  CreacionUsuario: { bg: '#e1f5fe', color: '#0277bd' },
  DesactivacionUsuario: { bg: '#ffebee', color: '#c62828' },
  CambioRol: { bg: '#f3e5f5', color: '#6a1b9a' },
  LoginFallido: { bg: '#ffebee', color: '#c62828' },
  Otro: { bg: '#f5f5f5', color: '#555' },
}

const ROL_COLORS: Record<string, string> = {
  Supervisor: '#ed6c02',
  Operador: '#0288d1',
  Administrador: '#7b1fa2',
  Repartidor: '#2e7d32',
}

export default function AuditoriaPage() {
  const user = useOutletContext<User>()
  const [logs, setLogs] = useState<LogAuditoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [accion, setAccion] = useState<string>('Todas')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  const isAdmin = user.role === 'administrador'

  useEffect(() => {
    if (!isAdmin) return
    void load(page, pageSize)
  }, [isAdmin, page, pageSize])

  const load = async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    setError('')
    try {
      const params: any = {}
      if (search.trim()) params.search = search.trim()
      if (accion && accion !== 'Todas') params.accion = accion
      if (from) params.from = from
      if (to) params.to = to
      params.page = nextPage
      params.pageSize = nextPageSize
      const response = await api.get<PagedResult<LogAuditoria>>('/auditoria', { params })
      setLogs(response.data?.items ?? [])
      setTotalItems(response.data?.totalItems ?? 0)
    } catch {
      setError('No se pudieron cargar los registros de auditoría')
    } finally {
      setLoading(false)
    }
  }

  const limpiar = () => {
    setSearch('')
    setAccion('Todas')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const buscar = () => {
    setPage(1)
    void load(1, pageSize)
  }

  const handlePageChange = (_event: unknown, nextPage: number) => {
    setPage(nextPage + 1)
  }

  const handleRowsPerPageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPageSize(Number(event.target.value))
    setPage(1)
  }

  const grouped = useMemo(() => {
    return logs.reduce<Record<string, LogAuditoria[]>>((acc, log) => {
      const date = new Date(log.timestamp).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
      if (!acc[date]) acc[date] = []
      acc[date].push(log)
      return acc
    }, {})
  }, [logs])

  if (!isAdmin) {
    return <Alert severity="warning">El log de auditoría es exclusivo del Administrador.</Alert>
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            <HistoryIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Auditoría
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Trazabilidad completa de acciones — registro inmutable.
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}>
          Actualizar
        </Button>
      </Stack>

      <Alert severity="info" sx={{ mb: 3 }}>
        Cada calendarización, cambio de estado, asignación o cancelación queda registrada con timestamp, usuario, rol y contexto. El log es inmutable.
      </Alert>

      {/* Filtros */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
            <TextField
              size="small"
              placeholder="Buscar por usuario, recurso o descripción..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, minWidth: 220 }}
            />
            <TextField
              size="small"
              select
              label="Acción"
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              {ACCIONES.map((a) => (
                <MenuItem key={a} value={a}>{a}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" type="date" label="Desde" InputLabelProps={{ shrink: true }}
              value={from} onChange={(e) => setFrom(e.target.value)}
            />
            <TextField
              size="small" type="date" label="Hasta" InputLabelProps={{ shrink: true }}
              value={to} onChange={(e) => setTo(e.target.value)}
            />
            <Button variant="contained" onClick={buscar}>Buscar</Button>
            <Button onClick={limpiar}>Limpiar</Button>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}><CircularProgress /></Box>
      ) : logs.length === 0 ? (
        <Alert severity="info">No hay registros con esos filtros.</Alert>
      ) : (
        <Card variant="outlined">
          <CardContent>
            {Object.entries(grouped).map(([date, items]) => (
              <Box key={date} sx={{ mb: 2 }}>
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 700 }}>
                  {date}
                </Typography>
                <Stack spacing={0}>
                  {items.map((log) => {
                    const accionColor = ACCION_COLORS[log.accion] ?? ACCION_COLORS.Otro
                    const rolColor = ROL_COLORS[log.usuarioRol] ?? '#777'
                    const time = new Date(log.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    return (
                      <Stack
                        key={log.id}
                        direction="row"
                        spacing={2}
                        sx={{
                          py: 1.2, borderBottom: '1px solid #eee',
                          '&:last-child': { borderBottom: 'none' },
                          alignItems: 'flex-start',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', width: 80, flexShrink: 0, color: 'text.secondary', pt: 0.3 }}>
                          {time}
                        </Typography>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="body2" fontWeight={600}>{log.usuarioNombre}</Typography>
                            <Chip size="small" label={log.usuarioRol} sx={{ bgcolor: `${rolColor}22`, color: rolColor, fontSize: 10, height: 18 }} />
                            <Chip size="small" label={log.accion} sx={{ bgcolor: accionColor.bg, color: accionColor.color, fontSize: 10, height: 18 }} />
                            {log.recursoId && (
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1976d2' }}>
                                {log.recursoId}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="body2" sx={{ mt: 0.3 }}>{log.descripcion}</Typography>
                          {log.contexto && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                              {log.contexto}
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    )
                  })}
                </Stack>
              </Box>
            ))}
          </CardContent>
          <TablePagination
            component="div"
            count={totalItems}
            page={page - 1}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Registros por página"
          />
        </Card>
      )}
    </Box>
  )
}
