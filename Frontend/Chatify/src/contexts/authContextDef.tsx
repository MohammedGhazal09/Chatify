import { createContext } from 'react'
import type { AuthContextType } from '../types/auth'

export const AuthContextDef = createContext<AuthContextType | undefined>(undefined)
