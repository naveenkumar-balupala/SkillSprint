import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildDashboard, computeStats } from '../../services/statsService'
import Loader from '../../components/Loader'
import StatCard from '../../components/StatCard'
import Alert from '../../components/Alert'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell, LabelList,
} from 'recharts'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batch, setBatch] = useState('All')
  const [workshop, setWorkshop] = useState('All')

  useEffect(() => {
    buildDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loader message="Building dashboard…" />
  if (error) return <Alert type="error">{error}</Alert>

  // Batch & Workshop filters
  const batchOptions = ['All', ...new Set(data.students.map((s) => s.batch).filter(Boolean))]
  const workshopOptions = [
    'All',
    ...new Set([
      ...data.tests.map((t) => t.workshopName).filter(Boolean),
      ...data.students.map((s) => s.workshopName).filter(Boolean),
    ]),
  ]

  const inBatch = (x) => batch === 'All' || (x.batch || 'Unknown') === batch
  const inWorkshop = (x) =>
    workshop === 'All' ||
    x.workshopName === workshop ||
    (!x.workshopName && (workshop === 'General' || workshop === 'excel-analytics'))

  const fStudents = data.students.filter((s) => inBatch(s) && inWorkshop(s))
  const fTests = data.tests.filter((t) => inWorkshop(t))
  const fAttempts = data.attempts.filter((a) => inBatch(a) && inWorkshop(a))
  const fResults = data.results.filter((r) => inBatch(r) && inWorkshop(r))

  const view = computeStats({
    students: fStudents,
    tests: fTests,
    attempts: fAttempts,
    results: fResults,
  })

  const { cards, testWise, topicWise } = view
  const topPerformers = [...fAttempts].sort((a, b) => b.percentage - a.percentage).slice(0, 5)
  const needHelp = [...fAttempts].filter((a) => a.status !== 'Pass').slice(0, 5)

  // Batch-wise student count (+ attempts) for the dashboard.
  const byBatch = {}
  fStudents.forEach((s) => {
    const k = s.batch || 'Unknown'
    byBatch[k] = (byBatch[k] || 0) + 1
  })
  const batchData = Object.entries(byBatch).map(([name, students]) => ({
    name,
    students,
    attempts: view.batchWise.find((b) => b.name === name)?.attempts || 0,
  }))

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-500">Workshop</label>
            <select className="input w-44" value={workshop} onChange={(e) => setWorkshop(e.target.value)}>
              {workshopOptions.map((w) => <option key={w}>{w}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-500">Batch</label>
            <select className="input w-36" value={batch} onChange={(e) => setBatch(e.target.value)}>
              {batchOptions.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <Link to="/admin/statistics" className="btn-secondary">Full Statistics</Link>
          <Link to="/admin/export" className="btn-primary">Export Reports</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Students" value={cards.totalStudents} accent="blue" />
        <StatCard label="Total Tests" value={cards.totalTests} accent="slate" />
        <StatCard label="Total Attempts" value={cards.totalAttempts} accent="brand" />
        <StatCard label="Average Score" value={cards.averageScore} suffix="%" accent="brand" />
        <StatCard label="Highest Score" value={cards.highestScore} suffix="%" accent="green" />
        <StatCard label="Lowest Score" value={cards.lowestScore} suffix="%" accent="red" />
        <StatCard label="Pass %" value={cards.passPercentage} suffix="%" accent="green" />
        <StatCard label="Not Attempted" value={cards.notAttemptedCount} accent="slate" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-semibold text-slate-800">Test-wise Average Score (%)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={testWise}>
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} height={60} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="avgScore" fill="#ea580c" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="avgScore" position="top" formatter={(v) => `${v}%`} className="fill-slate-600" style={{ fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="mb-3 font-semibold text-slate-800">Weakest Topics (lowest accuracy)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={topicWise.slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" domain={[0, 100]} />
              <YAxis type="category" dataKey="topic" width={130} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
                {topicWise.slice(0, 8).map((d, i) => (
                  <Cell key={i} fill={d.accuracy >= 50 ? '#16a34a' : '#dc2626'} />
                ))}
                <LabelList dataKey="accuracy" position="right" formatter={(v) => `${v}%`} className="fill-slate-600" style={{ fontSize: 11, fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 card">
        <h3 className="mb-3 font-semibold text-slate-800">Batch-wise Count (students &amp; attempts)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={batchData}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip /><Legend />
            <Bar dataKey="students" name="Students" fill="#0ea5e9" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="students" position="top" className="fill-slate-600" style={{ fontSize: 11, fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="attempts" name="Attempts" fill="#ea580c" radius={[4, 4, 0, 0]}>
              <LabelList dataKey="attempts" position="top" className="fill-slate-600" style={{ fontSize: 11, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <MiniTable title="🏆 Top Performers" rows={topPerformers} empty="No attempts yet." />
        <MiniTable title="📘 Students Needing Improvement" rows={needHelp} empty="Everyone is passing!" />
      </div>
    </div>
  )
}

function MiniTable({ title, rows, empty }) {
  return (
    <div className="card">
      <h3 className="mb-3 font-semibold text-slate-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-1">Name</th><th>Test</th><th>%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="py-1.5">{r.studentName}</td>
                <td className="text-slate-500">{r.testTitle}</td>
                <td className="font-semibold">{r.percentage}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
