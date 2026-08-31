import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import type { UserProfile } from '../lib/types'

interface AuthCtx {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  logout: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const ref = doc(db, 'users', u.uid)
        const snap = await getDoc(ref)
        if (snap.exists()) {
          setProfile({ uid: u.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) })
        } else {
          // Bootstrap a profile the first time a user signs in
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

  return <Ctx.Provider value={{ user, profile, loading, logout }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx)
