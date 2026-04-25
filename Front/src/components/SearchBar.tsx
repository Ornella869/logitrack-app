import { useState } from 'react'
import { Box, TextField, Button, CircularProgress, Stack } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

interface SearchBarProps {
  onSearch: (query: string) => Promise<void>
  loading?: boolean
  placeholder?: string
}

function SearchBar({ onSearch, loading = false, placeholder = 'Buscar por ID de tracking...' }: SearchBarProps) {
  const [query, setQuery] = useState('')

  const handleInputChange = (value: string) => {
    const hadSearchValue = query.trim().length > 0
    setQuery(value)

    // If user manually erases the input, reset results like the "Limpiar" action.
    if (hadSearchValue && value.trim().length === 0) {
      void onSearch('')
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      await onSearch(query)
    }
  }

  const handleClear = () => {
    setQuery('')
    onSearch('')
  }

  return (
    <Box component="form" onSubmit={handleSearch} sx={{ mb: 3 }}>
      <Stack direction="row" spacing={1}>
        <TextField
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          fullWidth
          disabled={loading}
          size="small"
        />
        <Button
          variant="contained"
          type="submit"
          disabled={loading || !query.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : <SearchIcon />}
          sx={{ whiteSpace: 'nowrap' }}
        >
          Buscar
        </Button>
        {query && (
          <Button variant="outlined" onClick={handleClear} disabled={loading}>
            Limpiar
          </Button>
        )}
      </Stack>
    </Box>
  )
}

export default SearchBar
