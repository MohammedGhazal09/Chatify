import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authstore";
import { useEffect } from "react";


export const useAuthRedirect = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true})
    }
  }, [isAuthenticated, navigate, location]);

  return { isAuthenticated };
}