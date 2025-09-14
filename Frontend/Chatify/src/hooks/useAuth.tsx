import { useContext } from 'react'
import { AuthContextDef } from '../contexts/authContextDef'
import type { AuthContextType } from '../types/auth'

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContextDef)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
