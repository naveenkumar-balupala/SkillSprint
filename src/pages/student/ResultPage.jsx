import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getResult } from '../../services/attemptService'
import { getTest } from '../../services/testService'
import Loader from '../../components/Loader'
import StatCard from '../../components/StatCard'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'

const COLORS = ['#16a34a', '#dc2626', '#f59e0b', '#3b82f6']

export default function ResultPage() {
  const { testId } = useParams()
  const { profile } = useAuth()
  const [result, setResult] = useState(null)
  const [test, setTest] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    // Fetch the test first. Only read the (rules-protected) result doc once the
    // admin has released results — otherwise the read is denied by design.
    getTest(testId)
      .then((t) => {
        setTest(t)
        if (t && t.resultsReleased) {
          return getResult(profile.id, testId).then(setResult)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [profile, testId])

  if (loading) return <Loader message="Loading your result…" />

  // Gate: results stay hidden until the admin releases them for this test.
  if (test && !test.resultsReleased)
    return (
      <div className="mx-auto max-w-xl card text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">🔒</div>
        <h1 className="text-xl font-bold text-slate-800">Test Submitted Successfully</h1>
        <p className="mt-2 text-sm text-slate-500">
          Your responses for <b>{test.testTitle}</b> have been recorded. Your score and
          answer review will be visible here once the admin <b>releases the results</b>.
        </p>
        <Link to="/dashboard" className="btn-primary mt-5">Back to Dashboard</Link>
      </div>
    )

  if (!result)
    return (
      <div className="mx-auto max-w-xl card text-center">
        <p className="text-slate-600">No result found for this test.</p>
        <Link to="/dashboard" className="btn-primary mt-4">Back to Dashboard</Link>
      </div>
    )

  const topicData = Object.entries(result.topicWisePerformance || {}).map(([topic, v]) => ({
    topic,
    accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
  }))
  const diffData = Object.entries(result.difficultyWisePerformance || {}).map(([difficulty, v]) => ({
    difficulty,
    accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
  }))
  const answerSplit = [
    { name: 'Correct', value: result.correctCount },
    { name: 'Wrong', value: result.wrongCount },
    { name: 'Unattempted', value: result.unattemptedCount },
  ]

  const pass = result.status === 'Pass'

  return (
    <div className="mx-auto max-w-4xl">
      <div className={`rounded-2xl p-6 text-white ${pass ? 'bg-green-600' : 'bg-amber-600'}`}>
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="text-sm opacity-90">{result.testTitle}</p>
          {(result.workshopName || test?.workshopName) && (
            <span className="badge bg-white/20 text-white text-xs">
              {result.workshopName || test?.workshopName}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-extrabold">{result.percentage}%</h1>
        <p className="mt-2 flex items-center gap-2 font-semibold">
          <span className="badge bg-white/20 text-white">{pass ? 'Pass' : 'Needs Improvement'}</span>
          <span>Score {result.score}/{result.questionSnapshot?.length || result.correctCount + result.wrongCount + result.unattemptedCount}</span>
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Correct" value={result.correctCount} accent="green" />
        <StatCard label="Wrong" value={result.wrongCount} accent="red" />
        <StatCard label="Attempted" value={result.attemptedCount} accent="blue" />
        <StatCard label="Unattempted" value={result.unattemptedCount} accent="slate" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 font-semibold text-slate-800">Answer Breakdown</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={answerSplit} dataKey="value" nameKey="name" outerRadius={80} label>
                {answerSplit.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="mb-3 font-semibold text-slate-800">Difficulty-wise Accuracy (%)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={diffData}>
              <XAxis dataKey="difficulty" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#ea580c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="mb-3 font-semibold text-slate-800">Topic-wise Accuracy (%)</h3>
        <ResponsiveContainer width="100%" height={Math.max(240, topicData.length * 34)}>
          <BarChart data={topicData} layout="vertical" margin={{ left: 30 }}>
            <XAxis type="number" domain={[0, 100]} />
            <YAxis type="category" dataKey="topic" width={140} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="accuracy" radius={[0, 4, 4, 0]}>
              {topicData.map((d, i) => (
                <Cell key={i} fill={d.accuracy >= 50 ? '#16a34a' : '#dc2626'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-2 text-xs text-slate-400">Red bars are weak topics (below 50%).</p>
      </div>

      <div className="mt-6 flex gap-3">
        <Link to="/dashboard" className="btn-primary">Back to Dashboard</Link>
        <Link to="/profile" className="btn-secondary">View Test History</Link>
      </div>
    </div>
  )
}
