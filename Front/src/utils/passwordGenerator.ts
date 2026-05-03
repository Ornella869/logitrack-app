// Genera una contraseña temporal fácil de transcribir verbalmente:
// - 10 caracteres
// - sin caracteres ambiguos (0/O, 1/l/I)
// - garantiza al menos 1 mayúscula, 1 minúscula y 1 número
// La idea es que el admin se la pueda dictar al usuario sin confusiones.

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ' // sin I, O
const LOWER = 'abcdefghjkmnpqrstuvwxyz' // sin i, l, o
const DIGITS = '23456789' // sin 0, 1
const ALL = UPPER + LOWER + DIGITS

const pick = (charset: string): string =>
  charset[Math.floor(Math.random() * charset.length)]

export function generateTempPassword(length = 10): string {
  if (length < 4) length = 4
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS)]
  const rest = Array.from({ length: length - required.length }, () => pick(ALL))
  const chars = [...required, ...rest]
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}
