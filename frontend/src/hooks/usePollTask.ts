import { useQuery } from '@tanstack/react-query'
import { tasksApi } from '../api/tasks'
import type { TaskStatus } from '../types'

export function usePollTask<T>(taskId: string | null) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => tasksApi.getStatus<T>(taskId!),
    enabled: !!taskId,
    refetchInterval: (query) => {
      const status = query.state.data?.status as TaskStatus | undefined
      if (!status || status === 'pending' || status === 'running') return 1000 // poll every 1s
      return false // stop polling
    },
    staleTime: 0,
  })
}
