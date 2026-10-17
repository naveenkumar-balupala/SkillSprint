import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getStudentAttempts } from '../../services/attemptService'
import Loader from '../../components/Loader'

export default function Profile() {
  const { profile, user } = useAuth()
  const [attempts, setAttempts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    getStudentAttempts(profile.id).then((a) => {
      setAttempts(a)
      setLoading(false)
    })
  }, [profile])

  const field = (label, value) => (
    <div className="flex justify-between border-b border-slate-100 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value || '—'}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold text-slate-800">My Profile</h1>
      <div className="card">
        {field('Full Name', profile?.name)}
        {field('USN / Roll Number', profile?.usn)}
        {field('Email', user?.email)}
        {field('Phone', profile?.phone)}
        {field('Branch', profile?.branch)}
        {field('Section', profile?.section)}
        {field('Batch', profile?.batch)}
        {field('Enrolled Workshop', profile?.workshopName || 'General Workshop')}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold text-slate-800">Test History</h2>
      {loading ? (
        <Loader />
      ) : attempts.length === 0 ? (
        <div className="card text-sm text-slate-500">No tests attempted yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2">Test</th>
                <th>Score</th>
                <th>%</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <div className="font-medium text-slate-800">{a.testTitle}</div>
                    {a.workshopName && (
                      <span className="badge bg-slate-100 text-slate-600 text-xs mt-0.5">
                        {a.workshopName}
                      </span>
                    )}
                  </td>
                  <td>{a.score}</td>
                  <td>{a.percentage}%</td>
                  <td>
                    <span className={`badge ${a.status === 'Pass' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
