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
import type { Branch, PagedResult } from '../types'
import HistoryIcon from '@mui/icons-material/History'
import RefreshIcon from '@mui/icons-material/Refresh'
import api from '../services/api'
import type { User } from '../types'
import { branchService } from '../services/branchService'
import { formatInstantArgentinaDate, formatInstantArgentinaTime } from '../utils/argentinaDate'

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
  'ActivacionUsuario',
  'DesactivacionUsuario',
  'CambioRol',
  'LoginFallido',
  'ConsentimientoOjoPatron',
  'PruebaOjoDelPatron',
  'Notificacion',
  'JornadaLaboral',
  'Otro',
] as const

const SUPERVISOR_ACCIONES = [
  'Todas',
  'CreacionEnvio',
  'EdicionEnvio',
  'CambioEstadoEnvio',
  'CancelacionEnvio',
  'Calendarizacion',
  'Recalendarizacion',
  'ConsentimientoOjoPatron',
  'PruebaOjoDelPatron',
  'Notificacion',
  'JornadaLaboral',
  'Otro',
] as const

const ACCION_LABELS: Record<string, string> = {
  Todas: 'Todas',
  CreacionEnvio: 'Creación de Envío',
  EdicionEnvio: 'Edición de Envío',
  CambioEstadoEnvio: 'Cambio de Estado',
  CancelacionEnvio: 'Cancelación de Envío',
  Calendarizacion: 'Calendarización',
  Recalendarizacion: 'Recalendarización',
  CreacionUsuario: 'Creación de Usuario',
  ActivacionUsuario: 'Activación de Usuario',
  DesactivacionUsuario: 'Desactivación de Usuario',
  CambioRol: 'Cambio de Rol',
  LoginFallido: 'Login Fallido',
  ConsentimientoOjoPatron: 'Consentimiento Ojo del Patrón',
  PruebaOjoDelPatron: 'Prueba Ojo del Patrón',
  Notificacion: 'Notificacion',
  JornadaLaboral: 'Jornada laboral',
  Otro: 'Otro',
}

const ACCION_COLORS: Record<string, { bg: string; color: string }> = {
  Calendarizacion: { bg: '#e3f2fd', color: '#0d47a1' },
  Recalendarizacion: { bg: '#fff3e0', color: '#ed6c02' },
  CreacionEnvio: { bg: '#e8f5e9', color: '#2e7d32' },
  CambioEstadoEnvio: { bg: '#f3e5f5', color: '#6a1b9a' },
  CancelacionEnvio: { bg: '#ffebee', color: '#c62828' },
  EdicionEnvio: { bg: '#fff8e1', color: '#7b5e00' },
  CreacionUsuario: { bg: '#e1f5fe', color: '#0277bd' },
  ActivacionUsuario: { bg: '#e8f5e9', color: '#2e7d32' },
  DesactivacionUsuario: { bg: '#ffebee', color: '#c62828' },
  CambioRol: { bg: '#f3e5f5', color: '#6a1b9a' },
  LoginFallido: { bg: '#ffebee', color: '#c62828' },
  ConsentimientoOjoPatron: { bg: '#ede7f6', color: '#4527a0' },
  PruebaOjoDelPatron: { bg: '#e0f2f1', color: '#00695c' },
  Notificacion: { bg: '#e3f2fd', color: '#1565c0' },
  JornadaLaboral: { bg: '#fff3e0', color: '#e65100' },
  Otro: { bg: '#f5f5f5', color: '#555' },
}

const ROLES = ['Todos', 'Supervisor', 'Operador', 'Repartidor', 'Gerente', 'Administrador'] as const

function parsePruebaContexto(contexto: string | null): Record<string, string> | null {
  if (!contexto) return null
  try {
    const obj = JSON.parse(contexto) as Record<string, unknown>
    if (typeof obj === 'object') return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, String(v)]))
  } catch { /* plain string — not JSON */ }
  return null
}

