import { Link } from 'react-router-dom'
import { Home, Compass } from 'lucide-react'

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full text-center">
        <div className="relative inline-block mb-6">
          <p className="text-8xl font-bold text-navy-900 leading-none">404</p>
          <div className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-teal-500 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Page not found</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved. Let's get you back on track.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-navy-900 text-white text-sm font-medium hover:bg-navy-800 shadow-soft"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <Link
            to="/customers"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            <Compass className="h-4 w-4" />
            Explore
          </Link>
        </div>
      </div>
    </div>
  )
}
