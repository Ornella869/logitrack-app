import { useEffect, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TablePagination,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import ClearAllIcon from '@mui/icons-material/ClearAll'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner'
import { shipmentService, type GenerarLoteDemoResultado, type ImportarEnviosResultado } from '../services/shipmentService'
import type { Shipment, User } from '../types'
import ShipmentCard from '../components/ShipmentCard'
import ShipmentForm from '../components/ShipmentForm'
import SearchBar from '../components/SearchBar'
import ShipmentFilters, { type ShipmentFiltersValue } from '../components/ShipmentFilters'
import { formatArgentinaDateInput } from '../utils/argentinaDate'
import QrCameraScanner from '../components/QrCameraScanner'

const EMPTY_FILTERS: ShipmentFiltersValue = { status: [], from: '', to: '' }
const BULK_OPTIONS = [100, 250, 500, 1000]

type Severity = 'success' | 'info' | 'warning' | 'error'

function getPageTitle(user: User) {
  if (user.role === 'operador') return 'Gestión de envíos'
  return 'Envíos'
}

function getGreeting(name: string) {
  const h = new Date().getHours()
  if (h >= 6 && h < 12) return `Buenos días, ${name}!`
  if (h >= 12 && h < 20) return `Buenas tardes, ${name}!`
  return `Buenas noches, ${name}!`
}

export default function EnviosPage() {
  const user = useOutletContext<User>()
  const navigate = useNavigate()
  const location = useLocation()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [openShipmentForm, setOpenShipmentForm] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkCantidad, setBulkCantidad] = useState(100)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<GenerarLoteDemoResultado | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<ImportarEnviosResultado | null>(null)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [receiveCode, setReceiveCode] = useState('')
  const [receiveLoading, setReceiveLoading] = useState(false)
  const [receiveError, setReceiveError] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<ShipmentFiltersValue>(EMPTY_FILTERS)
  const [hasQuery, setHasQuery] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [totalItems, setTotalItems] = useState(0)
  const [actionToast, setActionToast] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const showActionToast = (message: string, severity: Severity = 'success') => {
    setActionToast({ open: true, message, severity })
  }

  const closeActionToast = () => {
    setActionToast((prev) => ({ ...prev, open: false, message: '' }))
  }

  const loadShipments = async (query: string, activeFilters: ShipmentFiltersValue, nextPage: number, nextPageSize: number) => {
    setLoading(true)
    setError('')
    try {
      const result = await shipmentService.getShipmentsPage(
        nextPage,
        nextPageSize,
        query || undefined,
        activeFilters.status.length ? activeFilters.status : undefined,
        activeFilters.from || undefined,
        activeFilters.to || undefined,
        user.role === 'operador' || user.role === 'supervisor',
      )
      setShipments(result.items)
      setTotalItems(result.totalItems)
      setHasQuery(Boolean(query || activeFilters.status.length || activeFilters.from || activeFilters.to))
    } catch {
      setError('Error al cargar los envíos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadShipments(search, filters, page, pageSize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters.status.join(','), filters.from, filters.to, page, pageSize])

  useEffect(() => {
    if (location.pathname === '/envios' && location.state?.forceReload) {
      setPage(1)
      void loadShipments(search, filters, 1, pageSize)
      navigate('/envios', { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.state])

  const handleSearch = async (query: string) => {
    setPage(1)
    setSearch(query.trim())
  }

  const handleCreateShipment = async (shipment: Omit<Shipment, 'id' | 'lastUpdate' | 'trackingId'>) => {
    const newShipment = await shipmentService.registerShipment(shipment)
    if (newShipment) {
      setPage(1)
      void loadShipments(search, filters, 1, pageSize)
      showActionToast(`Envío creado. Tracking ID: ${newShipment.trackingId}`, 'success')
      setOpenShipmentForm(false)
      return
    }
    throw new Error('No se pudo crear el envío')
  }

  const handleGenerateBulkDemo = async () => {
    setBulkLoading(true)
    setBulkResult(null)
    try {
      const result = await shipmentService.generarLoteDemo(bulkCantidad)
      setBulkResult(result)
      setPage(1)
      void loadShipments(search, filters, 1, pageSize)
      showActionToast(`Carga masiva lista: ${result.creados} envios creados`, result.fallidos ? 'warning' : 'success')
    } catch (error: any) {
      showActionToast(error?.message || 'Error al generar la carga masiva', 'error')
    } finally {
      setBulkLoading(false)
    }
  }

  const handleImportExcel = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const result = await shipmentService.importarExcel(file)
      setImportResult(result)
      setPage(1)
      void loadShipments(search, filters, 1, pageSize)
      if (result.creados === 0 && result.fallidos > 0) {
        showActionToast(`No se importo ningun envio. ${result.detalles?.find((d) => !d.creado)?.error ?? 'Revisa los errores del archivo.'}`, 'error')
      } else {
        showActionToast(`Importacion lista: ${result.creados} envios creados`, result.fallidos ? 'warning' : 'success')
      }
    } catch (error: any) {
      showActionToast(error?.response?.data || error?.message || 'Error al importar el archivo', 'error')
    } finally {
      setImportLoading(false)
    }
  }

  const handleDownloadShipments = async () => {
    const exportShipments = await shipmentService.getAllShipments(
      search || undefined,
      filters.status.length ? filters.status : undefined,
      filters.from || undefined,
      filters.to || undefined,
    )

    if (exportShipments.length === 0) {
      showActionToast('No hay envíos para descargar', 'warning')
      return
    }

    const headers = ['ID', 'Tracking ID', 'Estado', 'Origen', 'Destino', 'Remitente', 'Destinatario', 'Peso (kg)', 'Descripción', 'Fecha Creación']
    const rows = exportShipments.map((shipment) => [
      shipment.id,
      shipment.trackingId,
      shipment.status,
      shipment.origin,
      shipment.destination,
      shipment.sender.name,
      shipment.receiver.name,
      shipment.weight,
      shipment.description,
      shipment.createdDate,
    ])
    const csvContent = '﻿' + [headers.join(';'), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';'))].join('\n')
    const element = document.createElement('a')
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent))
    element.setAttribute('download', `envios_${formatArgentinaDateInput()}.csv`)
    element.style.display = 'none'
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
    showActionToast('CSV descargado correctamente', 'info')
  }

  const handleReceiveShipment = async (detectedCode?: string) => {
    const code = (detectedCode ?? receiveCode).trim()
    if (!code || receiveLoading) return
    setReceiveLoading(true)
    setReceiveError('')
    const result = await shipmentService.escanearQr(code)
    setReceiveLoading(false)
    if (!result.success) {
      setReceiveError(result.error ?? 'No se pudo recibir el envío.')
      return
    }
    if (result.data?.accion !== 'RecibidoEnSucursal') {
      setReceiveError('El envío no está esperando recepción en esta sucursal.')
      return
    }
    setReceiveOpen(false)
    setReceiveCode('')
    setPage(1)
    void loadShipments(search, filters, 1, pageSize)
    showActionToast('Envío recibido. Ya está pendiente de calendarización en esta sucursal.', 'success')
  }

  const handleClearFilters = () => {
    setPage(1)
    setFilters(EMPTY_FILTERS)
    setSearch('')
  }

  const handlePageChange = (_event: unknown, nextPage: number) => {
    setPage(nextPage + 1)
  }

  const handleRowsPerPageChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPageSize(Number(event.target.value))
    setPage(1)
  }

  const showCreateButton = user.role === 'operador'

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        sx={{ mb: 3, gap: 2 }}
      >
        <Box>
          {user.role === 'operador' && (
            <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
              {getGreeting(user.name)}
            </Typography>
          )}
          <Typography variant="h4" fontWeight={700}>
            {getPageTitle(user)}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consultá, filtrá y exportá el listado operativo de envíos.
          </Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {showCreateButton && (
            <Button variant="outlined" startIcon={<QrCodeScannerIcon />} onClick={() => { setReceiveError(''); setReceiveOpen(true) }}>
              Recibir envío
            </Button>
          )}
          {showCreateButton && (
            <Button variant="outlined" startIcon={<PlaylistAddIcon />} onClick={() => { setBulkResult(null); setImportResult(null); setBulkOpen(true) }}>
              Carga masiva
            </Button>
          )}
          {showCreateButton && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenShipmentForm(true)}>
              Nuevo envío
            </Button>
          )}
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleDownloadShipments}>
            Exportar CSV
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      )}

      <SearchBar onSearch={handleSearch} loading={loading} />
      <ShipmentFilters value={filters} onChange={setFilters} onClear={handleClearFilters} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress />
        </Box>
      ) : shipments.length === 0 ? (
        <Alert
          severity="info"
          action={
            hasQuery ? (
              <Button color="inherit" size="small" startIcon={<ClearAllIcon />} onClick={handleClearFilters}>
                Limpiar filtros
              </Button>
            ) : undefined
          }
        >
          {hasQuery ? 'No se encontraron envíos para los filtros aplicados.' : 'No hay envíos disponibles.'}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {shipments.map((shipment) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={shipment.tramoOperativoId ?? shipment.id}>
                <ShipmentCard shipment={shipment} />
              </Grid>
            ))}
          </Grid>
          <TablePagination
            component="div"
            count={totalItems}
            page={page - 1}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[8, 12, 24]}
            labelRowsPerPage="Tarjetas por página"
            sx={{ mt: 2 }}
          />
        </>
      )}

      <ShipmentForm open={openShipmentForm} onClose={() => setOpenShipmentForm(false)} onSubmit={handleCreateShipment} />

      <Dialog open={receiveOpen} onClose={() => !receiveLoading && setReceiveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Recibir envío de otra sucursal</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info">
              Escaneá el QR cuando el paquete llegue físicamente. El envío quedará disponible para calendarizar desde esta sucursal.
            </Alert>
            <QrCameraScanner onDetect={(code) => void handleReceiveShipment(code)} height={220} />
            <TextField
              label="Código de seguimiento"
              value={receiveCode}
              onChange={(event) => setReceiveCode(event.target.value)}
              disabled={receiveLoading}
              fullWidth
            />
            {receiveError && <Alert severity="error">{receiveError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiveOpen(false)} disabled={receiveLoading}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => void handleReceiveShipment()}
            disabled={receiveLoading || !receiveCode.trim()}
          >
            {receiveLoading ? 'Recibiendo...' : 'Confirmar recepción'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => !bulkLoading && setBulkOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Carga masiva demo</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              select
              label="Cantidad"
              value={bulkCantidad}
              onChange={(event) => setBulkCantidad(Number(event.target.value))}
              disabled={bulkLoading}
              fullWidth
            >
              {BULK_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option} envios</MenuItem>
              ))}
            </TextField>
            <Alert severity="info">
              Se generan envios pendientes con direcciones reales dentro de la cobertura de tu sucursal. El Excel toma la sucursal origen desde tu usuario y permite modalidad Domicilio o PickUp.
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={() => void shipmentService.descargarTemplateImportacion()}
                disabled={bulkLoading || importLoading}
              >
                Descargar template Excel
              </Button>
              <Button
                component="label"
                variant="outlined"
                startIcon={importLoading ? <CircularProgress size={16} /> : <UploadFileIcon />}
                disabled={bulkLoading || importLoading}
              >
                Importar Excel
                <input hidden type="file" accept=".xlsx,.csv" onChange={handleImportExcel} />
              </Button>
            </Stack>
            {bulkResult && (
              <Alert severity={bulkResult.fallidos ? 'warning' : 'success'}>
                Creados: {bulkResult.creados} / {bulkResult.solicitados}
                {bulkResult.fallidos ? ` - Fallidos: ${bulkResult.fallidos}` : ''}
              </Alert>
            )}
            {importResult && (
              <Alert severity={importResult.creados === 0 && importResult.fallidos > 0 ? 'error' : importResult.fallidos ? 'warning' : 'success'}>
                Importados: {importResult.creados} / {importResult.procesados}
                {importResult.fallidos ? ` - Fallidos: ${importResult.fallidos}` : ''}
              </Alert>
            )}
            {importResult?.detalles?.some((d) => !d.creado) ? (
              <Alert severity="warning">
                {importResult.detalles.filter((d) => !d.creado).slice(0, 3).map((d) => `Fila ${d.fila}: ${d.error}`).join(' | ')}
              </Alert>
            ) : null}
            {bulkResult?.errores?.length ? (
              <Alert severity="warning">
                {bulkResult.errores.slice(0, 3).join(' | ')}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)} disabled={bulkLoading}>Cerrar</Button>
          <Button variant="contained" onClick={handleGenerateBulkDemo} disabled={bulkLoading}>
            {bulkLoading ? 'Generando...' : 'Generar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={actionToast.open}
        autoHideDuration={3500}
        onClose={closeActionToast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={actionToast.severity} variant="filled" onClose={closeActionToast} sx={{ width: '100%' }}>
          {actionToast.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}
