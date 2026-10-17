import { useEffect, useMemo, useState } from 'react'
import { getAllAttempts } from '../../services/attemptService'
import { getAllStudents, syncResultsWithStudents } from '../../services/studentService'
import { exportToCSV, exportToExcel } from '../../utils/export'
import Loader from '../../components/Loader'
import Alert from '../../components/Alert'

export default function ViewResults() {
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const [search, setSearch] = useState('')
  const [workshop, setWorkshop] = useState('All')
  const [testType, setTestType] = useState('All')
  const [branch, setBranch] = useState('All')
  const [section, setSection] = useState('All')
  const [batch, setBatch] = useState('All')
  const [minScore, setMinScore] = useState('')
  const [maxScore, setMaxScore] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([getAllAttempts(), getAllStudents()]).then(([a, students]) => {
      // Overlay each attempt with the student's current branch/section/batch/workshop.
      const byId = {}
      students.forEach((s) => (byId[s.id] = s))
      const enriched = a
        .filter((x) => x.attempted)
        .map((att) => {
          const s = byId[att.studentId]
          return s
            ? {
                ...att,
                studentName: s.name ?? att.studentName,
                usn: s.usn ?? att.usn,
                branch: s.branch ?? att.branch,
                section: s.section ?? att.section,
                batch: s.batch ?? att.batch ?? null,
                workshopName: att.workshopName || s.workshopName || 'General',
              }
            : {
                ...att,
                workshopName: att.workshopName || 'General',
              }
        })
      setAttempts(enriched)
      setLoading(false)
    })
  }
  useEffect(() => { load() }, [])

  const handleSync = async () => {
    setSyncing(true)
    setMsg({ type: 'info', text: 'Syncing results with current student details…' })
    try {
      const n = await syncResultsWithStudents()
      setMsg({ type: 'success', text: `Synced ${n} records with current student data.` })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSyncing(false)
    }
  }

  const workshops = ['All', ...new Set(attempts.map((a) => a.workshopName).filter(Boolean))]
  const testTypes = ['All', ...new Set(attempts.map((a) => a.testType).filter(Boolean))]
  const branches = ['All', ...new Set(attempts.map((a) => a.branch).filter(Boolean))]
  const sections = ['All', ...new Set(attempts.map((a) => a.section).filter(Boolean))]
  const batches = ['All', ...new Set(attempts.map((a) => a.batch).filter(Boolean))]

  const filtered = useMemo(() => attempts.filter((a) => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.studentName?.toLowerCase().includes(q) || a.usn?.toLowerCase().includes(q)
    const matchWorkshop = workshop === 'All' || a.workshopName === workshop
    const matchType = testType === 'All' || a.testType === testType
    const matchBranch = branch === 'All' || a.branch === branch
    const matchSection = section === 'All' || a.section === section
    const matchBatch = batch === 'All' || a.batch === batch
    const p = a.percentage ?? 0
    const matchMin = minScore === '' || p >= Number(minScore)
    const matchMax = maxScore === '' || p <= Number(maxScore)
    return matchSearch && matchWorkshop && matchType && matchBranch && matchSection && matchBatch && matchMin && matchMax
  }), [attempts, search, workshop, testType, branch, section, batch, minScore, maxScore])

  const rows = filtered.map((a) => ({
    Name: a.studentName, USN: a.usn, Workshop: a.workshopName || 'General',
    Branch: a.branch, Section: a.section, Batch: a.batch || '',
    Test: a.testTitle, Type: a.testType, Score: a.score, Percentage: a.percentage, Status: a.status,
  }))

  if (loading) return <Loader />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Results ({filtered.length})</h1>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={load}>↻ Refresh</button>
          <button className="btn-secondary" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync with student data'}
          </button>
          <button className="btn-secondary" onClick={() => exportToCSV(rows, 'results.csv')}>Export CSV</button>
          <button className="btn-primary" onClick={() => exportToExcel(rows, 'results.xlsx', 'Results')}>Export Excel</button>
        </div>
      </div>

      {msg.text && <div className="mb-4"><Alert type={msg.type} onClose={() => setMsg({ type: '', text: '' })} autoCloseMs={msg.type === 'error' ? undefined : 5000}>{msg.text}</Alert></div>}

      <div className="card mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
        <div>
          <label className="label">Search</label>
          <input className="input" placeholder="Name / USN" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="label">Workshop</label>
          <select className="input" value={workshop} onChange={(e) => setWorkshop(e.target.value)}>
            {workshops.map((w) => <option key={w}>{w}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Test Type</label>
          <select className="input" value={testType} onChange={(e) => setTestType(e.target.value)}>
            {testTypes.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Branch</label>
          <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Section</label>
          <select className="input" value={section} onChange={(e) => setSection(e.target.value)}>
            {sections.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Batch</label>
          <select className="input" value={batch} onChange={(e) => setBatch(e.target.value)}>
            {batches.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Min %</label>
          <input className="input" type="number" placeholder="0" value={minScore} onChange={(e) => setMinScore(e.target.value)} />
        </div>
        <div>
          <label className="label">Max %</label>
          <input className="input" type="number" placeholder="100" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} />
        </div>
      </div>

      <p className="mb-2 text-xs text-slate-400 sm:hidden">Swipe the table sideways to see more columns →</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">Name</th><th>USN</th><th>Workshop</th><th>Branch</th><th>Sec</th><th>Batch</th><th>Test</th><th>Score</th><th>%</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{a.studentName}</td>
                <td>{a.usn}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-700">
                    {a.workshopName || (workshops.find((w) => w.id === a.workshopId)?.name) || 'General'}
                  </span>
                </td>
                <td>{a.branch}</td>
                <td>{a.section}</td>
                <td>{a.batch || '—'}</td>
                <td className="text-slate-500">{a.testTitle}</td>
                <td>{a.score}</td>
                <td className="font-semibold">{a.percentage}%</td>
                <td>
                  <span className={`badge ${a.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="py-6 text-center text-slate-400">No results match these filters. Try clearing the search or filters above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
