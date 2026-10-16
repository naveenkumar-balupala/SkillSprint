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

const DEFAULT_WORKSHOP = {
  id: 'excel-analytics',
  name: 'Excel for Data Analytics',
  code: 'EXCEL',
  description: 'Master data analysis, cleaning, advanced formulas, and dashboards in Excel.',
  durationDays: 6,
  isActive: true,
}

export async function getWorkshop(id) {
  if (!id) return null
  if (id === 'excel-analytics') return DEFAULT_WORKSHOP
  try {
    const snap = await getDoc(doc(db, COL, id))
    return snap.exists() ? { id: snap.id, ...snap.data() } : null
  } catch (err) {
    console.warn('Could not fetch workshop doc:', err)
    return null
  }
}

export async function getAllWorkshops() {
  try {
    const snap = await getDocs(collection(db, COL))
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return list.length > 0 ? list : [DEFAULT_WORKSHOP]
  } catch (err) {
    console.warn('Could not fetch workshops (check Firestore rules):', err)
    return [DEFAULT_WORKSHOP]
  }
}

export async function getActiveWorkshops() {
  try {
    const q = query(collection(db, COL), where('isActive', '==', true))
    const snap = await getDocs(q)
    const list = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return list.length > 0 ? list : [DEFAULT_WORKSHOP]
  } catch (err) {
    console.warn('Could not fetch active workshops (check Firestore rules):', err)
    return [DEFAULT_WORKSHOP]
  }
}

export const getWorkshops = getAllWorkshops

// Ensures default workshops exist so existing tests/questions map seamlessly.
export async function ensureDefaultWorkshops() {
  const all = await getAllWorkshops()
  // If we already have stored workshops with a non-fallback id, return them
  if (all.length > 0 && all[0].id !== 'excel-analytics') return all

  try {
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
  } catch (err) {
    console.warn('Could not seed default workshop to Firestore (requires admin permission):', err)
    return [DEFAULT_WORKSHOP]
  }
}
