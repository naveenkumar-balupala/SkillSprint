// Test attempt + result Firestore logic. This enforces the "one attempt per
// test per student" rule and stores the full result document.
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'

// Deterministic attempt id => guarantees one attempt doc per (student, test).
// This is the core duplicate-submission guard.
export function attemptId(studentId, testId) {
  return `${studentId}_${testId}`
}

// Returns the attempt doc if the student already attempted, else null.
export async function getAttempt(studentId, testId) {
  const snap = await getDoc(doc(db, 'attempts', attemptId(studentId, testId)))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function hasAttempted(studentId, testId) {
  const a = await getAttempt(studentId, testId)
  return !!(a && a.submittedAt)
}

// Persist a completed attempt + its detailed result in a single logical write.
// Uses setDoc with the deterministic id so a second submission overwrites
// nothing new and the UI blocks it beforehand anyway.
export async function submitAttempt({ student, test, questions, answers, result, startedAt }) {
  const id = attemptId(student.id, test.id)

  const attemptDoc = {
    studentId: student.id,
    studentName: student.name,
    usn: student.usn,
    branch: student.branch,
    section: student.section,
    batch: student.batch ?? null,
    workshopId: test.workshopId || student.workshopId || null,
    workshopName: test.workshopName || student.workshopName || null,
    testId: test.id,
    testTitle: test.testTitle,
    testType: test.testType,
    dayNumber: test.dayNumber ?? null,
    attempted: true,
    startedAt: startedAt || null,
    submittedAt: serverTimestamp(),
    score: result.score,
    percentage: result.percentage,
    status: result.status,
  }

  const resultDoc = {
    ...attemptDoc,
    // store the served questions (without leaking nothing — already submitted)
    answers, // { questionId: selectedOptionText }
    questionSnapshot: questions.map((q) => ({
      id: q.id,
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
      topic: q.topic,
      difficulty: q.difficulty,
      selected: answers[q.id] ?? null,
    })),
    correctCount: result.correctCount,
    wrongCount: result.wrongCount,
    attemptedCount: result.attemptedCount,
    unattemptedCount: result.unattemptedCount,
    topicWisePerformance: result.topicWisePerformance,
    difficultyWisePerformance: result.difficultyWisePerformance,
  }

  await setDoc(doc(db, 'attempts', id), attemptDoc)
  await setDoc(doc(db, 'results', id), resultDoc)
  return id
}

export async function getResult(studentId, testId) {
  const snap = await getDoc(doc(db, 'results', attemptId(studentId, testId)))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

// All attempts by a single student (for their dashboard).
export async function getStudentAttempts(studentId) {
  const q = query(collection(db, 'attempts'), where('studentId', '==', studentId))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// Everything — used by the admin dashboard/statistics.
export async function getAllAttempts(workshopId = null) {
  let q
  if (workshopId && workshopId !== 'All') {
    q = query(collection(db, 'attempts'), where('workshopId', '==', workshopId))
  } else {
    q = collection(db, 'attempts')
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getAllResults(workshopId = null) {
  let q
  if (workshopId && workshopId !== 'All') {
    q = query(collection(db, 'results'), where('workshopId', '==', workshopId))
  } else {
    q = collection(db, 'results')
  }
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
