import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createWorkshop,
  deleteWorkshop,
  ensureDefaultWorkshops,
  getAllWorkshops,
  updateWorkshop,
} from '../../services/workshopService'
import { createDefaultTestsForWorkshop, getAllTests } from '../../services/testService'
import { getAllQuestions } from '../../services/questionService'
import { getAllAttempts } from '../../services/attemptService'
import Loader from '../../components/Loader'
import Alert from '../../components/Alert'
import ConfirmModal from '../../components/ConfirmModal'

const emptyForm = {
  name: '',
  code: '',
  description: '',
  durationDays: 6,
  isActive: true,
}

export default function ManageWorkshops() {
  const [workshops, setWorkshops] = useState([])
  const [tests, setTests] = useState([])
  const [questions, setQuestions] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [generatingForId, setGeneratingForId] = useState(null)

  const load = async () => {
    try {
      const [w, t, q, a] = await Promise.all([
        getAllWorkshops(),
        getAllTests(),
        getAllQuestions(),
        getAllAttempts(),
      ])
      setWorkshops(w)
      setTests(t)
      setQuestions(q)
      setAttempts(a)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Aggregate stats per workshop
  const workshopStats = useMemo(() => {
    const stats = {}
    workshops.forEach((w) => {
      stats[w.id] = { tests: 0, questions: 0, attempts: 0 }
    })

    tests.forEach((t) => {
      if (t.workshopId && stats[t.workshopId]) {
        stats[t.workshopId].tests++
      } else if (!t.workshopId) {
        // Map legacy tests to first/excel workshop if applicable
        const first = workshops[0]
        if (first && stats[first.id]) stats[first.id].tests++
      }
    })

    questions.forEach((q) => {
      if (q.workshopId && stats[q.workshopId]) {
        stats[q.workshopId].questions++
      } else if (!q.workshopId) {
        const first = workshops[0]
        if (first && stats[first.id]) stats[first.id].questions++
      }
    })

    attempts.forEach((a) => {
      if (a.workshopId && stats[a.workshopId]) {
        stats[a.workshopId].attempts++
      } else if (!a.workshopId) {
        const first = workshops[0]
        if (first && stats[first.id]) stats[first.id].attempts++
      }
    })

    return stats
  }, [workshops, tests, questions, attempts])

  const openCreate = () => {
    setForm(emptyForm)
    setEditId(null)
    setFormOpen(true)
  }

  const openEdit = (w) => {
    setForm({
      name: w.name,
      code: w.code || '',
      description: w.description || '',
      durationDays: w.durationDays || 6,
      isActive: w.isActive ?? true,
    })
    setEditId(w.id)
    setFormOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      return setMsg({ type: 'error', text: 'Workshop title is required.' })
    }

    try {
      if (editId) {
        await updateWorkshop(editId, form)
        setMsg({ type: 'success', text: 'Workshop updated successfully.' })
      } else {
        await createWorkshop(form)
        setMsg({ type: 'success', text: 'Workshop created successfully.' })
      }
      setFormOpen(false)
      setForm(emptyForm)
      setEditId(null)
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const toggleActive = async (w) => {
    const nextActive = !w.isActive
    setWorkshops((prev) =>
      prev.map((item) => (item.id === w.id ? { ...item, isActive: nextActive } : item))
    )
    try {
      await updateWorkshop(w.id, { isActive: nextActive })
      setMsg({ type: 'success', text: `Workshop ${nextActive ? 'activated' : 'deactivated'}.` })
      await load()
    } catch (err) {
      setWorkshops((prev) =>
        prev.map((item) => (item.id === w.id ? { ...item, isActive: w.isActive } : item))
      )
      setMsg({ type: 'error', text: err.message })
    }
  }

  const confirmDelete = async () => {
    try {
      await deleteWorkshop(deleteId)
      setDeleteId(null)
      setMsg({ type: 'success', text: 'Workshop deleted.' })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const handleGenerateDefaultTests = async (w) => {
    setGeneratingForId(w.id)
    setMsg({ type: 'info', text: `Generating default test suite for "${w.name}"…` })
    try {
      const count = await createDefaultTestsForWorkshop(w)
      setMsg({
        type: 'success',
        text: `Successfully created ${count} default tests (Pre-Assessment, Day 1..${w.durationDays || 6}, Grand Test) for ${w.name}!`,
      })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setGeneratingForId(null)
    }
  }

  if (loading) return <Loader message="Loading workshops…" />

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Workshops ({workshops.length})</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create and manage different workshop tracks, tests, and question banks.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={openCreate}>
            + Create Workshop
          </button>
        </div>
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

      {/* Workshop creation / edit modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800">
              {editId ? 'Edit Workshop' : 'Create New Workshop'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Set up details for any workshop, bootcamp, or skill sprint.
            </p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="label">Workshop Title</label>
                <input
                  className="input"
                  placeholder="e.g. Python for Data Science"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Workshop Code</label>
                  <input
                    className="input"
                    placeholder="e.g. PY-DS"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Duration (Days)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={30}
                    value={form.durationDays}
                    onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Description</label>
                <textarea
                  className="input min-h-[80px]"
                  placeholder="Brief summary of the workshop topics and objectives…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (available for tests and student enrollment)
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFormOpen(false)
                    setEditId(null)
                  }}
                >
                  Cancel
                </button>
                <button className="btn-primary">
                  {editId ? 'Save Changes' : 'Create Workshop'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workshop Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {workshops.map((w) => {
          const st = workshopStats[w.id] || { tests: 0, questions: 0, attempts: 0 }
          const isGenerating = generatingForId === w.id

          return (
            <div
              key={w.id}
              className="card flex flex-col justify-between border-t-4 transition-shadow hover:shadow-md"
              style={{ borderTopColor: w.isActive ? '#ea580c' : '#94a3b8' }}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="badge bg-brand/10 font-mono text-brand">
                    {w.code || w.name.slice(0, 6).toUpperCase()}
                  </span>
                  <span
                    className={`badge ${
                      w.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <h3 className="mt-3 text-lg font-bold text-slate-800">{w.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {w.description || 'No description provided.'}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs">
                  <div>
                    <span className="block font-bold text-slate-800 text-base">{st.tests}</span>
                    <span className="text-slate-500">Tests</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-800 text-base">{st.questions}</span>
                    <span className="text-slate-500">Questions</span>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-800 text-base">{st.attempts}</span>
                    <span className="text-slate-500">Attempts</span>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Duration: <b>{w.durationDays || 6} days</b></span>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary flex-1 text-xs"
                    onClick={() => handleGenerateDefaultTests(w)}
                    disabled={isGenerating}
                    title="Generate Pre-Assessment, Day 1..N, and Grand Test for this workshop"
                  >
                    {isGenerating ? 'Generating…' : '⚡ Auto-Gen Tests'}
                  </button>
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => toggleActive(w)}
                  >
                    {w.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => openEdit(w)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn-danger text-xs"
                    onClick={() => setDeleteId(w.id)}
                  >
                    Delete
                  </button>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/admin/questions?workshopId=${w.id}`}
                    className="btn-secondary w-1/2 text-center text-xs"
                  >
                    Questions ({st.questions})
                  </Link>
                  <Link
                    to={`/admin/tests?workshopId=${w.id}`}
                    className="btn-secondary w-1/2 text-center text-xs"
                  >
                    Tests ({st.tests})
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {workshops.length === 0 && (
        <div className="card py-12 text-center text-slate-500">
          <p className="text-lg font-medium text-slate-700">No workshops created yet</p>
          <p className="mt-1 text-sm">Create your first workshop to begin setting up tests and questions.</p>
          <button className="btn-primary mt-4" onClick={openCreate}>
            + Create Workshop
          </button>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Delete Workshop?"
        message="Are you sure you want to delete this workshop? Existing test attempts and records will remain, but the workshop container will be removed."
        confirmText="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
