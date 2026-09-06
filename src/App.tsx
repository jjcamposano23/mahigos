import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
import { Calls } from './pages/Calls'
import { Meetings } from './pages/Meetings'
import { MahigosAI } from './pages/MahigosAI'
import { Settings } from './pages/Settings'

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
          <Route path="/meetings" element={<Meetings />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/ai" element={<MahigosAI />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
