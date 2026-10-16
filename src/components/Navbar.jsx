import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import ToriiMark from './ToriiMark'

export default function Navbar() {
  const { user, role, profile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/profile', label: 'Profile' },
  ]
  const adminLinks = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/workshops', label: 'Workshops' },
    { to: '/admin/students', label: 'Students' },
    { to: '/admin/questions', label: 'Questions' },
    { to: '/admin/tests', label: 'Tests' },
    { to: '/admin/results', label: 'Results' },
    { to: '/admin/statistics', label: 'Statistics' },
    { to: '/admin/export', label: 'Export' },
  ]
  const links = role === 'admin' ? adminLinks : role === 'student' ? studentLinks : []

  return (
    <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-black">
            <ToriiMark className="h-7 w-7" stem="#ffffff" />
          </span>
          <span className="hidden items-baseline gap-2 sm:flex">
            <span className="text-lg font-extrabold tracking-tight text-slate-800">TORII</span>
            <span className="text-xs font-medium text-slate-400">Assessment Platform</span>
          </span>
        </Link>

        {links.length > 0 && (
          <nav className="flex flex-wrap items-center gap-1 overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/admin'}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium ${
                    isActive ? 'bg-brand/10 text-brand' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden text-sm text-slate-500 md:block">
                {profile?.name || user.email} {role === 'admin' && '(Admin)'}
              </span>
              <button onClick={handleLogout} className="btn-secondary">Logout</button>
            </>
          ) : (
            <Link to="/login" className="btn-primary">Login</Link>
          )}
        </div>
      </div>
    </header>
  )
}
