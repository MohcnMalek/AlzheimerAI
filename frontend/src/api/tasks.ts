import client from './client'
import type { TaskResponse } from '../types'

export const tasksApi = {
  getStatus: async <T>(task_id: string): Promise<TaskResponse<T>> => {
    const { data } = await client.get<TaskResponse<T>>(`/api/tasks/${task_id}`)
    return data
  },
}
