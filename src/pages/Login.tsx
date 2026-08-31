import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  type AuthError,
} from 'firebase/auth'
import { auth } from '../lib/firebase'
import { Seal } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'
import { Butanding, Mayon } from '../components/BicolMotifs'

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/invalid-email':
      return 'That email address looks invalid.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/operation-not-allowed':
      return 'Email sign-in is not enabled yet on this project.'
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.'
    default:
      return 'Sign-in failed. Please try again.'
  }
}

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      // AuthProvider + router handle redirect
    } catch (err) {
      setError(friendlyError((err as AuthError).code))
    } finally {
      setBusy(false)
    }
  }

  const reset = async () => {
    if (!email.trim()) {
      setError('Enter your email first, then tap “Forgot password”.')
      return
    }
    setError(null)
    try {
      await sendPasswordResetEmail(auth, email.trim())
      setNotice('Password reset link sent. Check your inbox.')
    } catch (err) {
      setError(friendlyError((err as AuthError).code))
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-brand lg:block">
        <div className="banig absolute inset-0 opacity-20" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <Seal size={40} className="text-white" />
            <span className="font-display text-2xl font-extrabold tracking-tight">Mahigos</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-4xl font-extrabold leading-tight">
              One workspace for the Ibalon mission.
            </h1>
            <p className="mt-4 text-white/85">
              Plan projects, track tasks, and collaborate — built for the UP Ibalon Alumni
              Association Office of the Secretary.
            </p>
          </div>
          <div className="flex items-center gap-6 text-white/70">
            <Mayon size={44} className="text-white/80" />
            <Butanding size={64} className="text-white/70" />
            <span className="text-xs uppercase tracking-[0.25em]">Est. 1974 &middot; Bikol</span>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-bg p-6">
        <div className="absolute right-4 top-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 flex flex-col items-center lg:hidden">
            <span className="text-brand">
              <Seal size={52} />
            </span>
            <div className="mt-2 font-display text-2xl font-extrabold text-ink">Mahigos</div>
          </div>

          <h2 className="font-display text-2xl font-bold text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-muted">Sign in to your Mahigos workspace.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-ink">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/25"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-brand/30 bg-brand-soft px-3 py-2 text-sm text-brand-ink">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">
                {notice}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white transition hover:bg-brand-ink disabled:opacity-60"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={reset}
              className="w-full text-center text-xs font-medium text-muted transition hover:text-brand"
            >
              Forgot password?
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-muted">
            UP Ibalon Alumni Association, Inc. &middot; Office of the Secretary
          </p>
        </div>
      </div>
    </div>
  )
}
