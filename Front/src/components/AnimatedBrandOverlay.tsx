import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded'

const SESSION_KEY = 'lt_brand_intro_seen'

export default function AnimatedBrandOverlay() {
  const [visible, setVisible] = useState(() => !sessionStorage.getItem(SESSION_KEY))
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (!visible) return
    const fadeTimer = setTimeout(() => setFadeOut(true), 2200)
    const hideTimer = setTimeout(() => {
      setVisible(false)
      sessionStorage.setItem(SESSION_KEY, '1')
    }, 2700)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [visible])

  if (!visible) return null

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #04213E 0%, #0C5EA7 45%, #19A5F2 100%)',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.5s ease',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            animation: 'truckSlideIn 1s cubic-bezier(0.34,1.56,0.64,1) forwards',
            '@keyframes truckSlideIn': {
              '0%': { transform: 'translateX(-70px)', opacity: 0 },
              '65%': { transform: 'translateX(5px)', opacity: 1 },
              '100%': { transform: 'translateX(0)', opacity: 1 },
            },
          }}
        >
          <LocalShippingRoundedIcon sx={{ fontSize: 52, color: '#fff' }} />
        </Box>
        <Box sx={{ display: 'flex', overflow: 'visible' }}>
          {'LogiTrack'.split('').map((letra, i) => (
            <Typography
              key={i}
              component="span"
              sx={{
                fontSize: { xs: '2rem', sm: '2.4rem' },
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '-0.5px',
                lineHeight: 1,
                opacity: 0,
                display: 'inline-block',
                animation: 'letraAparecer 0.35s ease forwards',
                animationDelay: `${0.75 + i * 0.065}s`,
                '@keyframes letraAparecer': {
                  '0%': { opacity: 0, transform: 'translateY(10px)' },
                  '100%': { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              {letra}
            </Typography>
          ))}
        </Box>
      </Box>
      <Typography
        variant="body2"
        sx={{
          mt: 1,
          color: 'rgba(255,255,255,0)',
          animation: 'subtituloFade 0.6s ease forwards',
          animationDelay: '1.6s',
          '@keyframes subtituloFade': {
            to: { color: 'rgba(255,255,255,0.55)' },
          },
        }}
      >
        Sistema de Gestión de Envíos
      </Typography>
    </Box>
  )
}
