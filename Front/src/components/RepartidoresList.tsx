import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Stack,
  TablePagination,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser'

import type { RepartidorEstado } from '../types'
import { authService, type RepartidorListItem } from '../services/authService'

interface RepartidoresListProps {
  userRole?: string
}

const estadoColorMap: Record<RepartidorEstado, 'success' | 'warning' | 'error'> = {
  Activo: 'success',
  Suspendido: 'warning',
  Inhabilitado: 'error',
}

const FILTER_OPTIONS = [
  { value: 'activo', label: 'Activo', color: '#1b5e20', bg: '#e8f5e9' },
  { value: 'inactivo', label: 'Inactivo', color: '#b71c1c', bg: '#ffebee' },
  { value: 'en-viaje', label: 'En viaje', color: '#ed6c02', bg: '#fff3e0' },
  { value: 'sin-asignacion', label: 'Sin asignacion', color: '#616161', bg: '#f5f5f5' },
  { value: 'con-ruta-asignada', label: 'Con ruta asignada', color: '#1565c0', bg: '#e3f2fd' },
] as const

type FilterValue = typeof FILTER_OPTIONS[number]['value']

function RepartidoresList({ userRole: _userRole }: RepartidoresListProps) {
  const navigate = useNavigate()
  const [repartidores, setRepartidores] = useState<RepartidorListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [estadoFilters, setEstadoFilters] = useState<FilterValue[]>([])
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(8)
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    void loadRepartidores()
  }, [page, rowsPerPage, search, estadoFilters])

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
      })
      setRepartidores(result.items)
      setTotalItems(result.totalItems)
    } catch {
      setError('Error al cargar los Repartidores')
    } finally {
      setLoading(false)
    }
  }

  const activeCount = estadoFilters.length + (search.trim() ? 1 : 0)
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
        return { label: repartidor.routeStatusLabel, color: 'success' as const }
    }
  }

  const handleEstadoToggle = (_event: unknown, newFilters: FilterValue[]) => {
    setPage(0)
    setEstadoFilters(newFilters)
  }

  const handleSearchChange = (value: string) => {
    setPage(0)
    setSearch(value)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            size="small"
            placeholder="Buscar por nombre, email, DNI o licencia..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ maxWidth: 420, width: '100%' }}
          />
        </Stack>

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexWrap: 'wrap', flex: 1 }}>
              <ToggleButtonGroup
                value={estadoFilters}
                onChange={handleEstadoToggle}
                size="small"
                sx={{
                  flexWrap: 'wrap',
                  gap: 0.5,
                  '& .MuiToggleButtonGroup-grouped': {
                    borderRadius: '16px !important',
                    border: '1px solid !important',
                    mx: 0,
                  },
                }}
              >
                {FILTER_OPTIONS.map((opt) => {
                  const selected = estadoFilters.includes(opt.value)
                  return (
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
                })}
              </ToggleButtonGroup>

              {activeCount > 0 && (
                <Button
                  variant="text"
                  size="small"
                  startIcon={<ClearAllIcon />}
                  onClick={() => {
                    setPage(0)
                    setSearch('')
                    setEstadoFilters([])
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
              const estadoCuenta = (repartidor.estado ?? 'Activo') as RepartidorEstado

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={repartidor.id}>
                  <Card
                    onClick={() => navigate(`/repartidor/${repartidor.id}/rendimiento`)}
                    sx={{
                      cursor: 'pointer',
                      height: '100%',
                      transition: 'all .15s',
                      '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' },
                    }}
                  >
                    <CardContent>
                      <Typography
                        variant="h6"
                        gutterBottom
                        sx={{
                          textDecoration: 'underline',
                          textDecorationColor: 'transparent',
                          transition: 'text-decoration-color .15s',
                          '.MuiCard-root:hover &': { textDecorationColor: 'currentColor' },
                        }}
                      >
                        {repartidor.name} {repartidor.lastname}
                      </Typography>
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
                        </Box>
                        <Box>
                          <Typography variant="body2" color="textSecondary">
                            Rutas asignadas
                          </Typography>
                          <Typography variant="body2">{repartidor.assignedRoutesCount}</Typography>
                        </Box>
                        <Box sx={{ pt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          <Chip
                            label={`Cuenta: ${estadoCuenta}`}
                            color={estadoColorMap[estadoCuenta]}
                            size="small"
                            variant="filled"
                            icon={<VerifiedUserIcon />}
                          />
                          <Chip
                            label={routeStatus.label}
                            color={routeStatus.color}
                            size="small"
                            variant="filled"
                          />
                        </Box>
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
    </Box>
  )
}

export default RepartidoresList
