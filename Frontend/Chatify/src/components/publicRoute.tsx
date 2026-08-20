import type { FC, ReactNode } from "react";
import  { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authstore";

interface PublicRouteProps {
  children: ReactNode;
  redirectTo?: string;
}

const PublicRoute : FC<PublicRouteProps> = ({children, redirectTo = '/'}) => {
  const {isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace/>
  }
  return <>{children}</>
}

export default PublicRoute;