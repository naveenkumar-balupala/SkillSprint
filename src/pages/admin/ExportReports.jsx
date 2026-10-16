import { useEffect, useState } from 'react'
import { buildDashboard } from '../../services/statsService'
import { exportToCSV, exportToExcel } from '../../utils/export'
import Loader from '../../components/Loader'
import StatCard from '../../components/StatCard'

// Central place to export every report as CSV or Excel.
export default function ExportReports() {
  const [data, setData] = useState(null)
  const [workshop, setWorkshop] = useState('All')
  const [batch, setBatch] = useState('All')

  useEffect(() => {
    buildDashboard().then(setData)
  }, [])

  if (!data) return <Loader />

  const { students, attempts, tests, testWise, sectionWise, branchWise, batchWise, topicWise, cards } = data

  const workshopOptions = [
    'All',
    ...new Set([
      ...tests.map((t) => t.workshopName).filter(Boolean),
      ...students.map((s) => s.workshopName).filter(Boolean),
    ]),
  ]
  const batchOptions = ['All', ...new Set(students.map((s) => s.batch).filter(Boolean))]

  const inBatch = (x) => batch === 'All' || x.batch === batch
  const inWorkshop = (x) =>
    workshop === 'All' ||
    x.workshopName === workshop ||
    (!x.workshopName && workshop === 'Excel for Data Analytics')

  const fStudents = students.filter((s) => inBatch(s) && inWorkshop(s))
  const fTests = tests.filter((t) => inWorkshop(t))
  const fAttempts = attempts.filter((a) => inBatch(a) && inWorkshop(a))

  const workshopSuffix = workshop === 'All' ? '' : `-${workshop.replace(/\s+/g, '_')}`
  const batchSuffix = batch === 'All' ? '' : `-${batch}`
  const fileSuffix = `${workshopSuffix}${batchSuffix}`

  const studentRows = fStudents.map((s) => ({
    Name: s.name,
    USN: s.usn,
    Email: s.email,
    Phone: s.phone,
    Workshop: s.workshopName || 'Excel for Data Analytics',
    Branch: s.branch,
    Section: s.section,
    Batch: s.batch || '',
  }))

  const resultRows = fAttempts.map((a) => ({
    Name: a.studentName,
    USN: a.usn,
    Workshop: a.workshopName || 'Excel for Data Analytics',
    Branch: a.branch,
    Section: a.section,
    Batch: a.batch || '',
    Test: a.testTitle,
    Type: a.testType,
    Score: a.score,
    Percentage: a.percentage,
    Status: a.status,
  }))

  const notAttempted = buildNotAttempted(fStudents, fTests, fAttempts)

  const activeWorkshopLabel = workshop === 'All' ? '' : ` · ${workshop}`
  const activeBatchLabel = batch === 'All' ? '' : ` · Batch ${batch}`
  const filterLabel = `${activeWorkshopLabel}${activeBatchLabel}`

  const reports = [
    { name: `Student List${filterLabel}`, rows: studentRows, file: `students${fileSuffix}` },
    { name: `All Results${filterLabel}`, rows: resultRows, file: `results${fileSuffix}` },
    { name: `Not Attempted List${filterLabel}`, rows: notAttempted, file: `not-attempted${fileSuffix}` },
    { name: 'Batch-wise Performance', rows: batchWise, file: 'batch-wise' },
    { name: 'Test-wise Performance', rows: testWise, file: 'test-wise' },
    { name: 'Section-wise Performance', rows: sectionWise, file: 'section-wise' },
    { name: 'Branch-wise Performance', rows: branchWise, file: 'branch-wise' },
    { name: 'Topic-wise Analysis', rows: topicWise, file: 'topic-wise' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Export Reports</h1>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Students" value={cards.totalStudents} accent="blue" />
        <StatCard label="Attempts" value={cards.totalAttempts} accent="brand" />
        <StatCard label="Avg Score" value={cards.averageScore} suffix="%" accent="brand" />
        <StatCard label="Pass %" value={cards.passPercentage} suffix="%" accent="green" />
      </div>

      <div className="card mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="label mb-0">Workshop:</label>
          <select
            className="input max-w-xs"
            value={workshop}
            onChange={(e) => setWorkshop(e.target.value)}
          >
            {workshopOptions.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="label mb-0">Batch:</label>
          <select className="input max-w-xs" value={batch} onChange={(e) => setBatch(e.target.value)}>
            {batchOptions.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>

        <p className="text-xs text-slate-500">
          Filters Student List, Results, and Pending attempts by workshop and batch.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {reports.map((r) => (
          <div key={r.file} className="card flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">{r.name}</h3>
              <p className="text-xs text-slate-500">{r.rows.length} rows</p>
            </div>
            <div className="flex gap-2">
              <button
                className="btn-secondary"
                disabled={!r.rows.length}
                onClick={() => exportToCSV(r.rows, `${r.file}.csv`)}
              >
                CSV
              </button>
              <button
                className="btn-primary"
                disabled={!r.rows.length}
                onClick={() => exportToExcel(r.rows, `${r.file}.xlsx`, r.name)}
              >
                Excel
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Cartesian (student x test) minus actual attempts = who still owes which test.
function buildNotAttempted(students, tests, attempts) {
  const done = new Set(attempts.map((a) => `${a.studentId}_${a.testId}`))
  const rows = []
  for (const s of students) {
    for (const t of (tests || [])) {
      if (!done.has(`${s.id}_${t.id}`)) {
        rows.push({
          Name: s.name,
          USN: s.usn,
          Workshop: t.workshopName || s.workshopName || 'Excel for Data Analytics',
          Branch: s.branch,
          Section: s.section,
          Test: t.testTitle,
        })
      }
    }
  }
  return rows
}
