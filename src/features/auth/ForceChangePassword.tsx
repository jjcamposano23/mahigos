import { useState } from 'react'
import { updatePassword, type AuthError } from 'firebase/auth'
import { Seal } from '../../components/Logo'
import { useAuth } from '../../context/AuthContext'

/**
 * Shown once on first login when profile.mustChangePassword is set.
 * Password users set a new password; Google users just acknowledge.
 */
export function ForceChangePassword() {
  const { user, updateProfile, logout } = useAuth()
  const isPassword = user?.providerData.some((p) => p.providerId === 'password') ?? false
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (pw.length < 8) return setError('Use at least 8 characters.')
    if (pw !== pw2) return setError('Passwords do not match.')
    setBusy(true)
    try {
      await updatePassword(user!, pw)
      await updateProfile({ mustChangePassword: false })
    } catch (err) {
      const code = (err as AuthError).code
      setError(
        code === 'auth/requires-recent-login'
          ? 'For security, please sign out and sign in again, then set your password.'
          : 'Could not update password. Please try again.',
      )
      setBusy(false)
    }
  }

  const acknowledge = async () => {
    setBusy(true)
    await updateProfile({ mustChangePassword: false })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg p-6">
      <div className="banig pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative w-full max-w-sm animate-rise rounded-2xl border border-border bg-surface p-6 shadow-xl">
        <div className="mb-4 flex flex-col items-center text-center">
          <Seal size={44} variant="auto" />
          <h1 className="mt-3 font-display text-xl font-bold text-ink">
            {isPassword ? 'Set your password' : 'Welcome to Mahigos'}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isPassword
              ? 'Please choose a new password to secure your account.'
              : "You're signed in with Google — no password needed."}
          </p>
        </div>

        {isPassword ? (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              autoFocus
              autoComplete="new-password"
              placeholder="New password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
            />
            {error && (
              <div className="rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-ink">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save password & continue'}
            </button>
          </form>
        ) : (
          <button
            onClick={acknowledge}
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-60"
          >
            {busy ? 'Continuing…' : 'Continue to workspace'}
          </button>
        )}

        <button
          onClick={logout}
          className="mt-3 w-full text-center text-xs font-medium text-muted transition hover:text-brand"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
