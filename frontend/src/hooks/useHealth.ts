import { useQuery } from '@tanstack/react-query'
import client from '../api/client'

interface Health {
  status: string
  db: boolean
  models: { cnn: boolean; nlp: boolean }
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data } = await client.get<Health>('/api/health')
      return data
    },
    refetchInterval: 30000,
  })
}
