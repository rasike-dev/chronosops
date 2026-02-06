import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api'

export type WhoAmI = {
  authenticated: boolean
  user: { sub: string; email?: string; name?: string; roles: string[] } | null
}

export function useWhoAmI() {
  return useQuery({
    queryKey: ['whoami'],
    queryFn: () => apiGet<WhoAmI>('/v1/auth/whoami'),
    retry: (count, err: any) => {
      if (err?.status === 401 || err?.status === 403) return false
      return count < 1
    },
    staleTime: 30_000,
  })
}
