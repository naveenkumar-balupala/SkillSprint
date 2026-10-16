import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import ProtectedRoute from './components/ProtectedRoute'
import ForcePasswordChange from './components/ForcePasswordChange'

// Public / student pages
import Home from './pages/Home'
import Register from './pages/student/Register'
import Login from './pages/student/Login'
import Dashboard from './pages/student/Dashboard'
import TestInstructions from './pages/student/TestInstructions'
import TestPage from './pages/student/TestPage'
import ResultPage from './pages/student/ResultPage'
import Profile from './pages/student/Profile'

// Admin pages
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import ManageWorkshops from './pages/admin/ManageWorkshops'
import ManageStudents from './pages/admin/ManageStudents'
import ManageQuestions from './pages/admin/ManageQuestions'
import CreateTest from './pages/admin/CreateTest'
import ManageTests from './pages/admin/ManageTests'
import ViewResults from './pages/admin/ViewResults'
import Statistics from './pages/admin/Statistics'
import ExportReports from './pages/admin/ExportReports'

export default function App() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <ForcePasswordChange />
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Student (protected) */}
          <Route path="/dashboard" element={<ProtectedRoute requiredRole="student"><Dashboard /></ProtectedRoute>} />
          <Route path="/test/:testId/instructions" element={<ProtectedRoute requiredRole="student"><TestInstructions /></ProtectedRoute>} />
          <Route path="/test/:testId" element={<ProtectedRoute requiredRole="student"><TestPage /></ProtectedRoute>} />
          <Route path="/result/:testId" element={<ProtectedRoute requiredRole="student"><ResultPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute requiredRole="student"><Profile /></ProtectedRoute>} />

          {/* Admin (protected) */}
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/workshops" element={<ProtectedRoute requiredRole="admin"><ManageWorkshops /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute requiredRole="admin"><ManageStudents /></ProtectedRoute>} />
          <Route path="/admin/questions" element={<ProtectedRoute requiredRole="admin"><ManageQuestions /></ProtectedRoute>} />
          <Route path="/admin/create-test" element={<ProtectedRoute requiredRole="admin"><CreateTest /></ProtectedRoute>} />
          <Route path="/admin/tests" element={<ProtectedRoute requiredRole="admin"><ManageTests /></ProtectedRoute>} />
          <Route path="/admin/results" element={<ProtectedRoute requiredRole="admin"><ViewResults /></ProtectedRoute>} />
          <Route path="/admin/statistics" element={<ProtectedRoute requiredRole="admin"><Statistics /></ProtectedRoute>} />
          <Route path="/admin/export" element={<ProtectedRoute requiredRole="admin"><ExportReports /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
