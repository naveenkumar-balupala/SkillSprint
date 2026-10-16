import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createDefaultTestsForWorkshop, createTest } from '../../services/testService'
import { ensureDefaultWorkshops, getAllWorkshops } from '../../services/workshopService'
import Alert from '../../components/Alert'

const TEST_TYPES = ['Pre-Assessment', 'Day-wise Test', 'Grand Test']

export default function CreateTest() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialWorkshopId = searchParams.get('workshopId') || ''

  const [workshops, setWorkshops] = useState([])
  const [form, setForm] = useState({
    workshopId: initialWorkshopId,
    testTitle: '',
    testType: 'Pre-Assessment',
    duration: 30,
    totalQuestions: 30,
    dayNumber: 1,
    isActive: true,
  })
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        let list = await getAllWorkshops()
        if (list.length === 0) {
          list = await ensureDefaultWorkshops()
        }
        setWorkshops(list)
        if (!form.workshopId && list.length > 0) {
          const match = list.find((w) => w.id === initialWorkshopId) || list[0]
          setForm((prev) => ({ ...prev, workshopId: match.id }))
        }
      } catch (err) {
        setMsg({ type: 'error', text: err.message })
      } finally {
        setLoading(false)
      }
    })()
  }, [initialWorkshopId])

  const selectedWorkshop = workshops.find((w) => w.id === form.workshopId) || workshops[0]
  const maxDays = selectedWorkshop?.durationDays || 6

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.testTitle.trim()) return setMsg({ type: 'error', text: 'Enter a test title.' })

    const workshopName = selectedWorkshop ? selectedWorkshop.name : ''

    try {
      await createTest({
        workshopId: form.workshopId || null,
        workshopName,
        testTitle: form.testTitle.trim(),
        testType: form.testType,
        duration: Number(form.duration),
        totalQuestions: Number(form.totalQuestions) || 30,
        dayNumber: form.testType === 'Day-wise Test' ? Number(form.dayNumber) : null,
        isActive: !!form.isActive,
      })
      setMsg({ type: 'success', text: 'Test created. Redirecting…' })
      setTimeout(() => navigate('/admin/tests'), 1000)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const seedDefaults = async () => {
    if (!selectedWorkshop) {
      return setMsg({ type: 'error', text: 'Please select a workshop first.' })
    }
    setMsg({ type: 'info', text: `Creating standard tests for "${selectedWorkshop.name}"…` })
    try {
      const count = await createDefaultTestsForWorkshop(selectedWorkshop)
      setMsg({ type: 'success', text: `Created ${count} tests for ${selectedWorkshop.name}. Redirecting…` })
      setTimeout(() => navigate('/admin/tests'), 1200)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Create Test</h1>
        <button
          className="btn-secondary"
          onClick={seedDefaults}
          disabled={!selectedWorkshop || loading}
          title="Creates Pre-Assessment, Day 1..N, and Grand Test for the selected workshop"
        >
          ⚡ Auto-Generate Workshop Suite
        </button>
      </div>

      {msg.text && (
        <div className="mb-4">
          <Alert
            type={msg.type}
            onClose={() => setMsg({ type: '', text: '' })}
            autoCloseMs={msg.type === 'error' ? undefined : 5000}
          >
            {msg.text}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card grid gap-4">
        <div>
          <label className="label">Workshop</label>
          <select
            className="input"
            value={form.workshopId}
            onChange={(e) => setForm({ ...form, workshopId: e.target.value })}
            disabled={workshops.length === 0}
          >
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.code || 'CODE'}) · {w.durationDays || 6} days
              </option>
            ))}
          </select>
          {selectedWorkshop && (
            <p className="mt-1 text-xs text-slate-400">
              This test will belong to <b>{selectedWorkshop.name}</b>.
            </p>
          )}
        </div>

        <div>
          <label className="label">Test Title</label>
          <input
            className="input"
            value={form.testTitle}
            onChange={set('testTitle')}
            placeholder="e.g. Day 1 — Foundations & Core Concepts"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Test Type</label>
            <select className="input" value={form.testType} onChange={set('testType')}>
              {TEST_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Day Number (Max {maxDays})</label>
            <input
              className="input"
              type="number"
              min={1}
              max={maxDays}
              disabled={form.testType !== 'Day-wise Test'}
              value={form.dayNumber}
              onChange={set('dayNumber')}
            />
          </div>
          <div>
            <label className="label">Duration (minutes)</label>
            <input className="input" type="number" min={1} value={form.duration} onChange={set('duration')} />
          </div>
          <div>
            <label className="label">Number of Questions</label>
            <input
              className="input"
              type="number"
              min={1}
              value={form.totalQuestions}
              onChange={set('totalQuestions')}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active (visible to students for this workshop)
        </label>

        <button className="btn-primary" disabled={loading}>
          Create Test
        </button>
      </form>
    </div>
  )
}
