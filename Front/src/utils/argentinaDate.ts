export const ARGENTINA_TIME_ZONE = 'America/Argentina/Buenos_Aires'

export const dateOnly = (value: string) => value.split('T')[0]

export const dateOnlyForDisplay = (value: string) => new Date(`${dateOnly(value)}T12:00:00`)

export const formatArgentinaDateInput = (value: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ARGENTINA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const year = parts.find((p) => p.type === 'year')?.value ?? ''
  const month = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${year}-${month}-${day}`
}

export const addArgentinaDays = (days: number): string => {
  const base = dateOnlyForDisplay(formatArgentinaDateInput())
  base.setDate(base.getDate() + days)
  return formatArgentinaDateInput(base)
}

export const formatDateOnlyEs = (
  value: string,
  options?: Intl.DateTimeFormatOptions,
) => dateOnlyForDisplay(value).toLocaleDateString('es-AR', options)

export const isTodayArgentina = (value: string) => dateOnly(value) === formatArgentinaDateInput()

export const formatInstantArgentinaDate = (
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
) => new Date(value).toLocaleDateString('es-AR', { timeZone: ARGENTINA_TIME_ZONE, ...options })

export const formatInstantArgentinaTime = (
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
) => new Date(value).toLocaleTimeString('es-AR', { timeZone: ARGENTINA_TIME_ZONE, ...options })

export const formatInstantArgentina = (
  value: string | Date,
  options?: Intl.DateTimeFormatOptions,
) => new Date(value).toLocaleString('es-AR', { timeZone: ARGENTINA_TIME_ZONE, ...options })
