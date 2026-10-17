import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { PageHeader } from './PageHeader';
import { BottomNavigation } from './BottomNavigation';
import { repository } from '../../lib/supabase/repository';
import { Profile } from '../../types/database';

export const AppShell: React.FC = () => {
  const [profile, setProfile] = useState<Profile>(repository.getCurrentProfile());
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check pending alerts
    const loadAlerts = async () => {
      const alerts = await repository.getAlerts();
      const unreviewed = alerts.filter((a) => a.status === 'new');
      setActiveAlertCount(unreviewed.length);
    };
    loadAlerts();
    const interval = setInterval(loadAlerts, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRoleSwitch = (newProfile: Profile) => {
    setProfile(newProfile);
    if (newProfile.role === 'clinician') {
      if (!location.pathname.startsWith('/clinician')) {
        navigate('/clinician');
      }
    } else {
      if (location.pathname.startsWith('/clinician')) {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen bg-warm-bg text-navy-900 flex flex-col font-sans">
      <PageHeader currentProfile={profile} onRoleSwitch={handleRoleSwitch} />

      {/* Main Content Area with Bottom Padding for Fixed Nav */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 pb-24 sm:p-6 sm:pb-24">
        <Outlet context={{ currentProfile: profile }} />
      </main>

      <BottomNavigation role={profile.role} alertCount={activeAlertCount} />
    </div>
  );
};
