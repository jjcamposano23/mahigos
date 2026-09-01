import { useState } from 'react'
import { updatePassword, type AuthError } from 'firebase/auth'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

export function Settings() {
  const { profile, user } = useAuth()
  const { theme, toggle } = useTheme()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const changePw = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (pw.length < 8) return setMsg({ type: 'err', text: 'Use at least 8 characters.' })
    if (pw !== pw2) return setMsg({ type: 'err', text: 'Passwords do not match.' })
    try {
      await updatePassword(user!, pw)
      setPw('')
      setPw2('')
      setMsg({ type: 'ok', text: 'Password updated.' })
    } catch (err) {
      const code = (err as AuthError).code
      setMsg({
        type: 'err',
        text:
          code === 'auth/requires-recent-login'
            ? 'Please sign out and back in, then try again.'
            : 'Could not update password.',
      })
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Profile</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Name</dt>
            <dd className="font-medium text-ink">{profile?.displayName}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Email</dt>
            <dd className="font-medium text-ink">{profile?.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Role</dt>
            <dd className="font-medium capitalize text-ink">{profile?.role}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Appearance</h2>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-muted">Theme</span>
          <button
            onClick={toggle}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium capitalize text-ink transition hover:border-brand/40"
          >
            {theme}
          </button>
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Change password</h2>
        <form onSubmit={changePw} className="mt-3 space-y-3">
          <input
            type="password"
            placeholder="New password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          />
          {msg && (
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.type === 'ok'
                  ? 'border border-ok/40 bg-ok/10 text-ok'
                  : 'border border-brand/30 bg-brand-soft text-brand-ink'
              }`}
            >
              {msg.text}
            </div>
          )}
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-ink"
          >
            Update password
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-ink">About</h2>
        <p className="mt-2 text-sm text-muted">
          Mahigos is the collaboration workspace of the UP Ibalon Alumni Association, Inc.
        </p>
        <p className="mt-2 text-xs text-muted">
          Mayon Volcano photo by ShmilyDigital, via Wikimedia Commons (CC BY-SA 4.0).
        </p>
      </section>
    </div>
  )
}
