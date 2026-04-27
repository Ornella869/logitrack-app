import { useState, useRef, useEffect } from 'react'
import { Box, TextField, Button, CircularProgress, Stack, InputAdornment } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

const DEBOUNCE_MS = 500

interface SearchBarProps {
  onSearch: (query: string) => Promise<void>
  loading?: boolean
  placeholder?: string
}

function SearchBar({
  onSearch,
  loading = false,
  placeholder = 'Buscar por tracking ID, remitente o destinatario…',
}: SearchBarProps) {
  const [query, setQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const handleInputChange = (value: string) => {
    setQuery(value)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Limpiar: reset inmediato sin esperar el debounce
    if (!value.trim()) {
      void onSearch('')
      return
    }

    // Búsqueda en tiempo real con pausa de escritura
    debounceRef.current = setTimeout(() => {
      void onSearch(value)
    }, DEBOUNCE_MS)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim()) await onSearch(query)
  }

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setQuery('')
    void onSearch('')
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1}>
        <TextField
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          fullWidth
          size="small"
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                {loading ? (
                  <CircularProgress size={16} />
                ) : (
                  <SearchIcon fontSize="small" color="action" />
                )}
              </InputAdornment>
            ),
          }}
        />
        {query && (
          <Button variant="outlined" onClick={handleClear}>
            Limpiar
          </Button>
        )}
      </Stack>
    </Box>
  )
}

export default SearchBar
