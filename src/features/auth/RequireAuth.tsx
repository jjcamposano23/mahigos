import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { LoadingScreen } from '../../components/LoadingScreen'

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
