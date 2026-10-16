import { useEffect, useMemo, useState } from 'react'
import { buildDashboard, computeStats } from '../../services/statsService'
import Loader from '../../components/Loader'
import Alert from '../../components/Alert'
import StatCard from '../../components/StatCard'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, Cell, PieChart, Pie, LabelList,
} from 'recharts'

const COLORS = ['#dc2626', '#f59e0b', '#3b82f6', '#16a34a']

const valueLabel = (position = 'top') => (
  <LabelList position={position} className="fill-slate-600" style={{ fontSize: 11, fontWeight: 600 }} />
)

function ChartCard({ title, children, note }) {
  return (
    <div className="card">
      <h3 className="mb-3 font-semibold text-slate-800">{title}</h3>
      <ResponsiveContainer width="100%" height={280}>{children}</ResponsiveContainer>
      {note && <p className="mt-2 text-xs text-slate-400">{note}</p>}
    </div>
  )
}

export default function Statistics() {
  const [raw, setRaw] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [workshop, setWorkshop] = useState('All')
  const [batch, setBatch] = useState('All')
  const [testId, setTestId] = useState('All')

  const reload = () => {
    setLoading(true)
    buildDashboard()
      .then(setRaw)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [])

  // Workshop & Batch options
  const workshopOptions = useMemo(() => {
    if (!raw) return ['All']
    return ['All', ...new Set([
      ...raw.tests.map((t) => t.workshopName).filter(Boolean),
      ...raw.students.map((s) => s.workshopName).filter(Boolean),
    ])]
  }, [raw])

  const availableTests = useMemo(() => {
    if (!raw) return []
    if (workshop === 'All') return raw.tests
    return raw.tests.filter((t) => t.workshopName === workshop || (!t.workshopName && workshop === 'Excel for Data Analytics'))
  }, [raw, workshop])

  // Recompute metrics for the selected workshop / batch / test filter.
  const data = useMemo(() => {
    if (!raw) return null
    const inWorkshop = (x) =>
      workshop === 'All' ||
      x.workshopName === workshop ||
      (!x.workshopName && workshop === 'Excel for Data Analytics')
    const inBatch = (x) => batch === 'All' || (x.batch || 'Unknown') === batch
    const inTest = (x) => testId === 'All' || x.testId === testId

    return computeStats({
      students: raw.students.filter((s) => inBatch(s) && inWorkshop(s)),
      tests: raw.tests.filter((t) => inWorkshop(t) && inTest(t)),
      attempts: raw.attempts.filter((a) => inWorkshop(a) && inBatch(a) && inTest(a)),
      results: raw.results.filter((r) => inWorkshop(r) && inBatch(r) && inTest(r)),
    })
  }, [raw, workshop, batch, testId])

  if (error) return <Alert type="error">{error}</Alert>
  if (loading || !data) return <Loader message="Crunching statistics…" />

  const { cards, testWise, sectionWise, branchWise, batchWise, topicWise, dayWise, grandBuckets } = data
  const batchOptions = ['All', ...new Set(raw.students.map((s) => s.batch || 'Unknown').filter(Boolean))]
  const activeTest = testId === 'All' ? 'All Tests' : (raw.tests.find((t) => t.id === testId)?.testTitle || 'Test')

  return (
    <div>
      {/* ---- Toolbar (hidden when printing) ---- */}
      <div className="no-print mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Statistics &amp; Reports</h1>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Workshop</label>
            <select
              className="input"
              value={workshop}
              onChange={(e) => {
                setWorkshop(e.target.value)
                setTestId('All')
              }}
            >
              {workshopOptions.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Batch</label>
            <select className="input" value={batch} onChange={(e) => setBatch(e.target.value)}>
              {batchOptions.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Test</label>
            <select className="input" value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="All">All Tests</option>
              {availableTests.map((t) => <option key={t.id} value={t.id}>{t.testTitle}</option>)}
            </select>
          </div>
          <button className="btn-secondary" onClick={reload}>↻ Refresh</button>
          <button className="btn-primary" onClick={() => window.print()}>🖨 Print / Save PDF</button>
        </div>
      </div>

      {/* ---- Printed report header (only visible when printing) ---- */}
      <div className="print-only mb-4 hidden">
        <h1 className="text-2xl font-bold text-slate-800">Assessment Statistics Report</h1>
        <p className="text-sm text-slate-600">
          Workshop: <b>{workshop}</b> · Batch: <b>{batch}</b> · Test: <b>{activeTest}</b>
        </p>
      </div>

      {/* ---- Summary cards ---- */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={cards.totalStudents} accent="blue" />
        <StatCard label="Attempts" value={cards.totalAttempts} accent="brand" />
        <StatCard label="Average Score" value={cards.averageScore} suffix="%" accent="brand" />
        <StatCard label="Pass %" value={cards.passPercentage} suffix="%" accent="green" />
        <StatCard label="Highest" value={cards.highestScore} suffix="%" accent="green" />
        <StatCard label="Lowest" value={cards.lowestScore} suffix="%" accent="red" />
        <StatCard label="Tests" value={cards.totalTests} accent="slate" />
        <StatCard label="Not Attempted" value={cards.notAttemptedCount} accent="slate" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Test-wise Performance (avg %)">
          <BarChart data={testWise}>
            <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} height={60} />
            <YAxis domain={[0, 100]} />
            <Tooltip /><Legend />
            <Bar dataKey="avgScore" name="Avg %" fill="#ea580c" radius={[4, 4, 0, 0]}>{valueLabel()}</Bar>
            <Bar dataKey="attempts" name="Attempts" fill="#94a3b8" radius={[4, 4, 0, 0]}>{valueLabel()}</Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Batch-wise Performance (avg %)">
          <BarChart data={batchWise}>
            <XAxis dataKey="name" /><YAxis domain={[0, 100]} />
            <Tooltip /><Legend />
            <Bar dataKey="avgScore" name="Avg %" fill="#0ea5e9" radius={[4, 4, 0, 0]}>{valueLabel()}</Bar>
            <Bar dataKey="passRate" name="Pass %" fill="#16a34a" radius={[4, 4, 0, 0]}>{valueLabel()}</Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Section-wise Performance (avg %)">
          <BarChart data={sectionWise}>
            <XAxis dataKey="name" /><YAxis domain={[0, 100]} />
            <Tooltip /><Legend />
            <Bar dataKey="avgScore" name="Avg %" fill="#3b82f6" radius={[4, 4, 0, 0]}>{valueLabel()}</Bar>
            <Bar dataKey="passRate" name="Pass %" fill="#16a34a" radius={[4, 4, 0, 0]}>{valueLabel()}</Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Branch-wise Performance (avg %)">
          <BarChart data={branchWise}>
            <XAxis dataKey="name" /><YAxis domain={[0, 100]} />
            <Tooltip /><Legend />
            <Bar dataKey="avgScore" name="Avg %" fill="#8b5cf6" radius={[4, 4, 0, 0]}>{valueLabel()}</Bar>
          </BarChart>
        </ChartCard>

        <ChartCard title="Day-wise Test Progress (avg %)" note="Average score trend across the 6 day-wise tests.">
          <LineChart data={dayWise}>
            <XAxis dataKey="name" /><YAxis domain={[0, 100]} />
            <Tooltip />
            <Line type="monotone" dataKey="avgScore" stroke="#ea580c" strokeWidth={2}>{valueLabel('top')}</Line>
          </LineChart>
        </ChartCard>

        <ChartCard title="Grand Test Performance (distribution)" note="Number of students per score band.">
          <PieChart>
            <Pie data={grandBuckets} dataKey="value" nameKey="name" outerRadius={90} label>
              {grandBuckets.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Legend /><Tooltip />
          </PieChart>
        </ChartCard>

        <ChartCard title="Topic-wise Weak Areas (accuracy %)" note="Red = below 50% (needs reteaching).">
          <BarChart data={topicWise.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="topic" width={130} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
              {topicWise.slice(0, 10).map((d, i) => (
                <Cell key={i} fill={d.accuracy >= 50 ? '#16a34a' : '#dc2626'} />
              ))}
              <LabelList dataKey="accuracy" position="right" formatter={(v) => `${v}%`} style={{ fontSize: 11, fontWeight: 600 }} className="fill-slate-600" />
            </Bar>
          </BarChart>
        </ChartCard>
      </div>

      {/* Topic-wise analysis table */}
      <div className="card mt-6 overflow-x-auto">
        <h3 className="mb-3 font-semibold text-slate-800">Topic-wise Analysis</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2">Topic</th><th>Correct</th><th>Total</th><th>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {topicWise.map((t) => (
              <tr key={t.topic} className="border-t border-slate-100">
                <td className="py-2 font-medium">{t.topic}</td>
                <td>{t.correct}</td>
                <td>{t.total}</td>
                <td>
                  <span className={`badge ${t.accuracy >= 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {t.accuracy}%
                  </span>
                </td>
              </tr>
            ))}
            {topicWise.length === 0 && (
              <tr><td colSpan={4} className="py-6 text-center text-slate-400">No data for this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
