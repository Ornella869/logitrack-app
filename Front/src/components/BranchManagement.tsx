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
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import StoreIcon from '@mui/icons-material/Store'
import type { Branch } from '../types'
import { branchService } from '../services/branchService'
import BranchForm from './BranchForm'
import ConfirmDialog from './ConfirmDialog'

function BranchManagement() {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
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

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (b: Branch) => {
    setEditing(b)
    setFormOpen(true)
  }

  const handleSaved = () => {
    setToast({ open: true, msg: editing ? 'Sucursal actualizada' : 'Sucursal creada', severity: 'success' })
    load()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    try {
      await branchService.deleteBranch(deleting.id)
      setToast({ open: true, msg: 'Sucursal eliminada', severity: 'success' })
      setDeleting(null)
      load()
    } catch {
      setToast({ open: true, msg: 'Error al eliminar la sucursal', severity: 'error' })
    }
  }

  const canCreate = branches.length === 0

  return (
    <Box sx={{ mt: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Mi Sucursal</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!canCreate}
          title={canCreate ? 'Crear sucursal' : 'Solo se permite una sucursal por ahora. Eliminá la actual para crear otra.'}
        >
          Nueva sucursal
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && branches.length === 0 && (
        <Alert severity="info">
          No hay sucursales registradas. Creá la primera para que los operadores puedan registrar
          envíos.
        </Alert>
      )}

      <Stack spacing={2}>
        {branches.map((b) => (
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

      <BranchForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        mode={editing ? 'edit' : 'create'}
        initialData={editing ?? undefined}
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
