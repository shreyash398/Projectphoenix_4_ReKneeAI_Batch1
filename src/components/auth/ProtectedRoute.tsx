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
  const { isAuthenticated, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto p-4 space-y-4">
        <LoadingSkeleton lines={4} />
      </div>
    );
  }

  // 1. Unauthenticated check -> Redirect to /login
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location, message: 'Please sign in to access this page.' }}
        replace
      />
    );
  }

  // 2. Role-based authorization guard -> Redirect to /forbidden if unauthorized
  if (allowedRole && role !== allowedRole) {
    return <Navigate to="/forbidden" state={{ requiredRole: allowedRole, userRole: role }} replace />;
  }

  return <>{children}</>;
};