const ROL_COLORS: Record<string, string> = {
  Supervisor: '#ed6c02',
  Operador: '#0288d1',
  Gerente: '#6d4c41',
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
  const [rol, setRol] = useState<string>('Todos')
  const [sucursalId, setSucursalId] = useState<string>('Todas')
  const [branches, setBranches] = useState<Branch[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalItems, setTotalItems] = useState(0)

  const canAccess = user.role === 'administrador' || user.role === 'supervisor'
  const isAdmin = user.role === 'administrador'
  const accionesDisponibles = isAdmin ? ACCIONES : SUPERVISOR_ACCIONES

  useEffect(() => {
    if (!canAccess) return
    void load(page, pageSize)
  }, [canAccess, page, pageSize])

  useEffect(() => {
    if (!isAdmin) return
    void branchService.getAllBranches().then(setBranches)
  }, [isAdmin])

  const load = async (nextPage = page, nextPageSize = pageSize) => {
    setLoading(true)
    setError('')
    try {
      const params: any = {}
      if (search.trim()) params.search = search.trim()
      if (accion && accion !== 'Todas') params.accion = accion
      if (isAdmin && rol && rol !== 'Todos') params.rol = rol
      if (isAdmin && sucursalId && sucursalId !== 'Todas') params.sucursalId = sucursalId
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
      setRol('Todos')
      setSucursalId('Todas')
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
      const date = formatInstantArgentinaDate(log.timestamp, { day: '2-digit', month: 'long', year: 'numeric' })
      if (!acc[date]) acc[date] = []
      acc[date].push(log)
      return acc
    }, {})
  }, [logs])

  if (!canAccess) {
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
        {isAdmin
          ? 'Cada acción relevante del sistema queda registrada con timestamp, usuario, rol y contexto. El log es inmutable.'
          : 'Estás viendo únicamente registros operativos asociados a tu sucursal. El log es inmutable.'}
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
              {accionesDisponibles.map((a) => (
                <MenuItem key={a} value={a}>{ACCION_LABELS[a] ?? a}</MenuItem>
              ))}
            </TextField>
            {isAdmin && (
              <TextField
                size="small"
                select
                label="Rol"
                value={rol}
                onChange={(e) => setRol(e.target.value)}
                sx={{ minWidth: 170 }}
              >
                {ROLES.map((r) => (
                  <MenuItem key={r} value={r}>{r}</MenuItem>
                ))}
              </TextField>
            )}
            {isAdmin && (
              <TextField
                size="small"
                select
                label="Sucursal"
                value={sucursalId}
                onChange={(e) => setSucursalId(e.target.value)}
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="Todas">Todas las sucursales</MenuItem>
                {branches.map((b) => (
                  <MenuItem key={b.id} value={b.id}>{b.name}</MenuItem>
                ))}
              </TextField>
            )}
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
                    const time = formatInstantArgentinaTime(log.timestamp, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
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
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', width: 92, flexShrink: 0, color: 'text.secondary', pt: 0.3, whiteSpace: 'nowrap' }}>
                          {time}
                        </Typography>
                        <Box sx={{ flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="body2" fontWeight={600}>{log.usuarioNombre}</Typography>
                            <Chip size="small" label={log.usuarioRol} sx={{ bgcolor: `${rolColor}22`, color: rolColor, fontSize: 10, height: 18 }} />
                            <Chip size="small" label={ACCION_LABELS[log.accion] ?? log.accion} sx={{ bgcolor: accionColor.bg, color: accionColor.color, fontSize: 10, height: 18 }} />
                            {log.recursoId && log.accion !== 'JornadaLaboral' && (
                              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#1976d2' }}>
                                {log.recursoId}
                              </Typography>
                            )}
                          </Stack>
                          <Typography variant="body2" sx={{ mt: 0.3 }}>{log.descripcion}</Typography>
                          {log.contexto && (() => {
                            if (log.accion === 'PruebaOjoDelPatron') {
                              const parsed = parsePruebaContexto(log.contexto)
                              if (parsed) {
                                const fields = [
                                  parsed.AlertnessScore && `Activación vocal: ${(parseFloat(parsed.AlertnessScore) * 100).toFixed(0)}%`,
                                  parsed.ScoreNeu && `Neu: ${(parseFloat(parsed.ScoreNeu) * 100).toFixed(0)}%`,
                                  parsed.ScoreHap && `Ale: ${(parseFloat(parsed.ScoreHap) * 100).toFixed(0)}%`,
                                  parsed.ScoreSad && `Tri: ${(parseFloat(parsed.ScoreSad) * 100).toFixed(0)}%`,
                                  parsed.ScoreAng && `Eno: ${(parseFloat(parsed.ScoreAng) * 100).toFixed(0)}%`,
                                  parsed.Resultado && `Resultado: ${parsed.Resultado === '0' ? 'Aprobada' : 'Rechazada'}`,
                                  parsed.Intentos && `Intentos: ${parsed.Intentos}`,
                                ].filter(Boolean).join(' · ')
                                return (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3, fontFamily: 'monospace' }}>
                                    {fields || log.contexto}
                                  </Typography>
                                )
                              }
                            }
                            if (log.accion === 'JornadaLaboral') {
                              const parsed = parsePruebaContexto(log.contexto)
                              if (parsed) {
                                const valorAnterior = parsed.ValorAnterior && parsed.ValorAnterior !== 'null' ? `${parsed.ValorAnterior} h` : 'Sin valor previo'
                                const valorNuevo = parsed.ValorNuevo ? `${parsed.ValorNuevo} h` : 'Sin valor informado'
                                const fields = [
                                  `Valor anterior: ${valorAnterior}`,
                                  `Valor nuevo: ${valorNuevo}`,
                                  parsed.Motivo && `Motivo: ${parsed.Motivo}`,
                                  parsed.Repartidor && `Repartidor: ${parsed.Repartidor}`,
                                ].filter(Boolean).join(' · ')
                                return (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                                    {fields}
                                  </Typography>
                                )
                              }
                            }
                            return (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                                {log.contexto}
                              </Typography>
                            )
                          })()}
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
