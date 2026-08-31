import { createContext, useCallback, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'
interface ThemeCtx {
  theme: Theme
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ theme: 'light', toggle: () => {} })

function initial(): Theme {
  try {
    const t = localStorage.getItem('mahigos-theme')
    if (t === 'dark' || t === 'light') return t
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  } catch {
    /* ignore */
  }
  return 'light'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem('mahigos-theme', theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(Ctx)
