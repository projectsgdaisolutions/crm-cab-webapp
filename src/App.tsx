import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { NotFound } from '@/pages/NotFound'
import { ToastProvider } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import { AuthProvider, RequireAuth, RequireRole, useAuth } from '@/auth/AuthContext'
import type { AuthRole } from '@/auth/AuthContext'
import LoginPage from '@/features/auth/LoginPage'
import AccountSecurityPage from '@/features/auth/AccountSecurityPage'

// Lazy-load pages for better initial load perf
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage'))
const CustomerDetailPage = lazy(() => import('@/features/customers/CustomerDetailPage'))
const LeadsPage = lazy(() => import('@/features/leads/LeadsPage'))
const FollowUpsPage = lazy(() => import('@/features/followups/FollowUpsPage'))
const BookingsPage = lazy(() => import('@/features/bookings/BookingsPage'))
const CallsPage = lazy(() => import('@/features/calls/CallsPage'))
const RecordingsPage = lazy(() => import('@/features/recordings/RecordingsPage'))
const TasksPage = lazy(() => import('@/features/tasks/TasksPage'))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'))
const TeamPage = lazy(() => import('@/features/team/TeamPage'))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'))
const ResetPasswordPage = lazy(() => import('@/features/auth/ResetPasswordPage'))

function PageLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}

function DashboardRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'Admin' ? '/admin/dashboard' : '/executive/dashboard'} replace />
}

function ProtectedPage({ children, roles }: { children: React.ReactNode; roles: AuthRole[] }) {
  return (
    <RequireRole allowedRoles={roles}>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </RequireRole>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
            <Route path="/reset-password" element={<Suspense fallback={<PageLoader />}><ResetPasswordPage /></Suspense>} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardRedirect />} />
                <Route path="account/security" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><AccountSecurityPage /></ProtectedPage>} />
                <Route path="admin/dashboard" element={<ProtectedPage roles={['Admin']}><DashboardPage /></ProtectedPage>} />
                <Route path="executive/dashboard" element={<ProtectedPage roles={['Calling Executive']}><DashboardPage /></ProtectedPage>} />

                <Route path="customers" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><CustomersPage /></ProtectedPage>} />
                <Route path="customers/:id" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><CustomerDetailPage /></ProtectedPage>} />
                <Route path="leads" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><LeadsPage /></ProtectedPage>} />
                <Route path="followups" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><FollowUpsPage /></ProtectedPage>} />
                <Route path="bookings" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><BookingsPage /></ProtectedPage>} />
                <Route path="calls" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><CallsPage /></ProtectedPage>} />
                <Route path="recordings" element={<ProtectedPage roles={['Admin']}><RecordingsPage /></ProtectedPage>} />
                <Route path="tasks" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><TasksPage /></ProtectedPage>} />

                <Route path="reports" element={<ProtectedPage roles={['Admin']}><ReportsPage /></ProtectedPage>} />
                <Route path="team" element={<ProtectedPage roles={['Admin']}><TeamPage /></ProtectedPage>} />
                <Route path="settings" element={<ProtectedPage roles={['Admin', 'Calling Executive']}><SettingsPage /></ProtectedPage>} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
