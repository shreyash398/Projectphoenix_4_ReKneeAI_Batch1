import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types/database';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: UserRole;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRole,
}) => {
  const { session, profile, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  // If live Supabase session exists or profile exists in demo mode
  const isAuthenticated = Boolean(session || profile);

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/forbidden" replace />;
  }

  return <>{children}</>;
};
