import type { User } from '@examples/shared'
import type { PropsWithChildren } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiClient } from '@/api/api-client'
import { AuthContext } from '@/hooks/use-auth'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)

  const getSession = useCallback(async () => {
    try {
      const { data } = await apiClient['get-session'].get()

      if (data) {
        setUser(data.user)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    getSession().then(() => setInitialLoading(false))
  }, [getSession])

  const value = useMemo(
    () => ({
      initialLoading,
      isAuthenticated: !!user,
      getSession,
      user,
    }),
    [initialLoading, user, getSession],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
