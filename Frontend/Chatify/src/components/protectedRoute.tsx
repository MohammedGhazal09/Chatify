import type { FC, ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import LoadingSpinner from "./loadingSpinner";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: FC<ProtectedRouteProps> = ({children, redirectTo = '/login'}) => {
  const { isAuthenticated, isLoading } = useAuth(); 
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner/>
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{from: location}} replace/>
  }

  return <>{children}</>
}

export default ProtectedRoute;