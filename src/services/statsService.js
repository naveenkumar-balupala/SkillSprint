// Admin dashboard statistics — aggregates students, tests, attempts, results.
// All computation happens client-side over Firestore reads so the admin can
// view live numbers from any device.
import { getAllStudents } from './studentService'
import { getAllTests } from './testService'
import { getAllAttempts, getAllResults } from './attemptService'

const round2 = (n) => Math.round(n * 100) / 100

// Pure aggregator over a (possibly filtered) data set. The Statistics page
// passes already-filtered students/tests/attempts/results to view the report
// batch-wise or test-wise; the dashboard passes the full set.
export function computeStats({ students = [], tests = [], attempts = [], results = [] }) {
  const submitted = attempts // caller passes only submitted attempts
  const scores = submitted.map((a) => a.percentage ?? 0)

  const cards = {
    totalStudents: students.length,
    totalTests: tests.length,
    totalAttempts: submitted.length,
    averageScore: scores.length ? round2(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
    highestScore: scores.length ? round2(Math.max(...scores)) : 0,
    lowestScore: scores.length ? round2(Math.min(...scores)) : 0,
    passPercentage: submitted.length
      ? round2((submitted.filter((a) => a.status === 'Pass').length / submitted.length) * 100)
      : 0,
    notAttemptedCount: Math.max(students.length * tests.length - submitted.length, 0),
  }

  // ---- Test-wise performance ----
  const byTest = {}
  for (const t of tests) byTest[t.id] = { name: t.testTitle, type: t.testType, day: t.dayNumber, attempts: 0, totalPct: 0 }
  for (const a of submitted) {
    if (!byTest[a.testId]) byTest[a.testId] = { name: a.testTitle, type: a.testType, day: a.dayNumber, attempts: 0, totalPct: 0 }
    byTest[a.testId].attempts++
    byTest[a.testId].totalPct += a.percentage ?? 0
  }
  const testWise = Object.values(byTest)
    .filter((t) => t.attempts > 0 || tests.length <= 12)
    .sort((a, b) => testSortKey(a) - testSortKey(b))
    .map((t) => ({
      name: t.name,
      attempts: t.attempts,
      avgScore: t.attempts ? round2(t.totalPct / t.attempts) : 0,
    }))

  const sectionWise = groupAvg(submitted, 'section')
  const branchWise = groupAvg(submitted, 'branch')
  const batchWise = groupAvg(submitted, 'batch')
  const workshopWise = groupAvg(submitted, 'workshopName')

  // ---- Topic-wise (weak areas) from results ----
  const topicAgg = {}
  for (const r of results) {
    const tw = r.topicWisePerformance || {}
    for (const [topic, v] of Object.entries(tw)) {
      topicAgg[topic] = topicAgg[topic] || { correct: 0, total: 0 }
      topicAgg[topic].correct += v.correct || 0
      topicAgg[topic].total += v.total || 0
    }
  }
  const topicWise = Object.entries(topicAgg)
    .map(([topic, v]) => ({
      topic,
      accuracy: v.total ? round2((v.correct / v.total) * 100) : 0,
      correct: v.correct,
      total: v.total,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)

  // ---- Day-wise progress ----
  const dayAgg = {}
  for (const a of submitted.filter((x) => x.testType === 'Day-wise Test' && x.dayNumber)) {
    const k = `Day ${a.dayNumber}`
    dayAgg[k] = dayAgg[k] || { total: 0, count: 0 }
    dayAgg[k].total += a.percentage ?? 0
    dayAgg[k].count++
  }
  const dayWise = Object.entries(dayAgg)
    .map(([name, v]) => ({ name, avgScore: round2(v.total / v.count) }))
    .sort((a, b) => parseInt(a.name.split(' ')[1]) - parseInt(b.name.split(' ')[1]))

  // ---- Grand test distribution ----
  const grand = submitted.filter((a) => a.testType === 'Grand Test')
  const grandBuckets = scoreBuckets(grand.map((g) => g.percentage ?? 0))

  return { cards, testWise, sectionWise, branchWise, batchWise, workshopWise, topicWise, dayWise, grandBuckets }
}

// Overlay each attempt/result with the student's CURRENT profile fields, looked
// up live by studentId. This guarantees statistics/results always reflect the
// latest edits even if the denormalized copy on the doc is stale.
function withCurrentStudent(items, studentsById) {
  return items.map((x) => {
    const s = studentsById[x.studentId]
    if (!s) return x
    return {
      ...x,
      studentName: s.name ?? x.studentName,
      usn: s.usn ?? x.usn,
      branch: s.branch ?? x.branch,
      section: s.section ?? x.section,
      batch: s.batch ?? x.batch ?? null,
      workshopId: x.workshopId ?? s.workshopId ?? null,
      workshopName: x.workshopName ?? s.workshopName ?? null,
    }
  })
}

export async function buildDashboard() {
  const [students, tests, attempts, results] = await Promise.all([
    getAllStudents(),
    getAllTests(),
    getAllAttempts(),
    getAllResults(),
  ])
  const studentsById = {}
  students.forEach((s) => (studentsById[s.id] = s))

  const submitted = withCurrentStudent(attempts.filter((a) => a.attempted), studentsById)
  const liveResults = withCurrentStudent(results, studentsById)

  const metrics = computeStats({ students, tests, attempts: submitted, results: liveResults })
  return { ...metrics, students, tests, attempts: submitted, results: liveResults }
}

// Logical test ordering for charts: Pre-Assessment, Day 1..N, then Grand Test.
function testSortKey(t) {
  if (t.type === 'Pre-Assessment') return 0
  if (t.type === 'Grand Test') return 10000
  if (t.type === 'Day-wise Test') return 100 + (t.day || 0)
  return 5000 // any other type sits between day-wise and grand
}

function groupAvg(items, key) {
  const agg = {}
  for (const a of items) {
    const k = a[key] || 'Unknown'
    agg[k] = agg[k] || { total: 0, count: 0, pass: 0 }
    agg[k].total += a.percentage ?? 0
    agg[k].count++
    if (a.status === 'Pass') agg[k].pass++
  }
  return Object.entries(agg).map(([name, v]) => ({
    name,
    avgScore: v.count ? round2(v.total / v.count) : 0,
    attempts: v.count,
    passRate: v.count ? round2((v.pass / v.count) * 100) : 0,
  }))
}

function scoreBuckets(percentages) {
  const buckets = [
    { name: '0-40', value: 0 },
    { name: '41-60', value: 0 },
    { name: '61-80', value: 0 },
    { name: '81-100', value: 0 },
  ]
  for (const p of percentages) {
    if (p <= 40) buckets[0].value++
    else if (p <= 60) buckets[1].value++
    else if (p <= 80) buckets[2].value++
    else buckets[3].value++
  }
  return buckets
}
