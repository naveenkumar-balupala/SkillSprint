import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getSettings } from '../services/settingsService'
import { getActiveWorkshops } from '../services/workshopService'
import Logo from '../components/Logo'

export default function Home() {
  const { user, role } = useAuth()
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [workshops, setWorkshops] = useState([])

  useEffect(() => {
    getSettings().then((c) => setRegistrationOpen(c.registrationOpen)).catch(() => {})
    getActiveWorkshops().then(setWorkshops).catch(() => {})
  }, [])

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 p-10 text-white shadow-lg">
        <Logo variant="light" className="text-5xl" />
        <h1 className="mt-5 text-3xl font-extrabold sm:text-4xl">SkillSprint</h1>
        <p className="mt-3 max-w-2xl text-slate-300">
          Comprehensive online assessment platform for conducting Pre-Assessments, Day-wise Tests, and Grand Tests across multiple technical workshops.
          Register once, attempt tests securely, and receive instant performance analytics.
        </p>

        {workshops.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active Workshops:
            </span>
            {workshops.map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center rounded-md bg-white/10 px-2.5 py-1 text-xs font-medium text-white backdrop-blur border border-white/20"
              >
                {w.name} ({w.durationDays || 6} Days)
              </span>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {user ? (
            <Link to={role === 'admin' ? '/admin' : '/dashboard'} className="btn-primary">
              Go to {role === 'admin' ? 'Admin Dashboard' : 'My Dashboard'}
            </Link>
          ) : (
            <>
              {registrationOpen && <Link to="/register" className="btn-primary">Register</Link>}
              <Link to="/login" className={registrationOpen ? 'btn-secondary' : 'btn-primary'}>Student Login</Link>
              <Link to="/admin/login" className="btn-secondary">Admin Login</Link>
            </>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { t: 'Pre-Assessment', d: 'Evaluate baseline knowledge and skill level before the workshop begins.' },
          { t: 'Day-wise Tests', d: 'Daily focused tests matching the specific curriculum covered each day.' },
          { t: 'Grand Test', d: 'Comprehensive full-syllabus final assessment to measure mastery.' },
        ].map((c) => (
          <div key={c.t} className="card">
            <h3 className="font-semibold text-slate-800">{c.t}</h3>
            <p className="mt-1 text-sm text-slate-500">{c.d}</p>
          </div>
        ))}
      </section>
    </div>
  )
}
