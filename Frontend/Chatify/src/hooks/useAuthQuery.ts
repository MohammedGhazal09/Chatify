import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { userApi } from '../api/userApi'
import { useAuthStore } from '../store/authstore'
import { usePresenceStore } from '../store/presenceStore'
import { broadcastSessionEvent } from './useSessionBroadcast'
import type { LoginData, SignupData } from '../types/auth'
import { useEffect } from 'react'

export const activeSessionsQueryKey = ['activeSessions'] as const

const publicAuthRoutes = new Set(['/login', '/signup', '/forgot-password'])

const isPublicAuthRoute = () => (
  typeof window !== 'undefined' && publicAuthRoutes.has(window.location.pathname)
)

// Initialize auth check on app load
export const useAuthInit = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const setLoading = useAuthStore((state) => state.setLoading)

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      await authApi.fetchCSRFToken()
      const authStatus = await authApi.checkAuth()

      if (!authStatus.data.token) {
        if (isPublicAuthRoute()) {
          return null
        }

        try {
          await authApi.refreshToken()
        } catch {
          return null
        }
      }

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

export const useSetUsername = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (username: string) => userApi.setUsername({ username }),
    onSuccess: (response) => {
      const user = response.data.data.user
      setUser(user)
      queryClient.setQueryData(['auth'], user)
      queryClient.invalidateQueries({ queryKey: ['auth'] })
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

export const useActiveSessions = (enabled = true) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return useQuery({
    queryKey: activeSessionsQueryKey,
    queryFn: async () => {
      const response = await authApi.getActiveSessions()
      return response.data.data.sessions
    },
    enabled: enabled && isAuthenticated,
  })
}

export const useRevokeSession = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sessionId: string) => authApi.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: activeSessionsQueryKey })
    },
  })
}

export const useRevokeAllSessions = () => {
  const logout = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()
  const clearPresenceState = () => usePresenceStore.getState().clearPresenceState()

  return useMutation({
    mutationFn: () => authApi.revokeAllSessions(),
    onSuccess: () => {
      clearPresenceState()
      logout()
      queryClient.clear()
      broadcastSessionEvent('logout', 'remote')
    },
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
