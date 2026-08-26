import { create } from 'zustand'
import type { User } from '../types/auth'
import {
  lockConversationKeyVault,
  setConversationKeyAccount,
} from '../utils/encryptedMessages'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => {
    if (user?._id) {
      // The auth query initializes the vault before publishing the user. This call is
      // also kept here so direct store users cannot retain another account's cache.
      void setConversationKeyAccount(user._id)
    } else {
      lockConversationKeyVault()
    }

    set({ user, isAuthenticated: Boolean(user) })
  },
  setLoading: (loading) => set({ isLoading: loading }),
  logout: () => {
    lockConversationKeyVault()
    set({ user: null, isAuthenticated: false })
  },
}))
