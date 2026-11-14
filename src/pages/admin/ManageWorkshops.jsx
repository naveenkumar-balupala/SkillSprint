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
import {
  SUBJECT_CATALOG,
  DEFAULT_SUBJECT_TOPICS,
  detectSubjectFromWorkshop,
} from '../../utils/seedData'
import Loader from '../../components/Loader'
import Alert from '../../components/Alert'
import ConfirmModal from '../../components/ConfirmModal'

const emptyForm = {
  name: '',
  code: '',
  subject: 'python',
  description: '',
  durationDays: 6,
  topics: DEFAULT_SUBJECT_TOPICS['python'] || [],
  autoGenerateTests: true,
  isActive: true,
}

export default function ManageWorkshops() {
  const [workshops, setWorkshops] = useState([])
  const [tests, setTests] = useState([])
  const [questions, setQuestions] = useState([])
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })

  // Workshop create/edit modal
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [pasteSyllabusMode, setPasteSyllabusMode] = useState(false)
  const [pastedText, setPastedText] = useState('')

  // Interactive Test & Question Generation Modal for existing workshop
  const [genModalOpen, setGenModalOpen] = useState(false)
  const [genTargetWorkshop, setGenTargetWorkshop] = useState(null)
  const [genTopics, setGenTopics] = useState([])
  const [genLoading, setGenLoading] = useState(false)

  const [deleteId, setDeleteId] = useState(null)

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

  // Aggregate stats per workshop (strictly matching workshopId)
  const workshopStats = useMemo(() => {
    const stats = {}
    workshops.forEach((w) => {
      stats[w.id] = { tests: 0, questions: 0, attempts: 0 }
    })

    tests.forEach((t) => {
      if (t.workshopId && stats[t.workshopId]) {
        stats[t.workshopId].tests++
      } else if (!t.workshopId && stats['excel-analytics']) {
        stats['excel-analytics'].tests++
      }
    })

    questions.forEach((q) => {
      if (q.workshopId && stats[q.workshopId]) {
        stats[q.workshopId].questions++
      } else if (!q.workshopId && stats['excel-analytics']) {
        stats['excel-analytics'].questions++
      }
    })

    attempts.forEach((a) => {
      if (a.workshopId && stats[a.workshopId]) {
        stats[a.workshopId].attempts++
      } else if (!a.workshopId && stats['excel-analytics']) {
        stats['excel-analytics'].attempts++
      }
    })

    return stats
  }, [workshops, tests, questions, attempts])

  const openCreate = () => {
    const detected = 'python'
    setForm({
      ...emptyForm,
      subject: detected,
      topics: [...(DEFAULT_SUBJECT_TOPICS[detected] || [])],
    })
    setEditId(null)
    setPasteSyllabusMode(false)
    setPastedText('')
    setFormOpen(true)
  }

  const openEdit = (w) => {
    const subj = w.subject || detectSubjectFromWorkshop(w)
    const days = Number(w.durationDays) || 6
    let top = Array.isArray(w.topics) && w.topics.length ? [...w.topics] : []
    if (top.length === 0) {
      top = (DEFAULT_SUBJECT_TOPICS[subj] || DEFAULT_SUBJECT_TOPICS.custom || []).slice(0, days)
    }
    while (top.length < days) {
      top.push(`Day ${top.length + 1} Topics`)
    }

    setForm({
      name: w.name,
      code: w.code || '',
      subject: subj,
      description: w.description || '',
      durationDays: days,
      topics: top,
      autoGenerateTests: false,
      isActive: w.isActive ?? true,
    })
    setEditId(w.id)
    setPasteSyllabusMode(false)
    setPastedText('')
    setFormOpen(true)
  }

  // Handle title change: auto-detect subject if user hasn't explicitly customized yet
  const handleTitleChange = (val) => {
    const next = { ...form, name: val }
    if (!editId) {
      const detected = detectSubjectFromWorkshop({ name: val, description: form.description })
      if (detected !== form.subject && DEFAULT_SUBJECT_TOPICS[detected]) {
        next.subject = detected
        const days = Number(form.durationDays) || 6
        next.topics = (DEFAULT_SUBJECT_TOPICS[detected] || []).slice(0, days)
      }
    }
    setForm(next)
  }

  // Handle subject change: load default topics for that subject
  const handleSubjectChange = (newSubj) => {
    const days = Number(form.durationDays) || 6
    const suggested = (DEFAULT_SUBJECT_TOPICS[newSubj] || DEFAULT_SUBJECT_TOPICS.custom || []).slice(0, days)
    while (suggested.length < days) {
      suggested.push(`Day ${suggested.length + 1} Topics`)
    }
    setForm({
      ...form,
      subject: newSubj,
      topics: suggested,
    })
  }

  // Handle duration change: adjust topics array length
  const handleDurationChange = (num) => {
    const days = Math.max(1, Math.min(Number(num) || 1, 30))
    const current = [...form.topics]
    const template = DEFAULT_SUBJECT_TOPICS[form.subject] || DEFAULT_SUBJECT_TOPICS.custom || []
    while (current.length < days) {
      const idx = current.length
      current.push(template[idx] || `Day ${idx + 1} Topics`)
    }
    setForm({
      ...form,
      durationDays: days,
      topics: current.slice(0, days),
    })
  }

  const handleTopicChange = (idx, value) => {
    const updated = [...form.topics]
    updated[idx] = value
    setForm({ ...form, topics: updated })
  }

  const applyPastedSyllabus = () => {
    if (!pastedText.trim()) return
    const lines = pastedText
      .split('\n')
      .map((l) => l.replace(/^(day\s*\d+[:\-.]?|module\s*\d+[:\-.]?|\d+[\.\)\-]?)\s*/i, '').trim())
      .filter(Boolean)

    if (lines.length > 0) {
      const days = Math.max(lines.length, Number(form.durationDays) || 1)
      const current = [...lines]
      while (current.length < days) {
        current.push(`Day ${current.length + 1} Topics`)
      }
      setForm({
        ...form,
        durationDays: days,
        topics: current.slice(0, days),
      })
      setPasteSyllabusMode(false)
      setPastedText('')
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      return setMsg({ type: 'error', text: 'Workshop title is required.' })
    }

    try {
      if (editId) {
        await updateWorkshop(editId, form)
        setMsg({ type: 'success', text: `Workshop "${form.name}" updated successfully.` })
      } else {
        const created = await createWorkshop(form)
        if (form.autoGenerateTests) {
          try {
            const count = await createDefaultTestsForWorkshop(created, form.topics)
            setMsg({
              type: 'success',
              text: `Workshop created and successfully auto-generated ${count} tests & questions for "${form.name}" based on delivered topics!`,
            })
          } catch (genErr) {
            console.warn('Auto-gen error:', genErr)
            setMsg({
              type: 'success',
              text: `Workshop "${form.name}" created. (Note: tests can be generated anytime via Auto-Gen Tests button).`,
            })
          }
        } else {
          setMsg({ type: 'success', text: `Workshop "${form.name}" created successfully.` })
        }
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
      setMsg({ type: 'success', text: 'Workshop, its tests, and its questions have been removed.' })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  // Open interactive test & question generator modal for an existing workshop
  const openGenModal = (w) => {
    const days = Number(w.durationDays) || 6
    const subj = w.subject || detectSubjectFromWorkshop(w)
    let top = Array.isArray(w.topics) && w.topics.length ? [...w.topics] : []
    if (top.length === 0) {
      top = (DEFAULT_SUBJECT_TOPICS[subj] || DEFAULT_SUBJECT_TOPICS.custom || []).slice(0, days)
    }
    while (top.length < days) {
      top.push(`Day ${top.length + 1} Topics`)
    }
    setGenTargetWorkshop(w)
    setGenTopics(top.slice(0, days))
    setGenModalOpen(true)
  }

  const handleExecuteGenModal = async () => {
    if (!genTargetWorkshop) return
    setGenLoading(true)
    try {
      // First save any edited topics to workshop doc
      await updateWorkshop(genTargetWorkshop.id, { topics: genTopics })
      const count = await createDefaultTestsForWorkshop(
        { ...genTargetWorkshop, topics: genTopics },
        genTopics
      )
      setMsg({
        type: 'success',
        text: `Generated ${count} tests (Pre-Assessment, Day 1..${genTargetWorkshop.durationDays || 6}, Grand Test) and matching question bank for "${genTargetWorkshop.name}"!`,
      })
      setGenModalOpen(false)
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setGenLoading(false)
    }
  }

  if (loading) return <Loader message="Loading workshops…" />

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Workshops ({workshops.length})</h1>
          <p className="mt-1 text-sm text-slate-500">
            Define workshop topics delivered, auto-generate matching tests, and isolate student analytics.
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
            autoCloseMs={msg.type === 'error' ? undefined : 6000}
          >
            {msg.text}
          </Alert>
        </div>
      )}

      {/* Workshop creation / edit modal with Delivered Topics support */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl my-8">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {editId ? 'Edit Workshop & Delivered Topics' : 'Create New Workshop'}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Define what the workshop is about and the topics delivered each day for test generation.
                </p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
                onClick={() => setFormOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="label">Workshop Title</label>
                  <input
                    className="input font-medium"
                    placeholder="e.g. Python for Data Science"
                    value={form.name}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="label">Workshop Code</label>
                  <input
                    className="input uppercase font-mono"
                    placeholder="e.g. PY-DS"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Subject / Track Domain</label>
                  <select
                    className="input font-medium"
                    value={form.subject}
                    onChange={(e) => handleSubjectChange(e.target.value)}
                  >
                    <option value="python">🐍 Python Programming &amp; Data Science</option>
                    <option value="webdev">🌐 Full Stack Web Development (React / JS)</option>
                    <option value="java">☕ Java Programming &amp; OOP</option>
                    <option value="sql">🗄️ SQL &amp; Relational Databases</option>
                    <option value="ml">🤖 Machine Learning &amp; AI</option>
                    <option value="excel">📊 Excel for Data Analytics</option>
                    <option value="custom">⚡ Custom Subject / Other Domain</option>
                  </select>
                </div>
                <div>
                  <label className="label">Duration (Days)</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={30}
                    value={form.durationDays}
                    onChange={(e) => handleDurationChange(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label">What is this Workshop about? (Description &amp; Goals)</label>
                <textarea
                  className="input min-h-[60px] text-xs"
                  placeholder="Summary of workshop objectives, core principles, and skills taught to students…"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              {/* Topics to be delivered section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Topics to be Delivered in Workshop ({form.durationDays} Days)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Tests (Pre-Assessment, Day 1..N Tests) and question banks will be auto-generated based on these delivered topics.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand hover:underline"
                      onClick={() => handleSubjectChange(form.subject)}
                    >
                      🔄 Reset to Default
                    </button>
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-600 hover:underline"
                      onClick={() => setPasteSyllabusMode(!pasteSyllabusMode)}
                    >
                      {pasteSyllabusMode ? '← Back to List' : '📋 Quick Paste Syllabus'}
                    </button>
                  </div>
                </div>

                {pasteSyllabusMode ? (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs text-slate-600">
                      Paste your syllabus topics below (one topic per line). Line 1 will be assigned to Day 1, Line 2 to Day 2, etc.
                    </p>
                    <textarea
                      className="input min-h-[120px] text-xs font-mono"
                      placeholder={`HTML Semantics & Modern CSS\nModern JavaScript & ES6+\nDOM Events & Storage APIs\nAsync JS & REST APIs\nReact Components & State\nReact Routing & Capstone`}
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        onClick={() => setPasteSyllabusMode(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        onClick={applyPastedSyllabus}
                      >
                        Apply Pasted Syllabus
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                    {Array.from({ length: Number(form.durationDays) || 6 }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-xs font-semibold text-slate-600">
                          Day {idx + 1}:
                        </span>
                        <input
                          className="input py-1 text-xs"
                          placeholder={`Enter topic delivered on Day ${idx + 1}`}
                          value={form.topics[idx] || ''}
                          onChange={(e) => handleTopicChange(idx, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {!editId && (
                <label className="flex items-center gap-2 text-sm text-slate-700 bg-brand/5 border border-brand/20 p-3 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-brand rounded"
                    checked={form.autoGenerateTests}
                    onChange={(e) => setForm({ ...form, autoGenerateTests: e.target.checked })}
                  />
                  <span>
                    ⚡ <strong>Auto-generate tests &amp; question bank</strong> immediately upon creation (Pre-Assessment, Day 1..{form.durationDays} Tests, Grand Test)
                  </span>
                </label>
              )}

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active (available for tests and student enrollment)
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
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

      {/* Interactive Modal: Auto-Gen Tests from Delivered Topics */}
      {genModalOpen && genTargetWorkshop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-slate-800">
              ⚡ Generate Tests from Delivered Topics
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Generate Pre-Assessment, Day 1..{genTargetWorkshop.durationDays || 6} Tests, and Grand Test along with matching question banks for <strong>{genTargetWorkshop.name}</strong>.
            </p>

            <div className="mt-4 space-y-3">
              <label className="label">Delivered Topics per Day (verify or edit):</label>
              <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                {genTopics.map((top, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-xs font-semibold text-slate-500">
                      Day {i + 1}:
                    </span>
                    <input
                      className="input py-1 text-xs"
                      value={top}
                      onChange={(e) => {
                        const copy = [...genTopics]
                        copy[i] = e.target.value
                        setGenTopics(copy)
                      }}
                    />
                  </div>
                ))}
              </div>

              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                💡 Each day test will be named after its delivered topic, and questions will be seeded directly matching the subject domain.
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={genLoading}
                  onClick={() => setGenModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={genLoading}
                  onClick={handleExecuteGenModal}
                >
                  {genLoading ? 'Generating…' : '🚀 Generate Tests & Questions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workshop Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {workshops.map((w) => {
          const st = workshopStats[w.id] || { tests: 0, questions: 0, attempts: 0 }
          const subjMeta = SUBJECT_CATALOG.find((s) => s.id === (w.subject || detectSubjectFromWorkshop(w)))
          const topics = Array.isArray(w.topics) && w.topics.length ? w.topics : []

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
                  <div className="flex items-center gap-1.5">
                    {subjMeta && (
                      <span className={`badge ${subjMeta.badgeClass}`}>
                        {subjMeta.icon} {subjMeta.shortName}
                      </span>
                    )}
                    <span
                      className={`badge ${
                        w.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {w.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <h3 className="mt-3 text-lg font-bold text-slate-800">{w.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {w.description || 'No description provided.'}
                </p>

                {/* Delivered topics snippet */}
                {topics.length > 0 && (
                  <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs">
                    <span className="block font-semibold text-slate-700 mb-1">
                      📚 Topics Delivered ({topics.length} Days):
                    </span>
                    <ul className="space-y-0.5 text-slate-600 list-disc list-inside">
                      {topics.slice(0, 3).map((t, i) => (
                        <li key={i} className="truncate">
                          Day {i + 1}: {t}
                        </li>
                      ))}
                      {topics.length > 3 && (
                        <li className="text-slate-400 font-medium">
                          + {topics.length - 3} more days…
                        </li>
                      )}
                    </ul>
                  </div>
                )}

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
                  <Link
                    to={`/admin/statistics?workshopId=${w.id}`}
                    className="font-semibold text-brand hover:underline"
                  >
                    📊 Isolated Stats →
                  </Link>
                </div>
              </div>

              <div className="mt-5 space-y-2 border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    className="btn-secondary flex-1 text-xs"
                    onClick={() => openGenModal(w)}
                    title="Generate or update tests and questions matching delivered topics"
                  >
                    ⚡ Auto-Gen Tests
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
          <p className="mt-1 text-sm">Create your first workshop to begin setting up delivered topics and tests.</p>
          <button className="btn-primary mt-4" onClick={openCreate}>
            + Create Workshop
          </button>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Delete Workshop?"
        message="Are you sure you want to delete this workshop? This will permanently remove the workshop along with all of its tests and questions from the question bank."
        confirmText="Delete Workshop"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
