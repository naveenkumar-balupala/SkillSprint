import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getTest } from '../../services/testService'
import { hasAttempted } from '../../services/attemptService'
import Loader from '../../components/Loader'

export default function TestInstructions() {
  const { testId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [test, setTest] = useState(null)
  const [attempted, setAttempted] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      const [t, done] = await Promise.all([getTest(testId), hasAttempted(profile.id, testId)])
      setTest(t)
      setAttempted(done)
      setLoading(false)
    })()
  }, [testId, profile])

  if (loading) return <Loader />
  if (!test) return <div className="card">Test not found.</div>

  // Guard: already attempted -> show result instead.
  if (attempted) {
    return (
      <div className="mx-auto max-w-xl card text-center">
        <h1 className="text-xl font-bold text-slate-800">Test Already Attempted</h1>
        <p className="mt-2 text-sm text-slate-500">You are allowed only one attempt for each test.</p>
        <Link to={`/result/${testId}`} className="btn-primary mt-4">View Your Result</Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge bg-brand/10 text-brand">{test.testType}</span>
          {test.workshopName && (
            <span className="badge bg-slate-100 text-slate-700">{test.workshopName}</span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-800">{test.testTitle}</h1>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500">Questions</p>
            <p className="text-lg font-bold text-slate-800">{test.totalQuestions}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-slate-500">Duration</p>
            <p className="text-lg font-bold text-slate-800">{test.duration} min</p>
          </div>
        </div>

        <h2 className="mt-6 font-semibold text-slate-800">Instructions</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>Only <b>one attempt</b> is allowed per test.</li>
          <li>Questions and options appear in <b>random order</b>.</li>
          <li>The timer starts when you click <b>Start</b>; the test <b>auto-submits</b> at 0:00.</li>
          <li>Use the navigation panel to move between questions.</li>
          <li>You can change answers until you submit.</li>
          <li>A confirmation popup appears before final submission.</li>
          <li>Do not refresh or close the tab during the test.</li>
        </ul>

        <div className="mt-6 flex gap-3">
          <Link to="/dashboard" className="btn-secondary">Back</Link>
          <button className="btn-primary flex-1" onClick={() => navigate(`/test/${testId}`)}>
            Start Test
          </button>
        </div>
      </div>
    </div>
  )
}
