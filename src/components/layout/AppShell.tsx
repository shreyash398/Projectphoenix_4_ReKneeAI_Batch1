import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PageHeader } from './PageHeader';
import { BottomNavigation } from './BottomNavigation';
import { useAuth } from '../../contexts/AuthContext';
import { repository } from '../../lib/supabase/repository';

export const AppShell: React.FC = () => {
  const { role } = useAuth();
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);

  useEffect(() => {
    const loadAlerts = async () => {
      const alerts = await repository.getAlerts();
      const unreviewed = alerts.filter((a) => a.status === 'new');
      setActiveAlertCount(unreviewed.length);
    };
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-warm-bg text-navy-900 flex flex-col font-sans">
      <PageHeader />

      {/* Main Content Area with Bottom Padding for Fixed Nav */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 pb-24 sm:p-6 sm:pb-24">
        <Outlet />
      </main>

      <BottomNavigation role={role} alertCount={activeAlertCount} />
    </div>
  );
};
