// Test definition Firestore logic (admin creates/manages tests).
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
} from 'firebase/firestore'
import { db } from '../firebase/config'

const COL = 'tests'

export async function createTest(data) {
  return addDoc(collection(db, COL), {
    workshopId: data.workshopId || null,
    workshopName: data.workshopName || null,
    totalQuestions: 30,
    isActive: true,
    resultsReleased: false, // students can't see scores/answers until admin releases
    ...data,
    createdAt: serverTimestamp(),
  })
}

export async function updateTest(id, data) {
  return updateDoc(doc(db, COL, id), data)
}

// Toggle whether students may view their results/answers for a test.
export async function setResultsReleased(id, released) {
  return updateDoc(doc(db, COL, id), { resultsReleased: !!released })
}

export async function deleteTest(id) {
  return deleteDoc(doc(db, COL, id))
}

export async function getTest(id) {
  const snap = await getDoc(doc(db, COL, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getAllTests(workshopId = null) {
  let q
  if (workshopId && workshopId !== 'All') {
    q = query(collection(db, COL), where('workshopId', '==', workshopId))
  } else {
    q = collection(db, COL)
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Active tests only — what a student sees on their dashboard.
export async function getActiveTests(workshopId = null) {
  let q
  if (workshopId && workshopId !== 'All') {
    q = query(collection(db, COL), where('isActive', '==', true), where('workshopId', '==', workshopId))
  } else {
    q = query(collection(db, COL), where('isActive', '==', true))
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Generate standard Pre-Assessment, Day-wise Tests (1..N), and Grand Test for any workshop.
export async function createDefaultTestsForWorkshop(workshop) {
  const daysCount = Number(workshop.durationDays) || 6
  const testsToCreate = [
    {
      testTitle: `${workshop.name} — Pre-Assessment`,
      testType: 'Pre-Assessment',
      duration: 30,
      totalQuestions: 30,
      dayNumber: null,
      isActive: true,
      workshopId: workshop.id,
      workshopName: workshop.name,
    },
  ]

  for (let d = 1; d <= daysCount; d++) {
    testsToCreate.push({
      testTitle: `Day ${d} — ${workshop.name} Test`,
      testType: 'Day-wise Test',
      duration: 20,
      totalQuestions: 30,
      dayNumber: d,
      isActive: true,
      workshopId: workshop.id,
      workshopName: workshop.name,
    })
  }

  testsToCreate.push({
    testTitle: `${workshop.name} — Grand Test`,
    testType: 'Grand Test',
    duration: 45,
    totalQuestions: 30,
    dayNumber: null,
    isActive: true,
    workshopId: workshop.id,
    workshopName: workshop.name,
  })

  for (const t of testsToCreate) {
    await createTest(t)
  }
  return testsToCreate.length
}
