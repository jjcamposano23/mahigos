import { useState } from 'react'
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
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

  const google = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      const code = (err as AuthError).code
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setError(friendlyError(code))
      }
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
            <Seal size={40} variant="white" />
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
            <Seal size={52} variant="auto" />
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

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={google}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface py-2.5 text-sm font-semibold text-ink transition hover:border-brand/40 disabled:opacity-60"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
                />
              </svg>
              Continue with Google
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
