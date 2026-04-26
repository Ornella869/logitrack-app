import { useReducer, useCallback } from 'react'
import type { Route, Shipment } from '../types'

export interface RepartidorState {
  routes: Route[]
  shipments: Shipment[]
  loading: boolean
  error: string | null
  snackbar: { open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }
}

const initialState: RepartidorState = {
  routes: [],
  shipments: [],
  loading: false,
  error: null,
  snackbar: { open: false, message: '', severity: 'success' },
}

type Action =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ROUTES'; payload: Route[] }
  | { type: 'SET_SHIPMENTS'; payload: Shipment[] }
  | { type: 'UPDATE_ROUTE'; payload: Route }
  | { type: 'UPDATE_SHIPMENT'; payload: Shipment }
  | { type: 'SHOW_SNACKBAR'; payload: { message: string; severity: 'success' | 'error' | 'info' | 'warning' } }
  | { type: 'HIDE_SNACKBAR' }

function reducer(state: RepartidorState, action: Action): RepartidorState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload }

    case 'SET_ROUTES':
      return { ...state, routes: action.payload }

    case 'SET_SHIPMENTS':
      return { ...state, shipments: action.payload }

    case 'UPDATE_ROUTE':
      return {
        ...state,
        routes: state.routes.map((route) => (route.id === action.payload.id ? action.payload : route)),
      }

    case 'UPDATE_SHIPMENT':
      return {
        ...state,
        shipments: state.shipments.map((shipment) =>
          shipment.id === action.payload.id ? action.payload : shipment,
        ),
      }

    case 'SHOW_SNACKBAR':
      return {
        ...state,
        snackbar: { open: true, ...action.payload },
      }

    case 'HIDE_SNACKBAR':
      return { ...state, snackbar: { ...state.snackbar, open: false } }

    default:
      return state
  }
}

export function useRepartidorState() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING', payload: loading })
  }, [])

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error })
  }, [])

  const setRoutes = useCallback((routes: Route[]) => {
    dispatch({ type: 'SET_ROUTES', payload: routes })
  }, [])

  const setShipments = useCallback((shipments: Shipment[]) => {
    dispatch({ type: 'SET_SHIPMENTS', payload: shipments })
  }, [])

  const updateRoute = useCallback((route: Route) => {
    dispatch({ type: 'UPDATE_ROUTE', payload: route })
  }, [])

  const updateShipment = useCallback((shipment: Shipment) => {
    dispatch({ type: 'UPDATE_SHIPMENT', payload: shipment })
  }, [])

  const showSnackbar = useCallback(
    (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
      dispatch({ type: 'SHOW_SNACKBAR', payload: { message, severity } })
    },
    [],
  )

  const hideSnackbar = useCallback(() => {
    dispatch({ type: 'HIDE_SNACKBAR' })
  }, [])

  const allShipmentsCompleted = useCallback(
    (route: Route): boolean => {
      const routeShipments = state.shipments.filter((shipment) => route.shipmentIds.includes(shipment.id))
      if (routeShipments.length === 0) return false

      return routeShipments.every(
        (shipment) => shipment.status === 'Entregado' || shipment.status === 'Cancelado',
      )
    },
    [state.shipments],
  )

  return {
    state,
    setLoading,
    setError,
    setRoutes,
    setShipments,
    updateRoute,
    updateShipment,
    showSnackbar,
    hideSnackbar,
    allShipmentsCompleted,
  }
}
