import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'

const theme = createTheme({
  palette: {
    primary: {
      main: '#0288D1',      // sky-blue / celeste
      light: '#29B6F6',
      dark: '#0277BD',
      contrastText: '#fff',
    },
    secondary: {
      main: '#F57C00',
      light: '#FFB74D',
      dark: '#E65100',
      contrastText: '#fff',
    },
    success: {
      main: '#2E7D32',
      light: '#4CAF50',
      dark: '#1B5E20',
    },
    error: {
      main: '#C62828',
      light: '#EF5350',
      dark: '#B71C1C',
    },
    warning: {
      main: '#F57F17',
      light: '#FFB300',
      dark: '#E65100',
    },
    info: {
      main: '#0288D1',
      light: '#29B6F6',
      dark: '#0277BD',
    },
    background: {
      default: '#E8F4FD',   // very light celeste tint for the page background
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1A2027',
      secondary: '#546E7A',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700 },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 10,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 20px',
          minHeight: 40,
        },
        sizeSmall: {
          padding: '6px 14px',
          minHeight: 36,
        },
        sizeLarge: {
          padding: '12px 28px',
          minHeight: 48,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          // Override the global Paper borderRadius so AppBar has no rounded corners
          borderRadius: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 600,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          backgroundColor: '#F0F8FF',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 14,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
        },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
