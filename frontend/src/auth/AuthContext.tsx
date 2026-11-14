import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { apiClient } from '@/services/apiClient'
import { setCsrfToken } from '@/services/csrf'

export type AuthRole = 'Admin' | 'Calling Executive'

export interface AuthUser {
  id: string
  name: string
  email: string
  phone: string | null
  role: AuthRole
  timezone?: string
  bio?: string | null
}

interface ApiUser extends Omit<AuthUser, 'id' | 'role'> {
  id: string | number
  role: 'admin' | 'executive' | string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (identifier: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  updateProfile: (profile: { name: string; email: string; phone: string; timezone: string; bio: string }) => Promise<AuthUser>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapUser(user: ApiUser): AuthUser {
  if (user.role === 'admin') {
    return { ...user, id: String(user.id), role: 'Admin' }
  }

  if (user.role === 'executive') {
    return { ...user, id: String(user.id), role: 'Calling Executive' }
  }

  throw new Error('This account does not have access to this application.')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const handleUnauthorized = () => {
      setUser(null)
      setCsrfToken('')
    }
    window.addEventListener('gdai:unauthorized', handleUnauthorized)

    apiClient.get<{ user: ApiUser; csrfToken: string }>('/auth/me.php')
      .then(({ data }) => {
        if (active) {
          setUser(mapUser(data.user))
          setCsrfToken(data.csrfToken)
        }
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      window.removeEventListener('gdai:unauthorized', handleUnauthorized)
    }
  }, [])

  const login = async (identifier: string, password: string) => {
    const { data } = await apiClient.post<{ user: ApiUser; csrfToken: string }>('/auth/login.php', {
      identifier,
      password,
    })
    const authenticatedUser = mapUser(data.user)
    setUser(authenticatedUser)
    setCsrfToken(data.csrfToken)
    return authenticatedUser
  }

  const logout = async () => {
    await apiClient.post('/auth/logout.php')
    setUser(null)
    setCsrfToken('')
  }

  const updateProfile = async (profile: { name: string; email: string; phone: string; timezone: string; bio: string }) => {
    const { data } = await apiClient.put<{ user: ApiUser }>('/auth/profile.php', profile)
    const updatedUser = mapUser(data.user)
    setUser(updatedUser)
    return updatedUser
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Checking your session...</div>
  }

  return user
    ? <Outlet />
    : <Navigate to="/login" replace state={{ from: location.pathname }} />
}

export function RequireRole({ allowedRoles, children }: { allowedRoles: AuthRole[]; children?: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-sm text-slate-500">Checking your session...</div>
  }

  if (!user) return <Navigate to="/login" replace />
  return allowedRoles.includes(user.role) ? <>{children ?? <Outlet />}</> : <Navigate to="/" replace />
}