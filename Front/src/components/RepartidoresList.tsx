import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  TablePagination,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'
import BarChartIcon from '@mui/icons-material/BarChart'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import EditIcon from '@mui/icons-material/Edit'
import BlockIcon from '@mui/icons-material/Block'

import { authService, type RepartidorListItem } from '../services/authService'
import { empresaService } from '../services/empresaService'
import SearchBar from './SearchBar'

interface RepartidoresListProps {
  userRole?: string
}

const FILTER_OPTIONS = [
  { value: 'activo', label: 'Activo', color: '#1b5e20', bg: '#e8f5e9' },
  { value: 'inactivo', label: 'Inactivo', color: '#b71c1c', bg: '#ffebee' },
] as const

const ROUTE_FILTER_OPTIONS = [
  { value: 'en-viaje', label: 'En viaje', color: '#ed6c02', bg: '#fff3e0' },
  { value: 'sin-asignacion', label: 'Sin asignacion', color: '#616161', bg: '#f5f5f5' },
  { value: 'con-ruta-asignada', label: 'Con ruta asignada', color: '#1565c0', bg: '#e3f2fd' },
] as const

const JORNADA_FILTER_OPTIONS = [
  { value: 'part-time', label: 'Part Time', color: '#e65100', bg: '#fff3e0' },
  { value: 'full-time', label: 'Full Time', color: '#1565c0', bg: '#e3f2fd' },
] as const

type FilterValue = typeof FILTER_OPTIONS[number]['value']
  | typeof ROUTE_FILTER_OPTIONS[number]['value']
type JornadaFilterValue = typeof JORNADA_FILTER_OPTIONS[number]['value']

const filterGroupSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  px: 1,
  py: 0.75,
  m: 0,
  minWidth: 0,
}

const filterLegendSx = {
  px: 0.75,
  fontSize: 12,
  fontWeight: 700,
  color: 'text.secondary',
}

const toggleGroupSx = {
  flexWrap: 'wrap',
  gap: 0.5,
  '& .MuiToggleButtonGroup-grouped': {
    borderRadius: '16px !important',
    border: '1px solid !important',
    mx: 0,
  },
}

