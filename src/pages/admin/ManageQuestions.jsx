import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  addQuestion,
  bulkAddQuestions,
  deleteQuestion,
  getAllQuestions,
  updateQuestion,
  removeDuplicateQuestions,
  questionKey,
} from '../../services/questionService'
import { getAllWorkshops, ensureDefaultWorkshops } from '../../services/workshopService'
import { sampleQuestions } from '../../utils/seedData'
import { exportToExcel, readSpreadsheet } from '../../utils/export'
import Loader from '../../components/Loader'
import Alert from '../../components/Alert'
import ConfirmModal from '../../components/ConfirmModal'

const TEST_TYPES = ['Pre-Assessment', 'Day-wise Test', 'Grand Test']
const DIFFICULTIES = ['Easy', 'Medium', 'Hard']

const emptyForm = {
  workshopId: '',
  questionText: '',
  options: ['', '', '', ''],
  correctIndex: 0,
  topic: '',
  unit: '',
  difficulty: 'Easy',
  testType: 'Pre-Assessment',
  dayNumber: 1,
}

function cell(row, aliases) {
  for (const key of Object.keys(row)) {
    if (aliases.includes(key.trim().toLowerCase())) {
      const v = row[key]
      return v == null ? '' : String(v).trim()
    }
  }
  return ''
}

