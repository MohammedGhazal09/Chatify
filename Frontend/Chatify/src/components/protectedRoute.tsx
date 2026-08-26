import type { FC, ReactNode } from "react";
import { useAuthStore } from "../store/authstore";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireUsername?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute: FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/login',
  requireUsername = true,
  requireAdmin = false,
}) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{from: location}} replace/>;
  }

  if (requireUsername && !user?.username) {
    return <Navigate to="/setup-username" state={{from: location}} replace/>;
  }

  if (requireAdmin && user?.role !== 'admin') {
    return <Navigate to="/" replace/>;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
