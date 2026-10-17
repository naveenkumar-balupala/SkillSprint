// Workshop management Firestore logic.
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
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
  const payload = {}
  if (data.name !== undefined) payload.name = data.name.trim()
  if (data.code !== undefined) payload.code = data.code.trim().toUpperCase()
  if (data.description !== undefined) payload.description = data.description.trim()
  if (data.durationDays !== undefined) payload.durationDays = Number(data.durationDays) || 6
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive)

  return setDoc(
    doc(db, COL, id),
    {
      ...payload,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
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
  try {
    const snap = await getDoc(doc(db, COL, id))
    if (snap.exists()) return { id: snap.id, ...snap.data() }
    if (id === 'excel-analytics') return DEFAULT_WORKSHOP
    return null
  } catch (err) {
    console.warn('Could not fetch workshop doc:', err)
    return id === 'excel-analytics' ? DEFAULT_WORKSHOP : null
  }
}

export async function getAllWorkshops() {
  try {
    const snap = await getDocs(collection(db, COL))
    if (!snap.empty) {
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    return [DEFAULT_WORKSHOP]
  } catch (err) {
    console.warn('Could not fetch workshops (check Firestore rules):', err)
    return [DEFAULT_WORKSHOP]
  }
}

export async function getActiveWorkshops() {
  try {
    const snap = await getDocs(collection(db, COL))
    if (!snap.empty) {
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((w) => w.isActive === true)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }
    return [DEFAULT_WORKSHOP]
  } catch (err) {
    console.warn('Could not fetch active workshops (check Firestore rules):', err)
    return [DEFAULT_WORKSHOP]
  }
}

export const getWorkshops = getAllWorkshops

// Ensures default workshops exist so existing tests/questions map seamlessly.
export async function ensureDefaultWorkshops() {
  try {
    const snap = await getDocs(collection(db, COL))
    if (!snap.empty) {
      return snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    }

    // Seed default "Excel for Data Analytics" workshop with deterministic ID
    await setDoc(doc(db, COL, 'excel-analytics'), {
      ...DEFAULT_WORKSHOP,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    return [DEFAULT_WORKSHOP]
  } catch (err) {
    console.warn('Could not seed default workshop to Firestore (requires admin permission):', err)
    return [DEFAULT_WORKSHOP]
  }
}
