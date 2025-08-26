import { useEffect, useState } from 'react'
import axiosInstance from '../api';
import type { ReactNode, FC  } from 'react'
import type { User, SignupData, LoginData, AuthContextType } from '../types/auth';
import { AuthContext } from './authContextDef'

interface AuthProviderProps {
  children: ReactNode;
}

 const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const isAuthenticated = !!user

  useEffect(() => {
      checkAuthStatus()
  },[])

  const checkAuthStatus = async (): Promise<void> => {
    try {
      setIsLoading(true)
      await axiosInstance.get('/api/csrf-token')
      const response = await axiosInstance.get('/api/user/get-logged-user')
      setUser(response.data.user)
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : 'Unknown error')
      setUser(null)
    } finally {
      setIsLoading(false)
    }
    }

    const signup = async (userData: SignupData): Promise<void> => {
      try {
        setIsLoading(true)
        await axiosInstance.get('/api/csrf-token')
        await axiosInstance.post('/api/auth/signup', userData)
        await refreshUser()
      } catch (err: unknown) {
        console.error(err instanceof Error ? err.message : "Unknown error")
        setUser(null)
        throw err
      } finally {
        setIsLoading(false)
      }
    }

    const login = async (userData:LoginData): Promise<void> => {
      try {
        setIsLoading(true)
        await axiosInstance.get('/api/csrf-token')
        await axiosInstance.post('/api/auth/login', userData)
        await refreshUser()
      } catch (err: unknown) {
        console.error(err instanceof Error ? err.message : "Unknown error")
        setUser(null)
        throw err
      } finally {
        setIsLoading(false)
      }
      }

      const logout = async (): Promise<void> => {
        try {
          setIsLoading(true)
          await axiosInstance.post('/api/auth/logout')
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : "Unknown error")
          throw err
        } finally {
          setUser(null)
          setIsLoading(false)
        }
      }

      const refreshUser = async (): Promise<void> => {
        try {
          const response = await axiosInstance.get('/api/user/get-logged-user')
          setUser(response.data.user)
        } catch (err: unknown) {
          setUser(null)
          console.error(err instanceof Error ? err.message : "Unknown error")
          throw err
        }
      }

      const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated,
        login,
        signup,
        logout,
        refreshUser
      }
      
      return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    }
  
export default AuthProvider