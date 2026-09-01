import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { isAllowedEmail } from '../lib/access'
import type { UserProfile } from '../lib/types'

interface AuthCtx {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  authError: string | null
  clearAuthError: () => void
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  authError: null,
  clearAuthError: () => {},
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      // Enforce the sign-in allowlist.
      if (u && !isAllowedEmail(u.email)) {
        setAuthError(
          'This account is not authorized for Mahigos. Access is limited to UP Ibalon Alumni Association members.',
        )
        await signOut(auth)
        setUser(null)
        setProfile(null)
        setLoading(false)
        return
      }

      setUser(u)
      if (u) {
        setAuthError(null)
        const ref = doc(db, 'users', u.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          setProfile({ uid: u.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) })
        } else {
          const fresh: Omit<UserProfile, 'createdAt'> = {
            uid: u.uid,
            email: u.email ?? '',
            displayName: u.displayName ?? (u.email?.split('@')[0] ?? 'Member'),
            role: 'member',
          }
          await setDoc(ref, { ...fresh, createdAt: serverTimestamp() }, { merge: true })
          setProfile(fresh as UserProfile)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
  }, [])

  const logout = async () => {
    await signOut(auth)
  }

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        clearAuthError: () => setAuthError(null),
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx)
