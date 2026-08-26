import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../api/authApi'
import { userApi } from '../api/userApi'
import { useAuthStore } from '../store/authstore'
import { usePresenceStore } from '../store/presenceStore'
import {
  lockConversationKeyVault,
  setConversationKeyAccount,
} from '../utils/encryptedMessages'
import { revokeChatifyPushNotifications } from '../utils/pushNotifications'
import { broadcastSessionEvent } from './useSessionBroadcast'
import type { LoginData, SignupData, TwoFactorProtectedActionData, VerifyTwoFactorLoginData } from '../types/auth'
import { useEffect } from 'react'

export const activeSessionsQueryKey = ['activeSessions'] as const
export const twoFactorStatusQueryKey = ['twoFactorStatus'] as const

const publicAuthRoutes = new Set(['/login', '/signup', '/forgot-password'])

const isPublicAuthRoute = () => (
  typeof window !== 'undefined' && publicAuthRoutes.has(window.location.pathname)
)

const removeCurrentBrowserPushState = () => revokeChatifyPushNotifications(
  (endpoint) => userApi.removePushSubscription(endpoint).then(() => undefined)
).catch(() => undefined)

const clearAnonymousBrowserPushState = () => revokeChatifyPushNotifications()
  .catch(() => undefined)

const activateAuthenticatedUser = async <T extends { _id: string }>(user: T) => {
  await setConversationKeyAccount(user._id)
  return user
}

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
          lockConversationKeyVault()
          return null
        }

        try {
          await authApi.refreshToken()
        } catch {
          lockConversationKeyVault()
          return null
        }
      }

      try {
        const userResponse = await authApi.getLoggedUser()
        return activateAuthenticatedUser(userResponse.data.user)
      } catch {
        lockConversationKeyVault()
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

  useEffect(() => {
    if (!isLoading && !user) {
      void clearAnonymousBrowserPushState()
    }
  }, [isLoading, user])
}

export const useSignup = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: SignupData) => authApi.signup(data),
    onSuccess: async () => {
      try {
        const userResponse = await authApi.getLoggedUser()
        const user = await activateAuthenticatedUser(userResponse.data.user)
        setUser(user)
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
    onSuccess: async (response) => {
      if (response.data.status === 'mfa_required') {
        return
      }

      try {
        const userResponse = await authApi.getLoggedUser()
        const user = await activateAuthenticatedUser(userResponse.data.user)
        setUser(user)
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

export const useVerifyTwoFactorLogin = () => {
  const setUser = useAuthStore((state) => state.setUser)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: VerifyTwoFactorLoginData) => authApi.verifyTwoFactorLogin(data),
    onSuccess: async (response) => {
      if (response.data.status !== 'success') {
        return
      }

      try {
        const userResponse = await authApi.getLoggedUser()
        const user = await activateAuthenticatedUser(userResponse.data.user)
        setUser(user)
        queryClient.invalidateQueries({ queryKey: ['auth'] })
      } catch (error) {
        console.error('Failed to fetch user after two-factor login:', error)
        throw new Error('Two-factor login succeeded but failed to fetch user data')
      }
    },
  })
}

export const useLogout = () => {
  const logout = useAuthStore((state) => state.logout)
  const queryClient = useQueryClient()
  const clearPresenceState = () => usePresenceStore.getState().clearPresenceState()

  return useMutation({
    mutationFn: async () => {
      await removeCurrentBrowserPushState()
      return authApi.logout()
    },
    onSuccess: () => {
      clearPresenceState()
      logout()
      queryClient.clear()
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
    mutationFn: async () => {
      await removeCurrentBrowserPushState()
      return authApi.revokeAllSessions()
    },
    onSuccess: () => {
      clearPresenceState()
      logout()
      queryClient.clear()
      broadcastSessionEvent('logout', 'remote')
    },
  })
}

export const useTwoFactorStatus = (enabled = true) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return useQuery({
    queryKey: twoFactorStatusQueryKey,
    queryFn: async () => {
      const response = await authApi.getTwoFactorStatus()
      return response.data.data.twoFactor
    },
    enabled: enabled && isAuthenticated,
  })
}

export const useSetupTwoFactor = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (currentPassword: string) => authApi.setupTwoFactor(currentPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: twoFactorStatusQueryKey })
    },
  })
}

export const useConfirmTwoFactor = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code: string) => authApi.confirmTwoFactor(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: twoFactorStatusQueryKey })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export const useDisableTwoFactor = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TwoFactorProtectedActionData) => authApi.disableTwoFactor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: twoFactorStatusQueryKey })
      queryClient.invalidateQueries({ queryKey: ['auth'] })
    },
  })
}

export const useRegenerateBackupCodes = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: TwoFactorProtectedActionData) => authApi.regenerateBackupCodes(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: twoFactorStatusQueryKey })
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
