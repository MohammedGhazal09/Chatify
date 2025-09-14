import  { useEffect, useState, useCallback } from 'react'
import axiosInstance from '../api';
import type { ReactNode, FC  } from 'react'
import type { User, SignupData, LoginData, AuthContextType } from '../types/auth';
import { AuthContextDef } from './authContextDef'

interface AuthProviderProps {
  children: ReactNode;
}

// CSRF token fetcher
const ensureCSRFToken = async (signal: AbortSignal): Promise<void> => {
  console.log("Here!");
  try {
    await axiosInstance.get('/api/csrf-token', {signal});
    localStorage.setItem('Visited', 'true');
  } catch (err) {
    console.warn('Failed to fetch CSRF token:', err);
  }
};

 const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  // const [isLoading, setIsLoading] = useState<boolean>(false)
  const isAuthenticated = !!user


  const checkAuthStatus = useCallback(async (check: boolean = false, signal?: AbortSignal): Promise<void> => {
        
    try {
      if (check) {
      const isToken = (await axiosInstance.get('/api/auth/is-authenticated', {signal})).data.token
      if (!isToken) {
        setUser(null)
        return
      }
    }
      // setIsLoading(true)
      const response = await axiosInstance.get('/api/user/get-logged-user', {signal})
      setUser(response.data.user)
    } catch (err: unknown) {
      console.error(err instanceof Error ? err : 'Unknown error')
      setUser(null)
    }
  }, [])

  const checkIfCSRFTokenExists = useCallback(async (signal: AbortSignal): Promise<void> => {
    if (localStorage.getItem('Visited')) {
      await checkAuthStatus(true, signal)
    } else {
      await ensureCSRFToken(signal)
    }
  }, [])

  useEffect(() => {
    const abortController = new AbortController()
    checkIfCSRFTokenExists(abortController.signal)
    return () => abortController.abort()
  },[checkIfCSRFTokenExists]) 


    const signup = useCallback(async (userData: SignupData): Promise<void> => {
      try {
        // setIsLoading(true)
        // await ensureCSRFToken()
        await axiosInstance.post('/api/auth/signup', userData)
        await checkAuthStatus() // don't check auth status after signup
      } catch (err: unknown) {
        setUser(null)
        throw err
      } finally {
        // setIsLoading(false)
      }
    }, [checkAuthStatus])

    const login =useCallback( async (userData:LoginData): Promise<void> => {
      
      try {
        // setIsLoading(true)
        // await ensureCSRFToken()
        await axiosInstance.post('/api/auth/login', userData)
        await checkAuthStatus()
      } catch (err: unknown) {
        console.error("Login error in auth context:", err)
        setUser(null)
        throw err
      } finally {
        // setIsLoading(false)
      }
      }, [checkAuthStatus])

      const logout = useCallback( async (): Promise<void> => {
        try {
          // setIsLoading(true)
          await axiosInstance.post('/api/auth/logout')
        } catch (err: unknown) {
          console.error(err instanceof Error ? err.message : "Unknown error")
          throw err
        } finally {
          setUser(null)
          // setIsLoading(false)
        }
      }, [])

      const value: AuthContextType = {
        user,
        // isLoading,
        isAuthenticated,
        login,
        signup,
        logout,
      }
      
      return <AuthContextDef.Provider value={value}>{children}</AuthContextDef.Provider>
    }
  
export default AuthProvider