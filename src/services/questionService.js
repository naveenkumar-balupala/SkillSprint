// Question bank Firestore logic (admin CRUD + querying for tests).
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  isExcelQuestion,
  detectSubjectFromWorkshop,
  getQuestionsForSubject,
} from '../utils/seedData'

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

// Bulk delete all questions belonging to a specific workshop (cascade delete).
export async function deleteQuestionsByWorkshop(workshopId) {
  if (!workshopId) return 0
  const q = query(collection(db, COL), where('workshopId', '==', workshopId))
  const snap = await getDocs(q)
  if (snap.empty) return 0
  const docs = snap.docs
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db)
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return docs.length
}

// Remove all questions whose workshopId belongs to a workshop that no longer exists in Firestore.
export async function cleanupOrphanedQuestions(validIds = null) {
  let validSet
  if (validIds && Array.isArray(validIds)) {
    validSet = new Set(validIds)
  } else if (validIds instanceof Set) {
    validSet = validIds
  } else {
    const wSnap = await getDocs(collection(db, 'workshops'))
    validSet = new Set(wSnap.docs.map((d) => d.id))
    validSet.add('excel-analytics')
  }

  const qSnap = await getDocs(collection(db, COL))
  const orphanedDocs = qSnap.docs.filter((d) => {
    const qData = d.data()
    // If workshopId is set but does not exist in valid workshops
    if (qData.workshopId && !validSet.has(qData.workshopId)) {
      return true
    }
    return false
  })

  if (orphanedDocs.length === 0) return 0

  for (let i = 0; i < orphanedDocs.length; i += 400) {
    const batch = writeBatch(db)
    orphanedDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return orphanedDocs.length
}

// Remove Excel questions that were erroneously attached to non-Excel workshops
export async function cleanupMismatchedExcelQuestions(workshops = null) {
  let wList = workshops
  if (!wList) {
    const wSnap = await getDocs(collection(db, 'workshops'))
    wList = wSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  }

  const nonExcelWorkshopIds = new Set(
    wList
      .filter((w) => {
        const name = (w.name || '').toLowerCase()
        const id = (w.id || '').toLowerCase()
        return id !== 'excel-analytics' && !name.includes('excel') && !name.includes('spreadsheet')
      })
      .map((w) => w.id)
  )

  if (nonExcelWorkshopIds.size === 0) return 0

  const qSnap = await getDocs(collection(db, COL))
  const mismatchedDocs = qSnap.docs.filter((d) => {
    const qData = d.data()
    if (qData.workshopId && nonExcelWorkshopIds.has(qData.workshopId) && isExcelQuestion(qData)) {
      return true
    }
    return false
  })

  if (mismatchedDocs.length === 0) return 0

  for (let i = 0; i < mismatchedDocs.length; i += 400) {
    const batch = writeBatch(db)
    mismatchedDocs.slice(i, i + 400).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return mismatchedDocs.length
}

// Automatically populate the matching subject questions for a workshop
export async function autoPopulateQuestionsForWorkshop(workshop, forceReplace = false) {
  if (!workshop || !workshop.id) return 0

  // If forceReplace, delete existing questions for this workshop first
  if (forceReplace) {
    await deleteQuestionsByWorkshop(workshop.id)
  }

  const subjectKey = detectSubjectFromWorkshop(workshop)
  const questionsToAdd = getQuestionsForSubject(
    subjectKey,
    workshop,
    workshop.durationDays || 6
  )

  const existing = await getAllQuestions(workshop.id)
  const existingKeys = new Set(existing.map(questionKey))

  const missing = questionsToAdd.filter((q) => !existingKeys.has(questionKey(q)))
  if (missing.length === 0) return 0

  return await bulkAddQuestions(missing, workshop)
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
    const isExcelWorkshop = workshopId === 'excel-analytics'

    // Return questions explicitly matching the workshop.
    let filtered = list.filter((qn) => qn.workshopId === workshopId)

    // If it is NOT an Excel workshop, strictly exclude any Excel questions!
    if (!isExcelWorkshop) {
      filtered = filtered.filter((qn) => !isExcelQuestion(qn))
    }

    if (filtered.length > 0) return filtered

    // If this workshop has 0 questions in Firestore, auto-generate & populate on the fly!
    try {
      const wSnap = await getDoc(doc(db, 'workshops', workshopId))
      if (wSnap.exists()) {
        const wData = { id: wSnap.id, ...wSnap.data() }
        const isActuallyExcel =
          (wData.name || '').toLowerCase().includes('excel') || wData.id === 'excel-analytics'

        if (!isActuallyExcel) {
          await autoPopulateQuestionsForWorkshop(wData)
          // Re-fetch questions matching this test
          const snap2 = await getDocs(q)
          const list2 = snap2.docs.map((d) => ({ id: d.id, ...d.data() }))
          const refreshed = list2
            .filter((qn) => qn.workshopId === workshopId)
            .filter((qn) => !isExcelQuestion(qn))
          if (refreshed.length > 0) return refreshed
        }
      }
    } catch (err) {
      console.warn('Could not auto-populate questions on the fly:', err)
    }

    // Only fall back to untagged legacy questions if the workshop is 'excel-analytics'
    if (workshopId === 'excel-analytics') {
      return list.filter((qn) => !qn.workshopId)
    }
    return []
  }

  // If no workshopId specified (legacy overview), only return untagged or excel questions
  return list.filter((qn) => !qn.workshopId || qn.workshopId === 'excel-analytics')
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
