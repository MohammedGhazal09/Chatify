import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { useAuthStore } from '../store/authstore'
import { usePresenceStore } from '../store/presenceStore'
import { broadcastSessionEvent } from './useSessionBroadcast'
import type { LoginData, SignupData } from '../types/auth'
import { useEffect } from 'react'

// Initialize auth check on app load
export const useAuthInit = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const setLoading = useAuthStore((state) => state.setLoading)

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      await authApi.fetchCSRFToken()
      try {
        const userResponse = await authApi.getLoggedUser()
        return userResponse.data.user
      } catch {
        return null
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  })

  useEffect(() => {
    setUser(user || null)
  }, [user, setUser])

  useEffect(() => {
    setLoading(isLoading)
  }, [isLoading, setLoading])
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
        queryClient.invalidateQueries({ queryKey: ['auth'] })
      } catch (error) {
        console.error('Failed to fetch user after login:', error)
        throw new Error('Login succeeded but failed to fetch user data')
      }
    }
  })
}

export const useLogout = () => {
  const logout = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()
  const clearPresenceState = () => usePresenceStore.getState().clearPresenceState()

  return useMutation({
    mutationFn: () => authApi.logout(),
    onSuccess: () => {
      clearPresenceState()
      logout()
      queryClient.clear() // Clear all cached queries
      queryClient.invalidateQueries({ queryKey: ['auth'] })
      broadcastSessionEvent('logout', 'user')
    },
    onError: (error) => {
      console.error('Logout failed:', error)
      clearPresenceState()
      logout()
      queryClient.clear()
      broadcastSessionEvent('logout', 'user')
    }
  })
}

export const useForgotPassword = () => {
  return useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
  })
}

export const useVerifyResetCode = () => {
  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) => authApi.verifyPasswordResetCode(email, code),
  })
}

export const useResetPassword = () => {
  return useMutation({
    mutationFn: ({ email, code, newPassword }: { email: string; code: string; newPassword: string }) => authApi.resetPassword(email, code, newPassword),
  })
}
