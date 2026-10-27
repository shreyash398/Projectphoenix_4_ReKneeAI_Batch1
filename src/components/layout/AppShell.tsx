import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PageHeader } from './PageHeader';
import { BottomNavigation } from './BottomNavigation';
import { Sidebar } from './Sidebar';
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
    <div className="min-h-screen bg-warm-bg text-navy-900 flex font-sans antialiased">
      {/* Permanent Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar role={role} alertCount={activeAlertCount} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 min-h-screen">
        {/* Mobile Page Header */}
        <div className="lg:hidden">
          <PageHeader />
        </div>

        {/* Content Container with generous margins and responsive padding */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8 pb-24 lg:pb-12">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation */}
        <div className="lg:hidden">
          <BottomNavigation role={role} alertCount={activeAlertCount} />
        </div>
      </div>
    </div>
  );
};
