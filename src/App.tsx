import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

// Pages
import { PatientHome } from './pages/PatientHome';
import { ExerciseCoach } from './pages/ExerciseCoach';
import { DailyCheckin } from './pages/DailyCheckin';
import { KnowledgeAssistant } from './pages/KnowledgeAssistant';
import { ProgressHistory } from './pages/ProgressHistory';
import { ClinicianDashboard } from './pages/ClinicianDashboard';
import { ClinicianAlerts } from './pages/ClinicianAlerts';
import { LoginPage } from './pages/LoginPage';
import { ForbiddenPage } from './pages/ForbiddenPage';

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication Route */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/forbidden" element={<ForbiddenPage />} />

              {/* Main Application Shell (Protected) */}
              <Route element={<AppShell />}>
                {/* Patient Routes (Accessible by Patient Role) */}
                <Route
                  path="/"
                  element={
                    <ProtectedRoute allowedRole="patient">
                      <PatientHome />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/exercise"
                  element={
                    <ProtectedRoute allowedRole="patient">
                      <ExerciseCoach />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/check-in"
                  element={
                    <ProtectedRoute allowedRole="patient">
                      <DailyCheckin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/assistant"
                  element={
                    <ProtectedRoute allowedRole="patient">
                      <KnowledgeAssistant />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/progress"
                  element={
                    <ProtectedRoute allowedRole="patient">
                      <ProgressHistory />
                    </ProtectedRoute>
                  }
                />

                {/* Clinician Routes (Gated by Clinician Role) */}
                <Route
                  path="/clinician"
                  element={
                    <ProtectedRoute allowedRole="clinician">
                      <ClinicianDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clinician/patients"
                  element={
                    <ProtectedRoute allowedRole="clinician">
                      <ClinicianDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clinician/patients/:id"
                  element={
                    <ProtectedRoute allowedRole="clinician">
                      <ClinicianDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clinician/alerts"
                  element={
                    <ProtectedRoute allowedRole="clinician">
                      <ClinicianAlerts />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/clinician/alerts/:id"
                  element={
                    <ProtectedRoute allowedRole="clinician">
                      <ClinicianAlerts />
                    </ProtectedRoute>
                  }
                />

                {/* Catch-All Redirect */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
