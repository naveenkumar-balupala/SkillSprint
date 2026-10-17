import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { deleteTest, getAllTests, updateTest, setResultsReleased } from '../../services/testService'
import { getAllAttempts } from '../../services/attemptService'
import { getAllWorkshops } from '../../services/workshopService'
import { getAllQuestions } from '../../services/questionService'
import Loader from '../../components/Loader'
import ConfirmModal from '../../components/ConfirmModal'

export default function ManageTests() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialWorkshop = searchParams.get('workshopId') || 'All'

  const [tests, setTests] = useState([])
  const [attempts, setAttempts] = useState([])
  const [workshops, setWorkshops] = useState([])
  const [questions, setQuestions] = useState([])
  const [fWorkshop, setFWorkshop] = useState(initialWorkshop)
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState(null)

  const load = async () => {
    const [t, a, w, q] = await Promise.all([
      getAllTests(),
      getAllAttempts(),
      getAllWorkshops(),
      getAllQuestions().catch(() => []),
    ])
    setTests(t)
    setAttempts(a)
    setWorkshops(w)
    setQuestions(q)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const attemptsByTest = useMemo(() => {
    const map = {}
    attempts.forEach((a) => (map[a.testId] = (map[a.testId] || 0) + 1))
    return map
  }, [attempts])

  const questionPoolByTest = useMemo(() => {
    const map = {}
    tests.forEach((t) => {
      const match = questions.filter((qn) => {
        const matchWorkshop = qn.workshopId
          ? qn.workshopId === t.workshopId
          : (!t.workshopId || t.workshopId === 'excel-analytics')
        const matchType = qn.testType === t.testType
        const matchDay =
          t.testType === 'Day-wise Test' ? Number(qn.dayNumber) === Number(t.dayNumber) : true
        return matchWorkshop && matchType && matchDay
      })
      map[t.id] = match.length
    })
    return map
  }, [tests, questions])

  const filteredTests = useMemo(() => {
    if (fWorkshop === 'All') return tests
    return tests.filter((t) => t.workshopId === fWorkshop || (!t.workshopId && fWorkshop === 'legacy'))
  }, [tests, fWorkshop])

  // Show tests in natural sequence: Pre-Assessment, Day 1..N, Grand Test.
  const sortedTests = useMemo(() => {
    const key = (t) => {
      if (t.testType === 'Pre-Assessment') return 0
      if (t.testType === 'Grand Test') return 10000
      if (t.testType === 'Day-wise Test') return 100 + (t.dayNumber || 0)
      return 5000
    }
    return [...filteredTests].sort((a, b) => key(a) - key(b))
  }, [filteredTests])

  const toggleActive = async (test) => {
    await updateTest(test.id, { isActive: !test.isActive })
    load()
  }

  const toggleResults = async (test) => {
    await setResultsReleased(test.id, !test.resultsReleased)
    load()
  }

  const confirmDelete = async () => {
    await deleteTest(deleteId)
    setDeleteId(null)
    load()
  }

  const handleWorkshopChange = (val) => {
    setFWorkshop(val)
    if (val === 'All') {
      searchParams.delete('workshopId')
      setSearchParams(searchParams)
    } else {
      setSearchParams({ workshopId: val })
    }
  }

  if (loading) return <Loader />

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Manage Tests ({filteredTests.length})</h1>
          <p className="mt-1 text-xs text-slate-500">
            Activate, hide results, or manage test schedules across workshops.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500">Workshop</label>
            <select
              className="input text-xs py-1.5"
              value={fWorkshop}
              onChange={(e) => handleWorkshopChange(e.target.value)}
            >
              <option value="All">All Workshops</option>
              {workshops.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          <Link
            to={fWorkshop !== 'All' ? `/admin/create-test?workshopId=${fWorkshop}` : '/admin/create-test'}
            className="btn-primary"
          >
            + Create Test
          </Link>
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-400 sm:hidden">Swipe the table sideways to see more columns →</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">Title</th>
              <th>Workshop</th>
              <th>Type</th>
              <th>Day</th>
              <th>Target Qs</th>
              <th>Bank Pool</th>
              <th>Duration</th>
              <th>Attempts</th>
              <th>Status</th>
              <th>Results</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedTests.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{t.testTitle}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-700">
                    {t.workshopName || (workshops.find((w) => w.id === t.workshopId)?.name) || 'General'}
                  </span>
                </td>
                <td>{t.testType}</td>
                <td>{t.dayNumber || '—'}</td>
                <td>{t.totalQuestions}</td>
                <td>
                  {(questionPoolByTest[t.id] ?? 0) === 0 ? (
                    <span className="badge bg-amber-100 text-amber-700 font-semibold" title="No questions in bank for this test">
                      ⚠️ 0 in bank
                    </span>
                  ) : (
                    <span className="badge bg-blue-50 text-blue-700 font-medium">
                      {questionPoolByTest[t.id]} Qs
                    </span>
                  )}
                </td>
                <td>{t.duration} min</td>
                <td><span className="badge bg-brand/10 text-brand">{attemptsByTest[t.id] || 0}</span></td>
                <td>
                  <span className={`badge ${t.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {t.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <span className={`badge ${t.resultsReleased ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.resultsReleased ? 'Released' : 'Hidden'}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => toggleActive(t)}>
                      {t.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className={t.resultsReleased ? 'btn-secondary' : 'btn-primary'}
                      onClick={() => toggleResults(t)}
                    >
                      {t.resultsReleased ? 'Hide Results' : 'Release Results'}
                    </button>
                    <Link
                      to={`/admin/questions?workshopId=${t.workshopId || ''}`}
                      className="btn-secondary"
                      title="Manage question bank for this workshop"
                    >
                      Questions
                    </Link>
                    <button className="btn-danger" onClick={() => setDeleteId(t.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {sortedTests.length === 0 && (
              <tr>
                <td colSpan={11} className="py-6 text-center text-slate-400">
                  No tests found for this workshop. Click "+ Create Test" to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!deleteId}
        title="Delete Test?"
        message="Students will no longer see this test. Existing results are kept."
        confirmText="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
