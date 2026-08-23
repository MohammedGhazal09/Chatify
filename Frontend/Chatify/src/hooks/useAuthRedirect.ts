import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/authstore";
import { useEffect } from "react";
import { normalizeInternalAppPath } from '../security/browserSecurity';

export const useAuthRedirect = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isAuthenticated) {
      const from = normalizeInternalAppPath(location.state?.from?.pathname, '/');
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location.state]);

  return { isAuthenticated };
};