function formatDateOnly(value?: string | null): string {
  if (!value) return 'No informado'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function daysUntil(value?: string | null): number | null {
  if (!value) return null
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return Math.ceil((Date.UTC(year, month - 1, day) - todayUtc) / 86400000)
}

function toDateInputValue(value?: string | null): string {
  return value ? value.slice(0, 10) : ''
}

function RepartidoresList({ userRole: _userRole }: RepartidoresListProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const [repartidores, setRepartidores] = useState<RepartidorListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [estadoFilters, setEstadoFilters] = useState<FilterValue[]>([])
  const [jornadaFilter, setJornadaFilter] = useState<JornadaFilterValue | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const [totalItems, setTotalItems] = useState(0)
  const [editing, setEditing] = useState<RepartidorListItem | null>(null)
  const [licenciaForm, setLicenciaForm] = useState({ licencia: '', fechaVencimientoLicencia: '' })
  const [savingLicencia, setSavingLicencia] = useState(false)
  const [reactivatingId, setReactivatingId] = useState<string | null>(null)
  const [formError, setFormError] = useState('')
  const [urgenteDias, setUrgenteDias] = useState(7)

  useEffect(() => {
    void loadRepartidores()
  }, [page, rowsPerPage, search, estadoFilters, jornadaFilter])

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      setTimeout(() => highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400)
    }
  }, [highlightId, repartidores])

  useEffect(() => {
    void empresaService.getConfiguracionLicencias().then((config) => setUrgenteDias(config?.urgenteDias ?? 7)).catch(() => setUrgenteDias(7))
  }, [])

  const loadRepartidores = async () => {
    setLoading(true)
    setError('')
    try {
      const accountStatus = estadoFilters.includes('activo') && !estadoFilters.includes('inactivo')
        ? 'activo'
        : estadoFilters.includes('inactivo') && !estadoFilters.includes('activo')
          ? 'inactivo'
          : undefined

      const routeStatus = estadoFilters.includes('en-viaje')
        ? 'en-viaje'
        : estadoFilters.includes('con-ruta-asignada')
          ? 'con-ruta-asignada'
          : estadoFilters.includes('sin-asignacion')
            ? 'sin-asignacion'
            : undefined

      const result = await authService.getRepartidoresPage({
        page: page + 1,
        pageSize: rowsPerPage,
        search: search.trim() || undefined,
        accountStatus,
        routeStatus,
        tipoJornada: jornadaFilter ?? undefined,
      })
      setRepartidores(result.items)
      setTotalItems(result.totalItems)
    } catch {
      setError('Error al cargar los Repartidores')
    } finally {
      setLoading(false)
    }
  }

  const activeCount = estadoFilters.length + (jornadaFilter ? 1 : 0) + (search.trim() ? 1 : 0)
  const hasActiveFilters = activeCount > 0

  const getRouteStatus = (repartidor: RepartidorListItem) => {
    switch (repartidor.routeStatusKey) {
      case 'en-viaje':
        return { label: repartidor.routeStatusLabel, color: 'warning' as const }
      case 'con-ruta-asignada':
        return { label: repartidor.routeStatusLabel, color: 'info' as const }
      case 'sin-asignacion':
        return { label: repartidor.routeStatusLabel, color: 'default' as const }
      default:
        return { label: repartidor.routeStatusLabel, color: 'default' as const }
    }
  }

  const getAccountStatus = (repartidor: RepartidorListItem) => {
    if (repartidor.activo === false) {
      return { label: 'Cuenta: Inactiva', color: 'error' as const }
    }

    return { label: 'Cuenta: Activa', color: 'success' as const }
  }

  const handleEstadoToggle = (_event: unknown, newFilters: FilterValue[]) => {
    setPage(0)
    setEstadoFilters(newFilters)
  }

  const handleJornadaToggle = (_event: unknown, newFilter: JornadaFilterValue | null) => {
    setPage(0)
    setJornadaFilter(newFilter)
  }

  const handleSearch = async (value: string) => {
    setPage(0)
    setSearch(value.trim())
  }

  const openLicenciaDialog = (repartidor: RepartidorListItem) => {
    setEditing(repartidor)
    setLicenciaForm({
      licencia: repartidor.licencia ?? '',
      fechaVencimientoLicencia: toDateInputValue(repartidor.fechaVencimientoLicencia),
    })
    setFormError('')
  }

  const saveLicencia = async () => {
    if (!editing) return
    const licencia = licenciaForm.licencia.trim()
    if (!licencia) {
      setFormError('La licencia es obligatoria.')
      return
    }
    if (!/^[A-Za-z0-9\- ]{6,15}$/.test(licencia)) {
      setFormError('La licencia debe tener entre 6 y 15 caracteres alfanuméricos.')
      return
    }
    if (!licenciaForm.fechaVencimientoLicencia) {
      setFormError('El vencimiento de licencia es obligatorio.')
      return
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const selectedDate = new Date(licenciaForm.fechaVencimientoLicencia + 'T00:00:00')
    if (selectedDate <= today) {
      setFormError('La fecha de vencimiento debe ser una fecha futura (mínimo mañana).')
      return
    }

    setSavingLicencia(true)
    setFormError('')
    try {
      const updated = await authService.updateRepartidorLicencia(editing.id, licencia, licenciaForm.fechaVencimientoLicencia)
      if (!updated) throw new Error('No se pudo actualizar la licencia.')
      setEditing(null)
      await loadRepartidores()
    } catch (err: any) {
      setFormError(err?.message ?? 'No se pudo actualizar la licencia.')
    } finally {
      setSavingLicencia(false)
    }
  }

  const reactivateRepartidor = async (repartidor: RepartidorListItem) => {
    setReactivatingId(repartidor.id)
    try {
      await authService.updateRepartidorEstado(repartidor.id, 'Activo')
      await loadRepartidores()
    } catch (err: any) {
      setError(err?.message ?? 'No se pudo reactivar al repartidor.')
    } finally {
      setReactivatingId(null)
    }
  }

  const renderFilterButton = <T extends string>(opt: { value: T; label: string; color: string; bg: string }, selected: boolean) => (
    <ToggleButton
      key={opt.value}
      value={opt.value}
      sx={{
        textTransform: 'none',
        px: 1.5,
        py: 0.5,
        fontSize: 12,
        fontWeight: selected ? 700 : 400,
        color: selected ? opt.color : 'text.secondary',
        bgcolor: selected ? opt.bg : 'transparent',
        borderColor: selected ? `${opt.color} !important` : 'divider !important',
        '&:hover': { bgcolor: opt.bg, color: opt.color },
        '&.Mui-selected': { bgcolor: opt.bg, color: opt.color },
        '&.Mui-selected:hover': { bgcolor: opt.bg },
      }}
    >
      {opt.label}
    </ToggleButton>
  )

  if (loading && repartidores.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* SearchBar con debounce: la consulta se dispara después de 500ms sin tipear,
            o con Enter. Igual que en la pantalla de Envíos. */}
        <SearchBar
          onSearch={handleSearch}
          loading={loading}
          placeholder="Buscar por nombre, email, DNI o licencia..."
          value={search}
        />

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap', flex: 1 }}>
              <Box component="fieldset" sx={filterGroupSx}>
                <Box component="legend" sx={filterLegendSx}>
                  Estado
                </Box>
                <ToggleButtonGroup
                  value={estadoFilters}
                  onChange={handleEstadoToggle}
                  size="small"
                  sx={toggleGroupSx}
                >
                  {FILTER_OPTIONS.map((opt) => renderFilterButton(opt, estadoFilters.includes(opt.value)))}
                </ToggleButtonGroup>
              </Box>

              <Box component="fieldset" sx={filterGroupSx}>
                <Box component="legend" sx={filterLegendSx}>
                  Ruta
                </Box>
                <ToggleButtonGroup
                  value={estadoFilters}
                  onChange={handleEstadoToggle}
                  size="small"
                  sx={toggleGroupSx}
                >
                  {ROUTE_FILTER_OPTIONS.map((opt) => renderFilterButton(opt, estadoFilters.includes(opt.value)))}
                </ToggleButtonGroup>
              </Box>

              <Box component="fieldset" sx={filterGroupSx}>
                <Box component="legend" sx={filterLegendSx}>
                  Tipo de jornada
                </Box>
                <ToggleButtonGroup
                  exclusive
                  value={jornadaFilter}
                  onChange={handleJornadaToggle}
                  size="small"
                  sx={toggleGroupSx}
                >
                  {JORNADA_FILTER_OPTIONS.map((opt) => renderFilterButton(opt, jornadaFilter === opt.value))}
                </ToggleButtonGroup>
              </Box>

              {activeCount > 0 && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ClearAllIcon />}
                  onClick={() => {
                    setPage(0)
                    setSearch('')
                    setEstadoFilters([])
                    setJornadaFilter(null)
                  }}
                  sx={{
                    borderRadius: '16px',
                    textTransform: 'none',
                    alignSelf: 'flex-start',
                    minHeight: 30,
                    px: 1.25,
                    py: 0.5,
                    fontSize: 12,
                    lineHeight: 1.2,
                    '& .MuiButton-startIcon': {
                      mr: 0.5,
                    },
                    '& .MuiSvgIcon-root': {
                      fontSize: 16,
                    },
                  }}
                >
                  Limpiar
                </Button>
              )}
            </Box>

            <Typography variant="h6" sx={{ whiteSpace: 'nowrap', pt: 0.5 }}>
              Total: {totalItems}
            </Typography>
          </Box>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        {repartidores.length === 0 ? (
          <Alert severity="info">
            {hasActiveFilters ? 'No se encontraron repartidores para los filtros aplicados' : 'No hay repartidores registrados'}
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {repartidores.map((repartidor) => {
              const routeStatus = getRouteStatus(repartidor)
              const accountStatus = getAccountStatus(repartidor)
              const initials = `${repartidor.name.charAt(0)}${repartidor.lastname.charAt(0)}`.toUpperCase()
              const diasLicencia = daysUntil(repartidor.fechaVencimientoLicencia)
              const licenciaUrgente = diasLicencia !== null && diasLicencia <= urgenteDias
              const operativoActivo = (repartidor.estado ?? 'Activo') === 'Activo'

              const isHighlighted = highlightId === repartidor.id
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={repartidor.id} ref={isHighlighted ? highlightRef : undefined}>
                  <Card
                    onClick={() => navigate(`/repartidor/${repartidor.id}/rendimiento`)}
                    sx={{
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all .15s',
                      '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
                      ...(isHighlighted && {
                        border: '2px solid #ed6c02',
                        boxShadow: '0 0 16px rgba(237,108,2,0.4)',
                        animation: 'pulse-warn 1.5s ease infinite',
                        '@keyframes pulse-warn': {
                          '0%,100%': { boxShadow: '0 0 16px rgba(237,108,2,0.4)' },
                          '50%': { boxShadow: '0 0 28px rgba(237,108,2,0.8)' },
                        },
                      }),
                    }}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                        <Avatar
                          src={repartidor.fotoPerfil ?? undefined}
                          sx={{ width: 44, height: 44, bgcolor: '#2e7d32', fontWeight: 700, fontSize: '1rem' }}
                        >
                          {!repartidor.fotoPerfil && initials}
                        </Avatar>
                        <Typography
                          variant="h6"
                          sx={{
                            textDecoration: 'underline',
                            textDecorationColor: 'transparent',
                            transition: 'text-decoration-color .15s',
                            '.MuiCard-root:hover &': { textDecorationColor: 'currentColor' },
                            lineHeight: 1.2,
                          }}
                        >
                          {repartidor.name} {repartidor.lastname}
                        </Typography>
                      </Box>
                      <Stack spacing={1}>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Email
                          </Typography>
                          <Typography variant="body2">{repartidor.email}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            DNI
                          </Typography>
                          <Typography variant="body2">{repartidor.dni}</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Licencia
                          </Typography>
                          <Typography variant="body2">{repartidor.licencia || 'No informada'}</Typography>
                          <Typography variant="caption" color={licenciaUrgente ? 'error.main' : 'text.secondary'}>
                            Vence: {formatDateOnly(repartidor.fechaVencimientoLicencia)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Capacidad
                          </Typography>
                          <Typography variant="body2">{repartidor.capacidadCargaKg ?? 500} kg</Typography>
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Rutas asignadas
                          </Typography>
                          <Typography variant="body2">{repartidor.assignedRoutesCount}</Typography>
                        </Box>
                        <Box sx={{ pt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={accountStatus.label}
                            color={accountStatus.color}
                            size="small"
                            variant="filled"
                            icon={<VerifiedUserIcon />}
                          />
                          <Chip
                            label={`Operativo: ${repartidor.estado ?? 'Activo'}`}
                            color={operativoActivo ? 'success' : 'warning'}
                            size="small"
                            variant="filled"
                          />
                          <Chip
                            label={routeStatus.label}
                            color={routeStatus.color}
                            size="small"
                            variant="filled"
                          />
                          <Chip
                            label={repartidor.tipoJornada ?? 'Full Time'}
                            size="small"
                            sx={{
                              bgcolor: repartidor.tipoJornada === 'Part Time' ? '#fff3e0' : '#e3f2fd',
                              color: repartidor.tipoJornada === 'Part Time' ? '#e65100' : '#1565c0',
                              fontWeight: 600,
                            }}
                          />
                          {licenciaUrgente && (
                            <Chip
                              label={diasLicencia! <= 0 ? 'Licencia vencida' : `Licencia vence en ${diasLicencia} días`}
                              color="error"
                              size="small"
                              variant="filled"
                              icon={<WarningAmberIcon />}
                            />
                          )}
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<BarChartIcon />}
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/repartidor/${repartidor.id}/rendimiento`)
                          }}
                          sx={{ mt: 1.5, textTransform: 'none', fontSize: 12 }}
                        >
                          Ver rendimiento
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="warning"
                          startIcon={<EditIcon />}
                          onClick={(e) => {
                            e.stopPropagation()
                            openLicenciaDialog(repartidor)
                          }}
                          sx={{ textTransform: 'none', fontSize: 12 }}
                        >
                          Editar licencia
                          </Button>
                        {!operativoActivo && (() => {
                          const licenciaVencida = diasLicencia !== null && diasLicencia <= 0
                          if (licenciaVencida) {
                            return (
                              <Tooltip title="No se puede reactivar: la licencia está vencida. Actualizá la fecha de vencimiento primero.">
                                <span>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    disabled
                                    startIcon={<BlockIcon />}
                                    sx={{ textTransform: 'none', fontSize: 12 }}
                                  >
                                    No reactivable (licencia vencida)
                                  </Button>
                                </span>
                              </Tooltip>
                            )
                          }
                          return (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              disabled={reactivatingId === repartidor.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                void reactivateRepartidor(repartidor)
                              }}
                              sx={{ textTransform: 'none', fontSize: 12 }}
                            >
                              {reactivatingId === repartidor.id ? 'Reactivando...' : 'Reactivar'}
                            </Button>
                          )
                        })()}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
        {totalItems > 0 && (
          <TablePagination
            component="div"
            count={totalItems}
            page={page}
            onPageChange={(_event, nextPage) => setPage(nextPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(Number(event.target.value))
              setPage(0)
            }}
            rowsPerPageOptions={[8, 16, 24]}
            labelRowsPerPage="Tarjetas por página"
          />
        )}
      </Box>

      <Dialog open={!!editing} onClose={() => !savingLicencia && setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar licencia</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            {editing && (
              <Stack spacing={0.5}>
                <Typography variant="body2" color="text.secondary">
                  {editing.name} {editing.lastname} · DNI {editing.dni}
                </Typography>
                <Typography variant="caption" color={(editing.estado ?? 'Activo') === 'Activo' ? 'success.main' : 'warning.main'}>
                  Estado operativo actual: {editing.estado ?? 'Activo'}
                </Typography>
                {editing.motivoSuspension && (
                  <Typography variant="caption" color="warning.main">
                    Motivo: {editing.motivoSuspension}
                  </Typography>
                )}
              </Stack>
            )}
            <TextField
              label="Licencia *"
              value={licenciaForm.licencia}
              onChange={(e) => setLicenciaForm((prev) => ({ ...prev, licencia: e.target.value.replace(/[^A-Za-z0-9\- ]/g, '') }))}
              fullWidth
              inputProps={{ maxLength: 15 }}
              helperText="Número de licencia de conducir (6-15 caracteres alfanuméricos)"
            />
            <TextField
              label="Vencimiento de licencia *"
              type="date"
              value={licenciaForm.fechaVencimientoLicencia}
              onChange={(e) => setLicenciaForm((prev) => ({ ...prev, fechaVencimientoLicencia: e.target.value }))}
              fullWidth
              InputLabelProps={{ shrink: true }}
              inputProps={{ min: (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })() }}
              helperText="Debe ser una fecha futura (mínimo mañana)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)} disabled={savingLicencia}>Cancelar</Button>
          <Button onClick={saveLicencia} variant="contained" disabled={savingLicencia}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RepartidoresList
