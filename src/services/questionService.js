// Question bank Firestore logic (admin CRUD + querying for tests).
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const COL = 'questions'

export async function addQuestion(data) {
  return addDoc(collection(db, COL), {
    workshopId: data.workshopId || null,
    workshopName: data.workshopName || null,
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateQuestion(id, data) {
  return updateDoc(doc(db, COL, id), data)
}

export async function deleteQuestion(id) {
  return deleteDoc(doc(db, COL, id))
}

export async function getAllQuestions(workshopId = null) {
  let q
  if (workshopId && workshopId !== 'All') {
    q = query(collection(db, COL), where('workshopId', '==', workshopId))
  } else {
    q = collection(db, COL)
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Fetch questions matching a test type, day number, and workshop.
export async function getQuestionsForTest(testType, dayNumber = null, workshopId = null) {
  let q
  if (testType === 'Day-wise Test' && dayNumber != null) {
    q = query(
      collection(db, COL),
      where('testType', '==', testType),
      where('dayNumber', '==', Number(dayNumber)),
    )
  } else {
    q = query(collection(db, COL), where('testType', '==', testType))
  }
  const snap = await getDocs(q)
  let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))

  if (workshopId && workshopId !== 'All') {
    // Return questions explicitly matching the workshop.
    const filtered = list.filter((qn) => qn.workshopId === workshopId)
    if (filtered.length > 0) return filtered
    // Only fall back to untagged legacy questions if the workshop is 'excel-analytics'
    if (workshopId === 'excel-analytics') {
      return list.filter((qn) => !qn.workshopId)
    }
    return []
  }
  return list
}

// Normalized identity for a question, used to detect duplicates and to make seeding idempotent.
export function questionKey(q) {
  return `${q.workshopId || ''}||${q.testType}||${q.dayNumber ?? ''}||${(q.questionText || '').trim().toLowerCase()}`
}

// Remove duplicate questions, keeping the first of each identical set.
// Optionally filter by workshopId.
export async function removeDuplicateQuestions(workshopId = null) {
  const all = await getAllQuestions(workshopId)
  const seen = new Set()
  const dupes = []
  for (const q of all) {
    const key = questionKey(q)
    if (seen.has(key)) dupes.push(q.id)
    else seen.add(key)
  }
  // Delete in batches of 400 (Firestore batch limit is 500).
  for (let i = 0; i < dupes.length; i += 400) {
    const batch = writeBatch(db)
    dupes.slice(i, i + 400).forEach((id) => batch.delete(doc(db, COL, id)))
    await batch.commit()
  }
  return dupes.length
}

// Bulk insert (used by seeder and spreadsheet importer).
export async function bulkAddQuestions(questions, defaultWorkshop = {}) {
  const batchLimit = 400
  let totalAdded = 0

  for (let i = 0; i < questions.length; i += batchLimit) {
    const chunk = questions.slice(i, i + batchLimit)
    const batch = writeBatch(db)

    chunk.forEach((qn) => {
      const ref = doc(collection(db, COL))
      batch.set(ref, {
        workshopId: qn.workshopId || defaultWorkshop.id || null,
        workshopName: qn.workshopName || defaultWorkshop.name || null,
        ...qn,
        createdAt: serverTimestamp(),
      })
    })

    await batch.commit()
    totalAdded += chunk.length
  }
  return totalAdded
}
