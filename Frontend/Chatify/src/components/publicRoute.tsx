import type { FC, ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import  { Navigate } from "react-router-dom";

interface PublicRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

const PublicRoute : FC<PublicRouteProps> = ({children, redirectTo = '/'}) => {
  const {isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace/>
  }
  return <>{children}</>
}

export default PublicRoute;