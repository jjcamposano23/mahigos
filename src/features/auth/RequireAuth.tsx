import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LoadingScreen } from '../../components/LoadingScreen'
import { ForceChangePassword } from './ForceChangePassword'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (profile?.mustChangePassword) return <ForceChangePassword />
  return <>{children}</>
}
