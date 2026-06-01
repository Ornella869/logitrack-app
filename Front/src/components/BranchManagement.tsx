import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Stack,
  CircularProgress,
  Alert,
  Snackbar,
  Chip,
  Grid,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import StoreIcon from '@mui/icons-material/Store'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import type { Branch } from '../types'
import { branchService } from '../services/branchService'
import { postalCodeService } from '../services/postalCodeService'
import { branchMarkerIcon } from '../utils/mapIcons'
import BranchForm from './BranchForm'
import ConfirmDialog from './ConfirmDialog'
import { authService } from '../services/authService'
import { notificationService } from '../services/notificationService'

interface BranchManagementProps {
  gerenteProvincia?: string
  gerenteId?: string
  gerenteName?: string
}

function BranchManagement({ gerenteProvincia, gerenteId, gerenteName }: BranchManagementProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [branchCoords, setBranchCoords] = useState<Map<string, [number, number]>>(new Map())
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Branch | null>(null)
  const [deleting, setDeleting] = useState<Branch | null>(null)
  const [toast, setToast] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false,
    msg: '',
    severity: 'success',
  })

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      setBranches(await branchService.getAllBranches())
    } catch {
      setError('Error al cargar las sucursales')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Geocodifica cada sucursal secuencialmente para no superar el rate limit de Nominatim.
  useEffect(() => {
    if (branches.length === 0) return
    let cancelled = false
    setBranchCoords(new Map())
    const run = async () => {
      for (const b of branches) {
        if (cancelled) break
        const coords = await postalCodeService.geocodeAddress(b.address, b.city, b.postalCode || undefined)
        if (coords && !cancelled) {
          setBranchCoords((prev) => new Map(prev).set(b.id, [coords.lat, coords.lng]))
        }
      }
    }
    void run()
    return () => { cancelled = true }
  }, [branches])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (b: Branch) => {
    setEditing(b)
    setFormOpen(true)
  }

  const handleSaved = async (savedBranch: Branch) => {
    setToast({ open: true, msg: editing ? 'Sucursal actualizada' : 'Sucursal creada', severity: 'success' })

    // Al crear una sucursal, notificar a otros gerentes que también cubrían esa provincia
    if (!editing && savedBranch.province && gerenteId) {
      try {
        const result = await authService.getUsuariosPage({ page: 1, pageSize: 100, role: 'gerente' })
        result.items
          .filter((g) => g.id !== gerenteId && g.activo)
          .filter((g) => {
            const provincias = g.provincia?.split(',').map((p) => p.trim()).filter(Boolean) ?? []
            return provincias.some((p) => p.toLowerCase() === savedBranch.province!.toLowerCase())
          })
          .forEach((g) => {
            notificationService.add({
              type: 'otro',
              title: 'Cambio en tu cobertura provincial',
              message: `${gerenteName ?? 'Otro gerente'} ha creado una sucursal en ${savedBranch.province}. Ya no tenés cobertura sobre esa provincia.`,
              recipientId: g.id,
            })
          })
      } catch { /* silent — no bloquea el flujo */ }
    }

    load()
    window.dispatchEvent(new Event('logitrack:sucursales'))
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await branchService.deleteBranch(deleting.id)
      setToast({ open: true, msg: 'Sucursal eliminada', severity: 'success' })
      setDeleting(null)
      load()
      window.dispatchEvent(new Event('logitrack:sucursales'))
    } catch {
      setToast({ open: true, msg: 'Error al eliminar la sucursal', severity: 'error' })
    }
  }

  const gerenteProvincias = gerenteProvincia
    ? gerenteProvincia.split(',').map((p) => p.trim()).filter(Boolean)
    : []

  const visibleBranches = gerenteProvincias.length > 0
    ? branches.filter((b) => b.province && gerenteProvincias.some(
        (p) => p.toLowerCase() === b.province!.toLowerCase()
      ))
    : branches

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Mis Sucursales</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          title="Crear sucursal"
        >
          Nueva sucursal
        </Button>
      </Box>

      <Grid container spacing={3} alignItems="flex-start">
        {/* Mapa de Argentina con ubicaciones */}
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ height: 480, position: 'relative' }}>
              <MapContainer
                center={[-38, -65]}
                zoom={4}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap"
                />
                {visibleBranches.map((b) => {
                  const coords = branchCoords.get(b.id)
                  if (!coords) return null
                  return (
                    <Marker key={b.id} position={coords} icon={branchMarkerIcon}>
                      <Tooltip direction="top">
                        <strong>{b.name}</strong>
                        <br />
                        <span style={{ fontSize: 12 }}>{b.address}, {b.city}</span>
                        {b.province && (
                          <>
                            <br />
                            <span style={{ fontSize: 12 }}>{b.province}</span>
                          </>
                        )}
                      </Tooltip>
                    </Marker>
                  )
                })}
              </MapContainer>
              {loading && (
                <Box sx={{
                  position: 'absolute', inset: 0, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  bgcolor: 'rgba(0,0,0,0.35)', zIndex: 1000,
                }}>
                  <CircularProgress sx={{ color: 'white' }} />
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Lista de sucursales */}
        <Grid item xs={12} md={7}>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && visibleBranches.length === 0 && (
            <Alert severity="info">
              No hay sucursales registradas. Creá la primera para que los operadores puedan registrar
              envíos.
            </Alert>
          )}

          <Stack spacing={2}>
            {visibleBranches.map((b) => (
              <Card key={b.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <StoreIcon color="primary" />
                    <Typography variant="h6">{b.name}</Typography>
                    <Chip
                      label={b.status}
                      size="small"
                      color={b.status === 'Activa' ? 'success' : 'default'}
                      sx={{ ml: 1 }}
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {b.address}, {b.city} {b.postalCode ? `(CP ${b.postalCode})` : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tel: {b.phone}
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                    <Chip label={`Provincia: ${b.province ?? '-'}`} size="small" />
                    {(b.coveredProvinces ?? []).map((p) => (
                      <Chip key={p} label={`Cubre: ${p}`} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </CardContent>
                <CardActions>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(b)}>
                    Editar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => setDeleting(b)}
                  >
                    Eliminar
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Stack>
        </Grid>
      </Grid>

      <BranchForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        mode={editing ? 'edit' : 'create'}
        initialData={editing ?? undefined}
        lockedProvince={gerenteProvincia}
        existingBranches={branches}
      />

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar sucursal"
        message={`¿Seguro que querés eliminar "${deleting?.name}"? Los operadores no van a poder registrar envíos hasta que crees una nueva.`}
        confirmLabel="Eliminar"
        confirmColor="error"
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
      >
        <Alert severity={toast.severity}>{toast.msg}</Alert>
      </Snackbar>
    </Box>
  )
}

export default BranchManagement
