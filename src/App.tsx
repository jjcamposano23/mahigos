import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Video } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { LoadingScreen } from './components/LoadingScreen'
import { RequireAuth } from './features/auth/RequireAuth'
import { AppShell } from './features/layout/AppShell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Tasks } from './pages/Tasks'
import { Calendar } from './pages/Calendar'
import { Team } from './pages/Team'
import { Messages } from './pages/Messages'
import { Documents } from './pages/Documents'
import { Whiteboard } from './pages/Whiteboard'
import { Settings } from './pages/Settings'
import { ComingSoon } from './pages/ComingSoon'

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/team" element={<Team />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/files" element={<Documents />} />
          <Route path="/docs" element={<Navigate to="/files" replace />} />
          <Route path="/whiteboard" element={<Whiteboard />} />
          <Route
            path="/calls"
            element={
              <ComingSoon
                title="Calls"
                icon={Video}
                phase="Phase 5"
                blurb="Video and audio meetings powered by the UPIAA OSEC Zoom account, launched right inside Mahigos."
              />
            }
          />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