export default function ManageQuestions() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialWorkshop = searchParams.get('workshopId') || 'All'

  const [questions, setQuestions] = useState([])
  const [workshops, setWorkshops] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [form, setForm] = useState(emptyForm)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)

  // Bulk import questions modal
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importWorkshopId, setImportWorkshopId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  // filters
  const [fWorkshop, setFWorkshop] = useState(initialWorkshop)
  const [fType, setFType] = useState('All')
  const [fTopic, setFTopic] = useState('All')
  const [fDiff, setFDiff] = useState('All')
  const [fDay, setFDay] = useState('All')

  const load = async () => {
    try {
      let [w, q] = await Promise.all([getAllWorkshops(), getAllQuestions()])
      if (w.length === 0) {
        w = await ensureDefaultWorkshops()
      }
      setWorkshops(w)
      setQuestions(q)
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // Currently selected workshop object (for duration/days and default form)
  const currentWorkshop = useMemo(() => {
    if (fWorkshop !== 'All') return workshops.find((w) => w.id === fWorkshop)
    return workshops[0] || null
  }, [workshops, fWorkshop])

  const maxDays = currentWorkshop?.durationDays || 6
  const daysList = useMemo(() => {
    const list = []
    for (let i = 1; i <= Math.max(maxDays, 6); i++) list.push(i)
    return list
  }, [maxDays])

  const handleWorkshopFilterChange = (val) => {
    setFWorkshop(val)
    if (val === 'All') {
      searchParams.delete('workshopId')
      setSearchParams(searchParams)
    } else {
      setSearchParams({ workshopId: val })
    }
  }

  // Filtered questions
  const filtered = useMemo(() => questions.filter((q) => {
    const matchWorkshop =
      fWorkshop === 'All' ||
      q.workshopId === fWorkshop ||
      (!q.workshopId && fWorkshop === workshops[0]?.id)
    const matchType = fType === 'All' || q.testType === fType
    const matchTopic = fTopic === 'All' || q.topic === fTopic
    const matchDiff = fDiff === 'All' || q.difficulty === fDiff
    const matchDay = fDay === 'All' || String(q.dayNumber) === String(fDay)
    return matchWorkshop && matchType && matchTopic && matchDiff && matchDay
  }), [questions, fWorkshop, fType, fTopic, fDiff, fDay, workshops])

  const topics = ['All', ...new Set(filtered.map((q) => q.topic).filter(Boolean))]

  const resetForm = () => {
    setForm({
      ...emptyForm,
      workshopId: fWorkshop !== 'All' ? fWorkshop : workshops[0]?.id || '',
    })
    setEditId(null)
  }

  // Idempotent seed sample questions
  const handleSeed = async () => {
    const targetW = currentWorkshop || workshops[0]
    const have = new Set(questions.map(questionKey))
    const missing = sampleQuestions
      .map((s) => ({
        ...s,
        workshopId: targetW ? targetW.id : null,
        workshopName: targetW ? targetW.name : null,
      }))
      .filter((s) => !have.has(questionKey(s)))

    if (missing.length === 0) {
      setMsg({ type: 'info', text: 'All sample questions are already present for this workshop.' })
      return
    }
    setMsg({ type: 'info', text: `Adding ${missing.length} sample questions to "${targetW?.name || 'Default'}"…` })
    try {
      await bulkAddQuestions(missing, targetW || {})
      setMsg({ type: 'success', text: `Added ${missing.length} questions to "${targetW?.name || 'Default'}".` })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  const handleRemoveDuplicates = async () => {
    setMsg({ type: 'info', text: 'Scanning for duplicate questions…' })
    try {
      const targetWId = fWorkshop !== 'All' ? fWorkshop : null
      const n = await removeDuplicateQuestions(targetWId)
      setMsg({ type: n ? 'success' : 'info', text: n ? `Removed ${n} duplicate question(s).` : 'No duplicates found.' })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    }
  }

  // Count of questions available for the selected workshop view
  const counts = useMemo(() => {
    const targetQuestions =
      fWorkshop === 'All'
        ? questions
        : questions.filter((q) => q.workshopId === fWorkshop || (!q.workshopId && fWorkshop === workshops[0]?.id))

    const c = { 'Pre-Assessment': 0, 'Grand Test': 0, days: {} }
    for (let d = 1; d <= maxDays; d++) c.days[d] = 0

    targetQuestions.forEach((qn) => {
      if (qn.testType === 'Pre-Assessment') c['Pre-Assessment']++
      else if (qn.testType === 'Grand Test') c['Grand Test']++
      else if (qn.testType === 'Day-wise Test' && qn.dayNumber) {
        c.days[qn.dayNumber] = (c.days[qn.dayNumber] || 0) + 1
      }
    })
    return c
  }, [questions, fWorkshop, workshops, maxDays])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.questionText.trim() || form.options.some((o) => !o.trim())) {
      return setMsg({ type: 'error', text: 'Fill the question and all four options.' })
    }

    const assignedWorkshop =
      workshops.find((w) => w.id === form.workshopId) ||
      currentWorkshop ||
      workshops[0]

    const payload = {
      workshopId: assignedWorkshop?.id || null,
      workshopName: assignedWorkshop?.name || null,
      questionText: form.questionText.trim(),
      options: form.options.map((o) => o.trim()),
      correctAnswer: form.options[form.correctIndex].trim(),
      topic: form.topic.trim() || 'General',
      unit: form.unit.trim() || form.topic.trim() || 'General',
      difficulty: form.difficulty,
      testType: form.testType,
      dayNumber: form.testType === 'Day-wise Test' ? Number(form.dayNumber) : null,
    }

    try {
      if (editId) {
        await updateQuestion(editId, payload)
        setMsg({ type: 'success', text: 'Question updated.' })
      } else {
        await addQuestion(payload)
        setMsg({ type: 'success', text: 'Question added.' })
      }
      resetForm()
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  const startEdit = (q) => {
    setEditId(q.id)
    setForm({
      workshopId: q.workshopId || workshops[0]?.id || '',
      questionText: q.questionText,
      options: [...q.options],
      correctIndex: Math.max(0, q.options.indexOf(q.correctAnswer)),
      topic: q.topic || '',
      unit: q.unit || '',
      difficulty: q.difficulty || 'Easy',
      testType: q.testType,
      dayNumber: q.dayNumber || 1,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const confirmDelete = async () => {
    await deleteQuestion(deleteId)
    setDeleteId(null)
    setMsg({ type: 'success', text: 'Question deleted.' })
    load()
  }

  const setOpt = (i, v) => {
    const opts = [...form.options]
    opts[i] = v
    setForm({ ...form, options: opts })
  }

  // ---- Bulk Import Questions from Spreadsheet ----
  const downloadQuestionTemplate = () => {
    exportToExcel(
      [
        {
          Question: 'What is a closure in JavaScript?',
          OptionA: 'A function bundled with its lexical environment',
          OptionB: 'A method to close browser tabs',
          OptionC: 'A syntax error in async code',
          OptionD: 'A loop termination operator',
          CorrectOption: 'A',
          Topic: 'Scope & Functions',
          Difficulty: 'Medium',
          TestType: 'Day-wise Test',
          DayNumber: 1,
        },
        {
          Question: 'Which method adds an element to the end of an array?',
          OptionA: 'push()',
          OptionB: 'pop()',
          OptionC: 'shift()',
          OptionD: 'unshift()',
          CorrectOption: 'push()',
          Topic: 'Arrays',
          Difficulty: 'Easy',
          TestType: 'Pre-Assessment',
          DayNumber: '',
        },
      ],
      'questions-import-template.xlsx',
      'Questions',
    )
  }

  const runQuestionImport = async () => {
    if (!importFile) {
      return setMsg({ type: 'error', text: 'Select an Excel or CSV file to import.' })
    }
    setImporting(true)
    setImportResult(null)

    try {
      const rows = await readSpreadsheet(importFile)
      if (rows.length === 0) throw new Error('File has no data rows.')

      const targetWorkshop =
        workshops.find((w) => w.id === importWorkshopId) || currentWorkshop || workshops[0]

      const parsed = []
      const errors = []

      rows.forEach((r, idx) => {
        const qText = cell(r, ['question', 'question text', 'questiontext', 'prompt', 'qn'])
        const optA = cell(r, ['option a', 'option 1', 'optiona', 'a', 'opt1', 'opt a'])
        const optB = cell(r, ['option b', 'option 2', 'optionb', 'b', 'opt2', 'opt b'])
        const optC = cell(r, ['option c', 'option 3', 'optionc', 'c', 'opt3', 'opt c'])
        const optD = cell(r, ['option d', 'option 4', 'optiond', 'd', 'opt4', 'opt d'])
        const correctRaw = cell(r, ['correct option', 'correct answer', 'correct', 'answer', 'correct index'])
        const topic = cell(r, ['topic', 'unit', 'category', 'module']) || 'General'
        const difficulty = cell(r, ['difficulty', 'level']) || 'Easy'
        const testType = cell(r, ['test type', 'type', 'testtype']) || 'Day-wise Test'
        const dayNumber = Number(cell(r, ['day', 'day number', 'daynumber'])) || null

        if (!qText || !optA || !optB || !optC || !optD) {
          errors.push(`Row ${idx + 2}: Question text or one of the 4 options is missing.`)
          return
        }

        const options = [optA, optB, optC, optD]
        let correctAnswer = optA

        // Determine correct answer from raw text, letters (A,B,C,D), or numbers (1,2,3,4 or 0,1,2,3)
        const cleanRaw = correctRaw.trim().toUpperCase()
        if (cleanRaw === 'A' || cleanRaw === '1') correctAnswer = optA
        else if (cleanRaw === 'B' || cleanRaw === '2') correctAnswer = optB
        else if (cleanRaw === 'C' || cleanRaw === '3') correctAnswer = optC
        else if (cleanRaw === 'D' || cleanRaw === '4') correctAnswer = optD
        else {
          const matchOpt = options.find((o) => o.toLowerCase() === correctRaw.trim().toLowerCase())
          if (matchOpt) correctAnswer = matchOpt
        }

        parsed.push({
          workshopId: targetWorkshop?.id || null,
          workshopName: targetWorkshop?.name || null,
          questionText: qText,
          options,
          correctAnswer,
          topic,
          unit: topic,
          difficulty: ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Easy',
          testType: TEST_TYPES.includes(testType) ? testType : 'Day-wise Test',
          dayNumber: testType === 'Day-wise Test' ? (dayNumber || 1) : null,
        })
      })

      if (parsed.length === 0) {
        throw new Error('No valid questions found in file. Please check column headers.')
      }

      await bulkAddQuestions(parsed, targetWorkshop)
      setImportResult({ created: parsed.length, failed: errors.length, errors })
      setMsg({
        type: 'success',
        text: `Imported ${parsed.length} questions into "${targetWorkshop?.name || 'Workshop'}"!`,
      })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setImporting(false)
    }
  }

  if (loading) return <Loader />

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Manage Questions ({filtered.length} of {questions.length})
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Question bank for multiple workshops. Filter by workshop to prepare test sets.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-primary" onClick={() => {
            setImportWorkshopId(fWorkshop !== 'All' ? fWorkshop : workshops[0]?.id || '')
            setImportOpen(true)
          }}>
            📥 Import Questions (CSV / Excel)
          </button>
          <button className="btn-secondary" onClick={handleSeed}>
            + Seed Sample Syllabus Questions
          </button>
          <button className="btn-secondary" onClick={handleRemoveDuplicates}>
            Remove Duplicates
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

      {/* Workshop & Question count chip section */}
      <div className="card mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Workshop:</span>
            <select
              className="input text-xs py-1.5 font-medium"
              value={fWorkshop}
              onChange={(e) => handleWorkshopFilterChange(e.target.value)}
            >
              <option value="All">All Workshops (Overview)</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-400">
            Target per test: <b>30 questions</b>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          <CountChip label="Pre-Assessment" value={counts['Pre-Assessment']} />
          {daysList.slice(0, maxDays).map((d) => (
            <CountChip key={d} label={`Day ${d}`} value={counts.days[d] || 0} />
          ))}
          <CountChip label="Grand Test" value={counts['Grand Test']} />
        </div>
      </div>

      {/* ---- Add / Edit form ---- */}
      <form onSubmit={handleSubmit} className="card mb-6 grid gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">{editId ? 'Edit Question' : 'Add Question'}</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Workshop:</label>
            <select
              className="input text-xs py-1"
              value={form.workshopId || currentWorkshop?.id || ''}
              onChange={(e) => setForm({ ...form, workshopId: e.target.value })}
            >
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Question Text</label>
          <textarea
            className="input"
            rows={2}
            value={form.questionText}
            onChange={(e) => setForm({ ...form, questionText: e.target.value })}
            placeholder="Type your multiple choice question here…"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {form.options.map((opt, i) => (
            <label
              key={i}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                form.correctIndex === i ? 'border-green-400 bg-green-50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="correct"
                checked={form.correctIndex === i}
                onChange={() => setForm({ ...form, correctIndex: i })}
              />
              <input
                className="w-full bg-transparent text-sm outline-none"
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                value={opt}
                onChange={(e) => setOpt(i, e.target.value)}
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-slate-400">Select the radio button next to the correct option.</p>

        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label className="label">Topic / Unit</label>
            <input
              className="input"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g. Pandas, Loops, Functions"
            />
          </div>
          <div>
            <label className="label">Difficulty</label>
            <select className="input" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              {DIFFICULTIES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Test Type</label>
            <select className="input" value={form.testType} onChange={(e) => setForm({ ...form, testType: e.target.value })}>
              {TEST_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Day Number</label>
            <input
              className="input"
              type="number"
              min={1}
              max={maxDays}
              disabled={form.testType !== 'Day-wise Test'}
              value={form.dayNumber}
              onChange={(e) => setForm({ ...form, dayNumber: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button className="btn-primary">{editId ? 'Update Question' : 'Add Question'}</button>
          {editId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* ---- Filters ---- */}
      <div className="card mb-4 grid gap-3 sm:grid-cols-4">
        <div>
          <label className="label text-xs">Test Type</label>
          <select className="input text-xs py-1.5" value={fType} onChange={(e) => setFType(e.target.value)}>
            <option>All</option>
            {TEST_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Topic</label>
          <select className="input text-xs py-1.5" value={fTopic} onChange={(e) => setFTopic(e.target.value)}>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Difficulty</label>
          <select className="input text-xs py-1.5" value={fDiff} onChange={(e) => setFDiff(e.target.value)}>
            <option>All</option>
            {DIFFICULTIES.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label text-xs">Day Number</label>
          <select className="input text-xs py-1.5" value={fDay} onChange={(e) => setFDay(e.target.value)}>
            <option>All</option>
            {daysList.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ---- List ---- */}
      <div className="space-y-3">
        {filtered.map((q) => (
          <div key={q.id} className="card flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                {q.workshopName && (
                  <span className="badge bg-slate-100 text-slate-700 font-medium">
                    {q.workshopName}
                  </span>
                )}
                <span className="badge bg-brand/10 text-brand">{q.testType}</span>
                {q.dayNumber && <span className="badge bg-blue-100 text-blue-700">Day {q.dayNumber}</span>}
                <span className="badge bg-slate-100 text-slate-600">{q.topic}</span>
                <span className="badge bg-amber-100 text-amber-700">{q.difficulty}</span>
              </div>
              <p className="font-medium text-slate-800">{q.questionText}</p>
              <p className="mt-1 text-xs text-green-600">Correct: {q.correctAnswer}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button className="btn-secondary text-xs" onClick={() => startEdit(q)}>
                Edit
              </button>
              <button className="btn-danger text-xs" onClick={() => setDeleteId(q.id)}>
                Delete
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card text-center text-slate-400">
            No questions match these filters. Use the form above to add questions or import a question bank file.
          </div>
        )}
      </div>

      {/* ---- Bulk Import Modal ---- */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Import Questions Spreadsheet</h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setImportOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Bulk upload MCQs from an Excel (.xlsx) or CSV file directly into any workshop.
            </p>

            <div className="mt-4 space-y-4">
              <div>
                <label className="label">Target Workshop</label>
                <select
                  className="input"
                  value={importWorkshopId}
                  onChange={(e) => setImportWorkshopId(e.target.value)}
                >
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Select Spreadsheet File (.xlsx, .csv)</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="input"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Supported Columns:</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">
                  Question, OptionA, OptionB, OptionC, OptionD, CorrectOption, Topic, Difficulty, TestType, DayNumber
                </p>
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-brand hover:underline"
                  onClick={downloadQuestionTemplate}
                >
                  ⬇ Download Sample Questions Template (.xlsx)
                </button>
              </div>

              {importResult && (
                <div className="rounded-lg bg-green-50 p-3 text-xs text-green-700">
                  Successfully imported {importResult.created} questions.
                  {importResult.failed > 0 && ` (${importResult.failed} skipped)`}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setImportOpen(false)}
                  disabled={importing}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={runQuestionImport}
                  disabled={importing || !importFile}
                >
                  {importing ? 'Importing…' : 'Start Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Delete Question?"
        message="This permanently removes the question from the bank."
        confirmText="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}

function CountChip({ label, value }) {
  const ok = value >= 30
  return (
    <div
      className={`rounded-lg border p-2 text-center ${
        ok ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'
      }`}
    >
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-bold ${ok ? 'text-green-700' : 'text-amber-700'}`}>{value}</div>
    </div>
  )
}
