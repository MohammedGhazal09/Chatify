import { useContext } from "react";
import { AuthContextDef } from "../contexts/authContextDef";
import type { AuthContextType } from "../types/auth";

export const useAuth = () => {
  return useContext(AuthContextDef) as AuthContextType;
};