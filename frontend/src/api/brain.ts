import client from './client'
import type { ChatMessage } from '../types'

export const brainApi = {
  upload: async (file: File) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await client.post<{ file_id: string; filename: string; size: number }>(
      '/api/brain/upload',
      form
    )
    return data
  },

  analyze: async (file_id: string, patient_case_id: string, age: number, sex: string) => {
    const { data } = await client.post<{ task_id: string }>('/api/brain/analyze', {
      file_id,
      patient_case_id,
      age,
      sex,
    })
    return data
  },

  gradcam: async (
    file_id: string,
    patient_case_id: string,
    analysis_id: string,
    orientation: string,
    display_mode: string,
    age: number,
    sex: string
  ) => {
    const { data } = await client.post<{ task_id: string }>('/api/brain/gradcam', {
      file_id,
      patient_case_id,
      analysis_id,
      orientation,
      display_mode,
      age,
      sex,
    })
    return data
  },

  explain: async (
    patient_case_id: string,
    analysis_id: string,
    result: object,
    gradcam_info?: object,
    question?: string
  ) => {
    const { data } = await client.post<{ task_id: string }>('/api/brain/explain', {
      patient_case_id,
      analysis_id,
      result,
      gradcam_info,
      question,
    })
    return data
  },

  chat: async (
    message: string,
    cnn_result: object,
    gradcam_info?: object,
    history: ChatMessage[] = []
  ) => {
    const { data } = await client.post<{ answer: string; sources: unknown[] }>('/api/brain/chat', {
      message,
      cnn_result,
      gradcam_info,
      history,
    })
    return data
  },
}
