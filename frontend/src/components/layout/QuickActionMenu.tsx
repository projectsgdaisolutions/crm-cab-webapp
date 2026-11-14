import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { X, UserPlus, CalendarClock, Car, CheckSquare, Phone } from 'lucide-react'

interface QuickActionMenuProps {
  open: boolean
  onClose: () => void
}

const actions = [
  { label: 'Add Customer', icon: UserPlus, to: '/customers?new=1', desc: 'Create a customer profile' },
  { label: 'Schedule Follow-up', icon: CalendarClock, to: '/followups?new=1', desc: 'Plan a follow-up call' },
  { label: 'New Booking', icon: Car, to: '/bookings?new=1', desc: 'Create a cab booking' },
  { label: 'Create Task', icon: CheckSquare, to: '/tasks?new=1', desc: 'Add a task' },
  { label: 'Log Call Note', icon: Phone, to: '/calls', desc: 'Reference a call activity' },
]

export function QuickActionMenu({ open, onClose }: QuickActionMenuProps) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="print-hide fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-navy-950/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ type: 'spring', duration: 0.3, bounce: 0.1 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-elevated border border-slate-200 overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Quick Action</h3>
                <p className="text-xs text-slate-500 mt-0.5">Pick what you'd like to do</p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-3">
              {actions.map(({ label, icon: Icon, to, desc }) => (
                <Link
                  key={label}
                  to={to}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
