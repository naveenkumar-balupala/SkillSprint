import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getTest } from '../../services/testService'
import { getQuestionsForTest } from '../../services/questionService'
import { hasAttempted, submitAttempt } from '../../services/attemptService'
import { getProgress, startProgress, saveAnswers, deleteProgress } from '../../services/progressService'
import { pickRandom, shuffle } from '../../utils/shuffle'
import { calculateResult } from '../../utils/scoring'
import Loader from '../../components/Loader'
import Timer from '../../components/Timer'
import ConfirmModal from '../../components/ConfirmModal'
import Alert from '../../components/Alert'

export default function TestPage() {
  const { testId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()

  const [test, setTest] = useState(null)
  const [questions, setQuestions] = useState([]) // randomized & option-shuffled
  const [answers, setAnswers] = useState({}) // questionId -> selected option text
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [remainingSeconds, setRemainingSeconds] = useState(null)

  const startedAtRef = useRef(Date.now())
  const submittedRef = useRef(false) // guards against duplicate submissions

  // ---- Load test: resume saved progress if any, else build a fresh paper ----
  useEffect(() => {
    if (!profile) return
    ;(async () => {
      try {
        const t = await getTest(testId)
        if (!t) throw new Error('Test not found.')
        // Block re-attempts up front.
        if (await hasAttempted(profile.id, testId)) {
          navigate(`/result/${testId}`, { replace: true })
          return
        }
        const pool = await getQuestionsForTest(t.testType, t.dayNumber, t.workshopId)
        if (pool.length === 0) throw new Error('No questions available for this test yet.')
        const poolById = Object.fromEntries(pool.map((q) => [q.id, q]))

        const durationSec = (t.duration || 30) * 60
        let paper
        let startedAtMs
        let savedAnswers = {}

        const progress = await getProgress(profile.id, testId)
        if (progress && Array.isArray(progress.order) && progress.order.length) {
          // RESUME: rebuild the same paper (same order + same option order).
          startedAtMs = progress.startedAtMs || Date.now()
          savedAnswers = progress.answers || {}
          paper = progress.order
            .map((id) => {
              const base = poolById[id]
              if (!base) return null
              return { ...base, options: progress.options?.[id] || shuffle(base.options) }
            })
            .filter(Boolean)
        }

        if (!paper || paper.length === 0) {
          // FRESH start: randomize questions + options, then persist the paper.
          const count = Math.min(t.totalQuestions || 30, pool.length)
          paper = pickRandom(pool, count).map((q) => ({ ...q, options: shuffle(q.options) }))
          startedAtMs = Date.now()
          await startProgress(profile.id, testId, paper, startedAtMs)
        }

        startedAtRef.current = startedAtMs
        const elapsed = Math.floor((Date.now() - startedAtMs) / 1000)
        const remaining = Math.max(durationSec - elapsed, 0)

        setTest(t)
        setQuestions(paper)
        setAnswers(savedAnswers)
        setRemainingSeconds(remaining)
        setLoading(false)

        // If the timer already ran out while away, auto-submit saved answers.
        if (remaining <= 0) {
          setTimeout(() => doSubmitWith(paper, savedAnswers, t), 0)
        }
      } catch (err) {
        setError(err.message)
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, profile])

  // ---- Auto-save answers to Firestore (debounced) whenever they change ----
  useEffect(() => {
    if (loading || submittedRef.current || !profile) return
    const id = setTimeout(() => {
      saveAnswers(profile.id, testId, answers).catch(() => {})
    }, 800)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, loading])

  // ---- Warn before refresh/close ----
  useEffect(() => {
    const handler = (e) => {
      if (!submittedRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  const attemptedCount = useMemo(
    () => questions.filter((q) => answers[q.id] != null).length,
    [questions, answers],
  )
  // Highlight Submit (primary) only once every question is answered.
  const allAnswered = questions.length > 0 && attemptedCount === questions.length

  const selectOption = (qId, option) => {
    setAnswers((prev) => ({ ...prev, [qId]: option }))
  }

  // ---- Final submission (manual, auto-on-timer, or auto-on-expired-resume) ----
  const doSubmitWith = async (paperArg, answersArg, testArg) => {
    if (submittedRef.current) return // duplicate guard
    submittedRef.current = true
    setSubmitting(true)
    setConfirmOpen(false)
    try {
      const result = calculateResult(paperArg, answersArg)
      await submitAttempt({
        student: profile,
        test: testArg,
        questions: paperArg,
        answers: answersArg,
        result,
        startedAt: new Date(startedAtRef.current),
      })
      await deleteProgress(profile.id, testId).catch(() => {})
      navigate(`/result/${testId}`, { replace: true })
    } catch (err) {
      submittedRef.current = false
      setError('Submission failed: ' + err.message)
      setSubmitting(false)
    }
  }
  const doSubmit = () => doSubmitWith(questions, answers, test)

  if (loading) return <Loader message="Preparing your test…" />
  if (error)
    return (
      <div className="mx-auto max-w-xl">
        <Alert type="error">{error}</Alert>
        <button className="btn-secondary mt-4" onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
      </div>
    )

  const q = questions[current]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      {/* ---- Main question panel ---- */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <span className="badge bg-brand/10 text-brand">{test.testType}</span>
            <h1 className="text-lg font-bold text-slate-800">{test.testTitle}</h1>
          </div>
          <Timer durationSeconds={remainingSeconds ?? (test.duration || 30) * 60} onExpire={doSubmit} />
        </div>

        <div className="card">
          <p className="text-sm font-medium text-slate-500">
            Question {current + 1} of {questions.length}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-slate-800">{q.questionText}</h2>

          <div className="mt-4 space-y-2">
            {q.options.map((opt, i) => {
              const selected = answers[q.id] === opt
              return (
                <button
                  key={i}
                  onClick={() => selectOption(q.id, opt)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition ${
                    selected
                      ? 'border-brand bg-brand/5 font-medium text-brand'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${selected ? 'border-brand bg-brand text-white' : 'border-slate-300 text-slate-500'}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt}
                </button>
              )
            })}
          </div>

          {answers[q.id] != null && (
            <div className="mt-3">
              <button className="text-xs text-slate-500 underline hover:text-slate-700" onClick={() => setAnswers((p) => { const n = { ...p }; delete n[q.id]; return n })}>
                Clear this answer
              </button>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              className="btn-secondary"
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
            >
              ← Previous
            </button>
            {current < questions.length - 1 ? (
              <button className="btn-primary" onClick={() => setCurrent((c) => c + 1)}>Next →</button>
            ) : (
              <button className="btn-primary" onClick={() => setConfirmOpen(true)}>Submit Test</button>
            )}
          </div>
        </div>
      </div>

      {/* ---- Navigation panel ---- */}
      <aside className="card h-fit lg:sticky lg:top-20">
        <h3 className="text-sm font-semibold text-slate-700">Question Navigation</h3>
        <p className="mt-1 text-xs text-slate-500">
          Attempted: <b className="text-green-600">{attemptedCount}</b> · Not attempted:{' '}
          <b className="text-slate-600">{questions.length - attemptedCount}</b>
        </p>
        <p className="mt-1 text-xs text-green-600">✓ Answers auto-saved — you can safely resume if disconnected.</p>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {questions.map((qq, i) => {
            const done = answers[qq.id] != null
            const active = i === current
            return (
              <button
                key={qq.id}
                onClick={() => setCurrent(i)}
                className={`h-8 w-8 rounded text-xs font-semibold ${
                  active
                    ? 'ring-2 ring-brand ring-offset-1'
                    : ''
                } ${done ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {i + 1}
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-green-500" /> Attempted</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-200" /> Pending</span>
        </div>
        <button
          className={`mt-5 w-full ${allAnswered ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setConfirmOpen(true)}
          disabled={submitting}
        >
          {submitting ? 'Submitting…' : allAnswered ? 'Submit Test' : `Submit (${attemptedCount}/${questions.length})`}
        </button>
        {!allAnswered && (
          <p className="mt-2 text-center text-xs text-slate-400">
            Submit highlights once all questions are answered. You may still submit early.
          </p>
        )}
      </aside>

      <ConfirmModal
        open={confirmOpen}
        title="Submit Test?"
        message={`You have attempted ${attemptedCount} of ${questions.length} questions. Once submitted you cannot change your answers. Continue?`}
        confirmText="Yes, Submit"
        onConfirm={doSubmit}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  )
}
