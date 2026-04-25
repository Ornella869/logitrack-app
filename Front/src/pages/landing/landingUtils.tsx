import { useState, useEffect, useRef } from 'react'
import { Box } from '@mui/material'

// ─── Animated Counter ─────────────────────────────────────────────────────────
export function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !started.current) {
          started.current = true
          let cur = 0
          const inc = target / 60
          const t = setInterval(() => {
            cur += inc
            if (cur >= target) {
              setCount(target)
              clearInterval(t)
            } else {
              setCount(Math.floor(cur))
            }
          }, 2000 / 60)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [target])

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  )
}

// ─── Scroll Reveal Hook ───────────────────────────────────────────────────────
export function useReveal(delay = 0) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setTimeout(() => setVisible(true), delay)
      },
      { threshold: 0.08 }
    )
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [delay])

  return { ref, visible }
}

// ─── Reveal wrapper ───────────────────────────────────────────────────────────
export function RevealBox({
  children,
  delay = 0,
  direction = 'up',
}: {
  children: React.ReactNode
  delay?: number
  direction?: 'up' | 'left' | 'right'
}) {
  const { ref, visible } = useReveal(delay)
  const fromTransform =
    direction === 'up'
      ? 'translateY(32px)'
      : direction === 'left'
      ? 'translateX(-32px)'
      : 'translateX(32px)'

  return (
    <Box
      ref={ref}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate(0,0)' : fromTransform,
        transition: 'opacity 0.65s ease, transform 0.65s ease',
      }}
    >
      {children}
    </Box>
  )
}
