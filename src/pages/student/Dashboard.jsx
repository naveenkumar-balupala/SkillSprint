import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getActiveTests } from '../../services/testService'
import { getStudentAttempts } from '../../services/attemptService'
import { getActiveWorkshops } from '../../services/workshopService'
import Loader from '../../components/Loader'
import Alert from '../../components/Alert'

export default function Dashboard() {
  const { profile } = useAuth()
  const [allTests, setAllTests] = useState([])
  const [workshops, setWorkshops] = useState([])
  const [selectedWorkshop, setSelectedWorkshop] = useState('All')
  const [attempts, setAttempts] = useState({}) // testId -> attempt
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!profile) return
    ;(async () => {
      try {
        const [wList, t, a] = await Promise.all([
          getActiveWorkshops().catch(() => []),
          getActiveTests(),
          getStudentAttempts(profile.id),
        ])
        setWorkshops(wList)
        if (profile.workshopId) {
          setSelectedWorkshop(profile.workshopId)
        }

        // sort: Pre-Assessment, Day-wise (by day), Grand
        const order = { 'Pre-Assessment': 0, 'Day-wise Test': 1, 'Grand Test': 2 }
        t.sort((x, y) =>
          (order[x.testType] - order[y.testType]) || ((x.dayNumber || 0) - (y.dayNumber || 0)))
        setAllTests(t)
        const map = {}
        a.forEach((att) => (map[att.testId] = att))
        setAttempts(map)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [profile])

  const filteredTests = useMemo(() => {
    if (selectedWorkshop === 'All') return allTests
    return allTests.filter((t) => {
      if (t.workshopId) return t.workshopId === selectedWorkshop
      // Fallback for legacy tests without workshopId
      return selectedWorkshop === 'excel-analytics'
    })
  }, [allTests, selectedWorkshop])

  if (loading) return <Loader message="Loading your tests…" />

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome, {profile?.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{profile?.usn}</span>
            <span>·</span>
            <span>{profile?.branch}</span>
            <span>·</span>
            <span>Section {profile?.section}</span>
            {profile?.workshopName && (
              <span className="badge bg-brand/10 text-brand font-medium">
                Enrolled: {profile.workshopName}
              </span>
            )}
          </p>
        </div>

        {/* Workshop Filter */}
        {workshops.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Workshop:</label>
            <select
              className="input-field text-sm py-1.5 px-3"
              value={selectedWorkshop}
              onChange={(e) => setSelectedWorkshop(e.target.value)}
            >
              <option value="All">All Workshops ({allTests.length} tests)</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <Alert type="error">{error}</Alert>

      {filteredTests.length === 0 ? (
        <div className="card text-center text-slate-500 py-10">
          <p className="text-base font-medium text-slate-700">No active tests available for this selection.</p>
          {selectedWorkshop !== 'All' && (
            <button
              onClick={() => setSelectedWorkshop('All')}
              className="mt-3 text-sm text-brand hover:underline font-medium"
            >
              View all available workshop tests
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTests.map((test) => {
            const attempt = attempts[test.id]
            const done = attempt && attempt.submittedAt
            return (
              <div key={test.id} className="card flex flex-col justify-between hover:shadow-md transition">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <span className="badge bg-brand/10 text-brand">{test.testType}</span>
                    {test.workshopName && (
                      <span className="badge bg-slate-100 text-slate-700">
                        {test.workshopName}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-800">{test.testTitle}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {test.totalQuestions} questions · {test.duration} min
                  </p>
                </div>
                <div className="mt-4">
                  {done ? (
                    test.resultsReleased ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-500">Your score</span>
                          <span className="font-bold text-slate-800">{attempt.percentage}%</span>
                        </div>
                        <Link to={`/result/${test.id}`} className="btn-secondary w-full">View Result</Link>
                        <p className="text-center">
                          <span className="badge bg-slate-100 text-slate-600">Completed · 1 attempt only</span>
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-center">
                        <span className="badge bg-green-100 text-green-700">Submitted</span>
                        <p className="text-xs text-slate-500">
                          Your result will be available once the admin releases it.
                        </p>
                      </div>
                    )
                  ) : (
                    <Link to={`/test/${test.id}/instructions`} className="btn-primary w-full">Start Test</Link>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
