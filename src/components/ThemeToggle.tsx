import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
      className={`grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted transition hover:text-brand hover:border-brand/40 ${className}`}
    >
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}
