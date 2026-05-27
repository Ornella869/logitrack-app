import L from 'leaflet'

const BRANCH_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
  <!-- Sombra -->
  <ellipse cx="20" cy="48" rx="7" ry="2.5" fill="rgba(0,0,0,0.22)"/>
  <!-- Borde exterior del pin -->
  <path d="M20 1C12.27 1 6 7.27 6 15c0 11.5 14 34 14 34S34 26.5 34 15C34 7.27 27.73 1 20 1z" fill="#01579B"/>
  <!-- Cuerpo del pin -->
  <path d="M20 3.5C13.65 3.5 8.5 8.65 8.5 15c0 10.5 11.5 30 11.5 30S31.5 25.5 31.5 15C31.5 8.65 26.35 3.5 20 3.5z" fill="#0288D1"/>
  <!-- Círculo blanco interior -->
  <circle cx="20" cy="15" r="10" fill="white"/>
  <!-- Techo triangular -->
  <polygon points="20,7 11,14 29,14" fill="#01579B"/>
  <!-- Cuerpo del edificio -->
  <rect x="12" y="14" width="16" height="9" fill="#0277BD"/>
  <!-- Puerta central -->
  <rect x="18" y="18" width="4" height="5" rx="0.5" fill="white"/>
  <!-- Ventana izquierda -->
  <rect x="13.5" y="15.5" width="3" height="2.5" rx="0.4" fill="rgba(255,255,255,0.9)"/>
  <!-- Ventana derecha -->
  <rect x="23.5" y="15.5" width="3" height="2.5" rx="0.4" fill="rgba(255,255,255,0.9)"/>
  <!-- Línea de suelo -->
  <rect x="11" y="23" width="18" height="0.8" rx="0.4" fill="#01579B"/>
</svg>
`

export const branchMarkerIcon = L.divIcon({
  className: '',
  html: BRANCH_SVG,
  iconSize: [40, 50],
  iconAnchor: [20, 50],
  tooltipAnchor: [0, -50],
})
