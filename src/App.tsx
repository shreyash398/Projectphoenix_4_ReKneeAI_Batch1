import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { PatientHome } from './pages/PatientHome';
import { ExerciseCoach } from './pages/ExerciseCoach';
import { DailyCheckin } from './pages/DailyCheckin';
import { KnowledgeAssistant } from './pages/KnowledgeAssistant';
import { ProgressHistory } from './pages/ProgressHistory';
import { ClinicianDashboard } from './pages/ClinicianDashboard';
import { ClinicianAlerts } from './pages/ClinicianAlerts';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          {/* Patient Routes */}
          <Route path="/" element={<PatientHome />} />
          <Route path="/exercise" element={<ExerciseCoach />} />
          <Route path="/check-in" element={<DailyCheckin />} />
          <Route path="/assistant" element={<KnowledgeAssistant />} />
          <Route path="/progress" element={<ProgressHistory />} />

          {/* Clinician Routes */}
          <Route path="/clinician" element={<ClinicianDashboard />} />
          <Route path="/clinician/alerts" element={<ClinicianAlerts />} />
          <Route path="/clinician/patients/:id" element={<ClinicianDashboard />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
