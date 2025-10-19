import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../store/authstore'
import type { LoginData, SignupData } from '../types/auth'
import { useEffect } from 'react'

// Initialize auth check on app load
export const useAuthInit = () => {
  const setLoading = useAuthStore((state) => state.setLoading)
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    const initAuth = async () => {
      try {
        setLoading(true)
        await authApi.fetchCSRFToken()
        const authCheck = await authApi.checkAuth()
        if (!authCheck.data.token) {
          setUser(null)
          return
        }

        // Fetch user data if authenticated
        const userResponse = await authApi.getLoggedUser()
        setUser(userResponse.data.user)
      } catch (error) {
        console.error('Auth initialization failed:', error)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()
  }, [setLoading, setUser])
}

export const useSignup = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SignupData) => authApi.signup(data),
    onSuccess: async () => {
      try {
        const userResponse = await authApi.getLoggedUser()
        setUser(userResponse.data.user)
        queryClient.invalidateQueries({ queryKey: ['auth'] })
      } catch (error) {
        console.error('Failed to fetch user after signup:', error)
        throw new Error('Signup succeeded but failed to fetch user data')
      }
    }
  })
}

export const useLogin = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: LoginData) => authApi.login(data),
    onSuccess: async () => {
      try {
        const userResponse = await authApi.getLoggedUser()
        setUser(userResponse.data.user)
        
        // Invalidate any auth-related queries if they exist
        queryClient.invalidateQueries({ queryKey: ['auth'] })
      } catch (error) {
        console.error('Failed to fetch user after login:', error)
        throw new Error('Login succeeded but failed to fetch user data')
      }
    },
    onError: (error) => {
      console.error('Login failed:', error)
    }
  })
}

export const useLogout = () => {
  const logout = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      logout()
    },
    onError: (error) => {
      console.error('Logout failed:', error)
      logout()
      queryClient.removeQueries({ queryKey: ['auth'] })
    }
  })
}