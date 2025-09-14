import type { FC, ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: FC<ProtectedRouteProps> = ({children, redirectTo = '/login'}) => {
  const { isAuthenticated } = useAuth(); 
  
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} state={{from: location}} replace/>
  }

  return <>{children}</>
}

export default ProtectedRoute;