import { useRef, useState } from 'react'
import { updatePassword, type AuthError } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Upload, Check } from 'lucide-react'
import { storage } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Avatar, AVATAR_PRESETS } from '../components/Avatar'

export function Settings() {
  const { profile, user, updateProfile } = useAuth()
  const { theme, toggle } = useTheme()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const pickPreset = async (id: string) => {
    setAvatarMsg(null)
    await updateProfile({ avatar: id, photoURL: '' })
  }

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) {
      setAvatarMsg('Please choose an image under 5 MB.')
      return
    }
    setUploading(true)
    setAvatarMsg(null)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const r = storageRef(storage, `avatars/${user.uid}/photo.${ext}`)
      await uploadBytes(r, file)
      const url = await getDownloadURL(r)
      await updateProfile({ photoURL: url, avatar: '' })
      setAvatarMsg('Photo updated.')
    } catch {
      setAvatarMsg('Upload failed — you can still pick a Bicol avatar below.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>

      {/* Avatar */}
      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-semibold text-ink">Avatar</h2>
        <p className="mt-1 text-sm text-muted">
          Pick a Bicol icon or upload your own photo.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <Avatar profile={profile} size={64} rounded="rounded-2xl" />
          <div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition hover:border-brand/40 disabled:opacity-60"
            >
              <Upload size={15} /> {uploading ? 'Uploading…' : 'Upload photo'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onUpload}
              className="hidden"
            />
            {avatarMsg && <p className="mt-1.5 text-xs text-muted">{avatarMsg}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {AVATAR_PRESETS.map((p) => {
            const active = profile?.avatar === p.id && !profile?.photoURL
            return (
              <button
                key={p.id}
                onClick={() => pickPreset(p.id)}
                title={p.label}
                className={`relative rounded-xl border-2 p-0.5 transition hover:scale-105 ${
                  active ? 'border-brand' : 'border-transparent hover:border-border'
                }`}
              >
                <Avatar profile={{ avatar: p.id }} size={48} rounded="rounded-lg" />
                {active && (
                  <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-brand text-white">
                    <Check size={11} />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </section>

      {/* Profile */}
      <section className="mt-4 rounded-xl border border-border bg-surface p-5">
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

      {/* Appearance */}
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

      {/* Password */}
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
          Bicol photos via Wikimedia Commons — Mayon by ShmilyDigital (CC BY-SA 4.0), Butanding by
          Shubert Ciencia (CC BY 2.0), Peñafrancia Basilica by Ralff Nestor Nacor (CC BY-SA 4.0).
        </p>
      </section>
    </div>
  )
}
