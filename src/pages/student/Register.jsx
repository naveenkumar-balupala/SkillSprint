import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerStudent } from '../../services/studentService'
import { getAllBatches } from '../../services/batchService'
import { getActiveWorkshops, ensureDefaultWorkshops } from '../../services/workshopService'
import { getSettings } from '../../services/settingsService'
import Alert from '../../components/Alert'
import Loader from '../../components/Loader'

const BRANCHES = ['CSE', 'ISE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIML', 'BCA', 'MCA', 'MBA', 'Other']
const SECTIONS = ['A', 'B', 'C', 'D']

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    usn: '',
    email: '',
    phone: '',
    branch: 'CSE',
    section: 'A',
    batch: '',
    workshopId: '',
    workshopName: '',
    password: '',
    confirm: '',
  })
  const [batches, setBatches] = useState([])
  const [workshops, setWorkshops] = useState([])
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [regOpen, setRegOpen] = useState(null) // null = still loading the setting

  // Load batches, workshops, settings
  useEffect(() => {
    getAllBatches()
      .then((b) => setBatches(b))
      .catch(() => setBatches([]))

    getActiveWorkshops()
      .then(async (w) => {
        let list = w
        if (list.length === 0) {
          list = await ensureDefaultWorkshops()
        }
        setWorkshops(list)
        if (list.length > 0) {
          setForm((prev) => ({
            ...prev,
            workshopId: list[0].id,
            workshopName: list[0].name,
          }))
        }
      })
      .catch(() => setWorkshops([]))

    getSettings()
      .then((cfg) => setRegOpen(cfg.registrationOpen))
      .catch(() => setRegOpen(true))
  }, [])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleWorkshopChange = (e) => {
    const wid = e.target.value
    const wObj = workshops.find((w) => w.id === wid)
    setForm({
      ...form,
      workshopId: wid,
      workshopName: wObj ? wObj.name : '',
    })
  }

  const validate = () => {
    if (!form.name.trim()) return 'Full name is required.'
    if (!/^[A-Za-z0-9]+$/.test(form.usn.trim())) return 'Enter a valid USN / Roll number.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) return 'Enter a valid email address.'
    if (!/^\d{10}$/.test(form.phone.trim())) return 'Phone number must be 10 digits.'
    if (workshops.length > 0 && !form.workshopId) return 'Please select your workshop.'
    if (!form.batch.trim()) return 'Please select your batch.'
    if (form.password.length < 6) return 'Password must be at least 6 characters.'
    if (form.password !== form.confirm) return 'Passwords do not match.'
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    const v = validate()
    if (v) return setError(v)

    setLoading(true)
    try {
      await registerStudent(form)
      setSuccess('Registration successful! Redirecting to login…')
      setTimeout(() => navigate('/login'), 1500)
    } catch (err) {
      // Friendly messages for common Firebase Auth errors.
      const map = {
        'auth/email-already-in-use': 'This email is already registered. Please login.',
        'auth/invalid-email': 'Invalid email address.',
        'auth/weak-password': 'Password is too weak (min 6 characters).',
      }
      setError(map[err.code] || err.message)
    } finally {
      setLoading(false)
    }
  }

  if (regOpen === null) return <Loader message="Loading…" />

  if (regOpen === false)
    return (
      <div className="mx-auto max-w-xl card text-center">
        <h1 className="text-2xl font-bold text-slate-800">Registration Closed</h1>
        <p className="mt-2 text-sm text-slate-500">
          Student self-registration is currently turned off. Please contact your admin to get an account,
          then sign in.
        </p>
        <Link to="/login" className="btn-primary mt-5">Go to Login</Link>
      </div>
    )

  return (
    <div className="mx-auto max-w-xl">
      <div className="card">
        <h1 className="text-2xl font-bold text-slate-800">Student Registration</h1>
        <p className="mt-1 text-sm text-slate-500">Register once to access tests for your workshop.</p>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={set('name')} placeholder="Jane Doe" />
          </div>
          <div>
            <label className="label">USN / Roll Number</label>
            <input className="input" value={form.usn} onChange={set('usn')} placeholder="1XX21CS001" />
          </div>
          <div>
            <label className="label">Phone Number</label>
            <input className="input" value={form.phone} onChange={set('phone')} placeholder="9876543210" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email ID</label>
            <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" />
          </div>

          <div className="sm:col-span-2">
            <label className="label">Workshop Enrolled</label>
            <select
              className="input"
              value={form.workshopId}
              onChange={handleWorkshopChange}
              disabled={workshops.length === 0}
            >
              <option value="">{workshops.length === 0 ? 'No workshops available — contact admin' : 'Select your workshop'}</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code || 'CODE'}) · {w.durationDays || 6} Days
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Branch</label>
            <select className="input" value={form.branch} onChange={set('branch')}>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Section</label>
            <select className="input" value={form.section} onChange={set('section')}>
              {SECTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Batch</label>
            <select className="input" value={form.batch} onChange={set('batch')} disabled={batches.length === 0}>
              <option value="">{batches.length === 0 ? 'No batches available — contact admin' : 'Select your batch'}</option>
              {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            {batches.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                You can register once your admin has created a batch.
              </p>
            )}
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={set('password')} />
          </div>
          <div>
            <label className="label">Confirm Password</label>
            <input className="input" type="password" value={form.confirm} onChange={set('confirm')} />
          </div>

          <div className="sm:col-span-2 space-y-3">
            <Alert type="error">{error}</Alert>
            <Alert type="success">{success}</Alert>
            <button className="btn-primary w-full" disabled={loading}>
              {loading ? 'Registering…' : 'Register'}
            </button>
            <p className="text-center text-sm text-slate-500">
              Already registered? <Link to="/login" className="font-semibold text-brand">Login here</Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
