// Workshop management Firestore logic.
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

const COL = 'workshops'

export async function createWorkshop(data) {
  return addDoc(collection(db, COL), {
    name: data.name.trim(),
    code: (data.code || data.name.slice(0, 8)).trim().toUpperCase(),
    description: (data.description || '').trim(),
    durationDays: Number(data.durationDays) || 6,
    isActive: data.isActive ?? true,
    createdAt: serverTimestamp(),
  })
}

export async function updateWorkshop(id, data) {
  const payload = { ...data }
  if (payload.name) payload.name = payload.name.trim()
  if (payload.code) payload.code = payload.code.trim().toUpperCase()
  if (payload.description !== undefined) payload.description = payload.description.trim()
  if (payload.durationDays !== undefined) payload.durationDays = Number(payload.durationDays) || 6
  if (payload.isActive !== undefined) payload.isActive = !!payload.isActive

  return updateDoc(doc(db, COL, id), {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteWorkshop(id) {
  return deleteDoc(doc(db, COL, id))
}

export async function getWorkshop(id) {
  if (!id) return null
  const snap = await getDoc(doc(db, COL, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function getAllWorkshops() {
  const snap = await getDocs(collection(db, COL))
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export async function getActiveWorkshops() {
  const q = query(collection(db, COL), where('isActive', '==', true))
  const snap = await getDocs(q)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
}

export const getWorkshops = getAllWorkshops

// Ensures default workshops exist so existing tests/questions map seamlessly.
export async function ensureDefaultWorkshops() {
  const all = await getAllWorkshops()
  if (all.length > 0) return all

  // Seed default "Excel for Data Analytics" workshop
  const ref = await addDoc(collection(db, COL), {
    name: 'Excel for Data Analytics',
    code: 'EXCEL',
    description: 'Master data analysis, cleaning, advanced formulas, and dashboards in Excel.',
    durationDays: 6,
    isActive: true,
    createdAt: serverTimestamp(),
  })

  return [{
    id: ref.id,
    name: 'Excel for Data Analytics',
    code: 'EXCEL',
    description: 'Master data analysis, cleaning, advanced formulas, and dashboards in Excel.',
    durationDays: 6,
    isActive: true,
  }]
}
