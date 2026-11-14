import {
  LayoutDashboard, Users, UserPlus, CalendarClock, Car, Phone, Mic, CheckSquare,
  BarChart3, UsersRound, Settings,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AuthRole } from '@/auth/AuthContext'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  roles?: AuthRole[]
  badge?: string
  badgeTone?: 'danger' | 'warning' | 'info'
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Customers', to: '/customers', icon: Users },
  { label: 'Leads', to: '/leads', icon: UserPlus, badge: '8', badgeTone: 'info' },
  { label: 'Follow-ups', to: '/followups', icon: CalendarClock, badge: '5', badgeTone: 'danger' },
  { label: 'Bookings', to: '/bookings', icon: Car },
  { label: 'Call History', to: '/calls', icon: Phone },
  { label: 'Call Recordings', to: '/recordings', icon: Mic, roles: ['Admin'] },
  { label: 'Tasks', to: '/tasks', icon: CheckSquare, badge: '3', badgeTone: 'warning' },
  { label: 'Reports', to: '/reports', icon: BarChart3, roles: ['Admin'] },
  { label: 'Team / Users', to: '/team', icon: UsersRound, roles: ['Admin'] },
  { label: 'Settings', to: '/settings', icon: Settings, roles: ['Admin'] },
]
