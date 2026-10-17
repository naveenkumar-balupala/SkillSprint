import { useEffect, useMemo, useState } from 'react'
import { getAllStudents, deleteStudent, updateStudent, sendStudentPasswordReset, bulkImportStudents } from '../../services/studentService'
import { getAllAttempts } from '../../services/attemptService'
import { createBatch, deleteBatch, getAllBatches } from '../../services/batchService'
import { getAllWorkshops } from '../../services/workshopService'
import { getSettings, updateSettings } from '../../services/settingsService'
import { exportToCSV, exportToExcel, readSpreadsheet } from '../../utils/export'
import Loader from '../../components/Loader'
import Alert from '../../components/Alert'
import ConfirmModal from '../../components/ConfirmModal'

const BRANCHES = ['CSE', 'ISE', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIML', 'BCA', 'MCA', 'MBA', 'Other']
const SECTIONS = ['A', 'B', 'C', 'D']

export default function ManageStudents() {
  const [students, setStudents] = useState([])
  const [attempts, setAttempts] = useState([])
  const [batches, setBatches] = useState([])
  const [workshops, setWorkshops] = useState([])
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const [newBatch, setNewBatch] = useState('')
  const [deleteBatchId, setDeleteBatchId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // student to delete
  const [editTarget, setEditTarget] = useState(null) // student being edited
  const [editForm, setEditForm] = useState({ name: '', usn: '', email: '', phone: '', branch: '', section: '', batch: '', workshopId: '', workshopName: '' })
  const [savingEdit, setSavingEdit] = useState(false)

  // ---- bulk import ----
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importBatch, setImportBatch] = useState('')
  const [importWorkshopId, setImportWorkshopId] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 })
  const [importResult, setImportResult] = useState(null)

  const [search, setSearch] = useState('')
  const [branch, setBranch] = useState('All')
  const [section, setSection] = useState('All')
  const [batchFilter, setBatchFilter] = useState('All')
  const [workshopFilter, setWorkshopFilter] = useState('All')
  const [sortKey, setSortKey] = useState('usn')
  const [sortDir, setSortDir] = useState('asc')

  const load = async () => {
    const [s, a, b, w, cfg] = await Promise.all([
      getAllStudents(),
      getAllAttempts(),
      getAllBatches(),
      getAllWorkshops(),
      getSettings(),
    ])
    setStudents(s)
    setAttempts(a)
    setBatches(b)
    setWorkshops(w)
    setSettings(cfg)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const toggleSetting = async (key) => {
    const next = !settings[key]
    setSettings((s) => ({ ...s, [key]: next })) // optimistic
    try {
      await updateSettings({ [key]: next })
      setMsg({ type: 'success', text: 'Setting updated.' })
    } catch (err) {
      setSettings((s) => ({ ...s, [key]: !next })) // revert
      setMsg({ type: 'error', text: err.message })
    }
  }

  const attemptCount = useMemo(() => {
    const map = {}
    attempts.forEach((a) => (map[a.studentId] = (map[a.studentId] || 0) + 1))
    return map
  }, [attempts])

  const branches = ['All', ...new Set(students.map((s) => s.branch).filter(Boolean))]
  const sections = ['All', ...new Set(students.map((s) => s.section).filter(Boolean))]
  const batchOptions = ['All', ...new Set(students.map((s) => s.batch).filter(Boolean))]

  const filtered = students.filter((s) => {
    const q = search.toLowerCase()
    const matchSearch =
      !q ||
      s.name?.toLowerCase().includes(q) ||
      s.usn?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    const matchBranch = branch === 'All' || s.branch === branch
    const matchSection = section === 'All' || s.section === section
    const matchBatch = batchFilter === 'All' || s.batch === batchFilter
    const matchWorkshop =
      workshopFilter === 'All' ||
      s.workshopId === workshopFilter ||
      s.workshopName === workshopFilter
    return matchSearch && matchBranch && matchSection && matchBatch && matchWorkshop
  })

  // Sortable: usn (default), name, branch, section, batch, workshopName.
  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      const av = (a[sortKey] ?? '').toString().toLowerCase()
      const bv = (b[sortKey] ?? '').toString().toLowerCase()
      const cmp = av.localeCompare(bv, undefined, { numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, search, branch, section, batchFilter, workshopFilter, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }
  const arrow = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  const rows = sorted.map((s) => ({
    Name: s.name, USN: s.usn, Email: s.email, Phone: s.phone,
    Branch: s.branch, Section: s.section, Batch: s.batch || '',
    Workshop: s.workshopName || '',
    TestsAttempted: attemptCount[s.id] || 0,
  }))

  // ---- batch actions ----
  const handleAddBatch = async (e) => {
    e.preventDefault()
    if (!newBatch.trim()) return
    try {
      await createBatch(newBatch)
      setNewBatch('')
      setMsg({ type: 'success', text: 'Batch created.' })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }
  const confirmDeleteBatch = async () => {
    await deleteBatch(deleteBatchId)
    setDeleteBatchId(null)
    setMsg({ type: 'success', text: 'Batch deleted.' })
    load()
  }

  // ---- student edit ----
  const openEdit = (s) => {
    setEditTarget(s)
    setEditForm({
      name: s.name || '', usn: s.usn || '', email: s.email || '', phone: s.phone || '',
      branch: s.branch || 'CSE', section: s.section || 'A', batch: s.batch || '',
      workshopId: s.workshopId || '', workshopName: s.workshopName || '',
    })
  }
  const saveEdit = async (e) => {
    e.preventDefault()
    setSavingEdit(true)
    const assignedW = workshops.find((w) => w.id === editForm.workshopId)
    try {
      await updateStudent(editTarget.id, {
        name: editForm.name.trim(),
        usn: editForm.usn.trim().toUpperCase(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
        branch: editForm.branch,
        section: editForm.section,
        batch: editForm.batch,
        workshopId: editForm.workshopId || null,
        workshopName: assignedW ? assignedW.name : editForm.workshopName || '',
      })
      setMsg({ type: 'success', text: 'Student details updated.' })
      setEditTarget(null)
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSavingEdit(false)
    }
  }

  // ---- bulk import students ----
  const downloadTemplate = () => {
    exportToExcel(
      [{
        Name: 'Jane Doe',
        USN: '1XX21CS001',
        Email: 'jane@example.com',
        Phone: '9876543210',
        Branch: 'CSE',
        Section: 'A',
        Batch: batches[0]?.name || '2024-2027',
        Workshop: workshops[0]?.name || 'General',
      }],
      'students-import-template.xlsx',
      'Students',
    )
  }

  const runImport = async () => {
    if (!importFile) { setMsg({ type: 'error', text: 'Choose a CSV or Excel file first.' }); return }
    setImporting(true)
    setImportResult(null)
    const targetW = workshops.find((w) => w.id === importWorkshopId)
    try {
      const rows = await readSpreadsheet(importFile)
      if (rows.length === 0) throw new Error('The file has no data rows.')
      setImportProgress({ done: 0, total: rows.length })
      const result = await bulkImportStudents(rows, {
        defaultBatch: importBatch,
        defaultWorkshopId: targetW?.id || null,
        defaultWorkshopName: targetW?.name || '',
        onProgress: (done, total) => setImportProgress({ done, total }),
      })
      setImportResult(result)
      setMsg({ type: result.failed ? 'info' : 'success', text: `Import complete: ${result.created} created, ${result.failed} failed.` })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setImporting(false)
    }
  }

  const closeImport = () => {
    if (importing) return
    setImportOpen(false)
    setImportFile(null)
    setImportBatch('')
    setImportProgress({ done: 0, total: 0 })
    setImportResult(null)
  }

  // ---- reset password (sends a Firebase reset email to the student) ----
  const handleResetPassword = async (s) => {
    setMsg({ type: 'info', text: `Sending reset email to ${s.email}…` })
    try {
      await sendStudentPasswordReset(s.email)
      setMsg({ type: 'success', text: `Password reset email sent to ${s.email}.` })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  // ---- student delete ----
  const confirmDeleteStudent = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    setMsg({ type: 'info', text: `Deleting ${target.name}…` })
    try {
      await deleteStudent(target)
      setMsg({ type: 'success', text: `${target.name} and their results were deleted.` })
      load()
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    }
  }

  if (loading) return <Loader />

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-800">Manage Students ({filtered.length})</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setImportOpen(true)}>Bulk Import</button>
          <button className="btn-secondary" onClick={() => exportToCSV(rows, 'students.csv')}>Export CSV</button>
          <button className="btn-primary" onClick={() => exportToExcel(rows, 'students.xlsx', 'Students')}>Export Excel</button>
        </div>
      </div>

      {msg.text && <div className="mb-4"><Alert type={msg.type} onClose={() => setMsg({ type: '', text: '' })} autoCloseMs={msg.type === 'error' ? undefined : 5000}>{msg.text}</Alert></div>}

      {/* ---- Student access settings ---- */}
      {settings && (
        <div className="card mb-4">
          <h2 className="font-semibold text-slate-800">Student Access</h2>
          <p className="text-xs text-slate-500">Control what students can do from the login &amp; registration pages.</p>
          <div className="mt-3 space-y-2">
            <SettingToggle
              label="Student self-registration"
              hint="When off, the public Register page is closed — only bulk import / admin can add students."
              on={settings.registrationOpen}
              onToggle={() => toggleSetting('registrationOpen')}
            />
            <SettingToggle
              label="Forgot password (student login)"
              hint="When off, the “Forgot password?” option is hidden on the student login page."
              on={settings.forgotPasswordEnabled}
              onToggle={() => toggleSetting('forgotPasswordEnabled')}
            />
          </div>
        </div>
      )}

      {/* ---- Batch management ---- */}
      <div className="card mb-4">
        <h2 className="font-semibold text-slate-800">Batches</h2>
        <p className="text-xs text-slate-500">Create batches (e.g. 2024-2027). Students choose one at registration.</p>
        <form onSubmit={handleAddBatch} className="mt-3 flex gap-2">
          <input className="input max-w-xs" placeholder="New batch name e.g. 2024-2027" value={newBatch} onChange={(e) => setNewBatch(e.target.value)} />
          <button className="btn-primary">Add Batch</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-2">
          {batches.length === 0 && <span className="text-sm text-slate-400">No batches yet.</span>}
          {batches.map((b) => (
            <span key={b.id} className="badge flex items-center gap-2 bg-brand/10 text-brand">
              {b.name}
              <button className="text-brand-dark hover:text-red-600" onClick={() => setDeleteBatchId(b.id)} title="Delete batch">✕</button>
            </span>
          ))}
        </div>
      </div>

      {/* ---- Filters ---- */}
      <div className="card mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div>
          <label className="label">Search</label>
          <input className="input" placeholder="Name / USN / email" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label className="label">Workshop</label>
          <select className="input" value={workshopFilter} onChange={(e) => setWorkshopFilter(e.target.value)}>
            <option value="All">All Workshops</option>
            {workshops.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
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
          <select className="input" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            {batchOptions.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* ---- Student table ---- */}
      <p className="mb-2 text-xs text-slate-400 sm:hidden">Swipe the table sideways to see more columns →</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="cursor-pointer py-2 hover:text-slate-800" onClick={() => toggleSort('name')}>Name{arrow('name')}</th>
              <th className="cursor-pointer hover:text-slate-800" onClick={() => toggleSort('usn')}>USN{arrow('usn')}</th>
              <th>Email</th>
              <th>Workshop</th>
              <th className="cursor-pointer hover:text-slate-800" onClick={() => toggleSort('branch')}>Branch{arrow('branch')}</th>
              <th className="cursor-pointer hover:text-slate-800" onClick={() => toggleSort('section')}>Section{arrow('section')}</th>
              <th className="cursor-pointer hover:text-slate-800" onClick={() => toggleSort('batch')}>Batch{arrow('batch')}</th>
              <th>Attempts</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-2 font-medium">{s.name}</td>
                <td>{s.usn}</td>
                <td className="text-slate-500">{s.email}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-700">
                    {s.workshopName || (workshops.find((w) => w.id === s.workshopId)?.name) || 'General'}
                  </span>
                </td>
                <td>{s.branch}</td>
                <td>{s.section}</td>
                <td>{s.batch || '—'}</td>
                <td><span className="badge bg-brand/10 text-brand">{attemptCount[s.id] || 0}</span></td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn-secondary" onClick={() => openEdit(s)}>Edit</button>
                    <button className="btn-secondary" onClick={() => handleResetPassword(s)}>Reset Password</button>
                    <button className="btn-danger" onClick={() => setDeleteTarget(s)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400">No students match these filters. Try clearing the search or filters above.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Student?"
        message={deleteTarget ? (
          <>
            This permanently removes <b>{deleteTarget.name}</b> ({deleteTarget.usn}) and all their test
            attempts &amp; results.
            <span className="mt-2 block font-semibold text-amber-700">
              Note: their login is not removed automatically — delete it from Firebase Console → Authentication
              if you want to fully block sign-in.
            </span>
          </>
        ) : ''}
        confirmText="Delete Student"
        danger
        onConfirm={confirmDeleteStudent}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={!!deleteBatchId}
        title="Delete Batch?"
        message="This removes the batch from the list. Students already assigned to it keep their batch value."
        confirmText="Delete"
        danger
        onConfirm={confirmDeleteBatch}
        onCancel={() => setDeleteBatchId(null)}
      />

      {/* ---- Bulk import modal ---- */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Bulk Import Students</h3>
            <p className="mt-1 text-xs text-slate-500">
              Upload a CSV/Excel with columns: Name, USN, Email, Phone, Branch, Section, Batch.
              Each row creates a login account whose <span className="font-semibold">initial password is the student's USN</span> —
              they're prompted to change it on first login. A missing Batch falls back to the default below.
            </p>

            <div className="mt-4 grid gap-3">
              <div>
                <button className="text-sm font-semibold text-brand hover:underline" onClick={downloadTemplate}>
                  ↓ Download template
                </button>
              </div>
              <div>
                <label className="label">File (.csv or .xlsx)</label>
                <input
                  className="input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  disabled={importing}
                  onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null) }}
                />
              </div>
              <div>
                <label className="label">Default Batch</label>
                {batches.length > 0 ? (
                  <select className="input" value={importBatch} disabled={importing} onChange={(e) => setImportBatch(e.target.value)}>
                    <option value="">— from file —</option>
                    {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                ) : (
                  <input className="input" value={importBatch} disabled={importing} onChange={(e) => setImportBatch(e.target.value)} placeholder="e.g. 2024-2027" />
                )}
              </div>
              <div>
                <label className="label">Default Workshop</label>
                <select
                  className="input"
                  value={importWorkshopId}
                  disabled={importing}
                  onChange={(e) => setImportWorkshopId(e.target.value)}
                >
                  <option value="">— from file / default —</option>
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-slate-400">
                Each student logs in with their email and their USN as the temporary password, then must set
                a new password before using the app. USNs shorter than 6 characters will be skipped (Firebase
                requires a 6+ character password).
              </p>

              {importing && (
                <div>
                  <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                    <div className="h-full bg-brand transition-all" style={{ width: `${importProgress.total ? (importProgress.done / importProgress.total) * 100 : 0}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">Importing {importProgress.done}/{importProgress.total}…</p>
                </div>
              )}

              {importResult && (
                <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="font-semibold text-slate-800">
                    {importResult.created} created · {importResult.failed} failed (of {importResult.total})
                  </p>
                  {importResult.errors.length > 0 && (
                    <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-red-600">
                      {importResult.errors.map((er, i) => <li key={i}>{er}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={closeImport} disabled={importing}>
                {importResult ? 'Close' : 'Cancel'}
              </button>
              <button type="button" className="btn-primary" onClick={runImport} disabled={importing || !importFile}>
                {importing ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit student modal ---- */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveEdit} className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800">Edit Student</h3>
            <p className="mt-1 text-xs text-slate-500">{editTarget.usn} · {editTarget.email}</p>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
              </div>
              <div>
                <label className="label">USN</label>
                <input className="input uppercase" value={editForm.usn} onChange={(e) => setEditForm({ ...editForm, usn: e.target.value })} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                <p className="mt-1 text-xs text-amber-600">Updates records only — the student still logs in with their original email.</p>
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Branch</label>
                  <select className="input" value={editForm.branch} onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}>
                    {BRANCHES.map((b) => <option key={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Section</label>
                  <select className="input" value={editForm.section} onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}>
                    {SECTIONS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Batch</label>
                {batches.length > 0 ? (
                  <select className="input" value={editForm.batch} onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })}>
                    <option value="">— none —</option>
                    {batches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                  </select>
                ) : (
                  <input className="input" value={editForm.batch} onChange={(e) => setEditForm({ ...editForm, batch: e.target.value })} />
                )}
              </div>
              <div>
                <label className="label">Workshop</label>
                <select
                  className="input"
                  value={editForm.workshopId}
                  onChange={(e) => setEditForm({ ...editForm, workshopId: e.target.value })}
                >
                  <option value="">— none / general —</option>
                  {workshops.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn-primary" disabled={savingEdit}>{savingEdit ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

// A labelled on/off switch row used by the Student Access settings.
function SettingToggle({ label, hint, on, onToggle }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 p-3">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-brand' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
