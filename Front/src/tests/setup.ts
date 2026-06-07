import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { vi } from 'vitest'
import { afterEach } from 'vitest'

const storage: Record<string, string> = {}

afterEach(() => {
  cleanup()
})

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

if (typeof window.localStorage === 'undefined' || typeof window.localStorage.clear !== 'function') {
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = String(value)
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
      clear: () => {
        for (const key of Object.keys(storage)) {
          delete storage[key]
        }
      },
    },
    configurable: true,
  })
}
