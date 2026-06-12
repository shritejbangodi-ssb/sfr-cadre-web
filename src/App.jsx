import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Faculty from './pages/Faculty';
import SFR from './pages/SFR';
import CADR from './pages/CADR';
import DepartmentAnalysis from './pages/DepartmentAnalysis';
import Reports from './pages/Reports';
import FacultyDetails from './pages/FacultyDetails';
import FacultyQualification from './pages/FacultyQualification';
import FacultyRetention from './pages/FacultyRetention';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userRole, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!currentUser) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      
      <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><Dashboard /></ProtectedRoute>} />
      <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><Students /></ProtectedRoute>} />
      <Route path="/faculty" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><Faculty /></ProtectedRoute>} />
      <Route path="/faculty-qualification" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><FacultyQualification /></ProtectedRoute>} />
      <Route path="/faculty-retention" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><FacultyRetention /></ProtectedRoute>} />
      <Route path="/sfr" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><SFR /></ProtectedRoute>} />
      <Route path="/cadr" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><CADR /></ProtectedRoute>} />
      <Route path="/department-analysis" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><DepartmentAnalysis /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><Reports /></ProtectedRoute>} />
      <Route path="/faculty-details" element={<ProtectedRoute allowedRoles={['admin', 'faculty']}><FacultyDetails /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
