import client from './client'
import type { ParseResult, PatientInfo } from '../types'

export const speechApi = {
  parse: async (file: File): Promise<ParseResult> => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await client.post<ParseResult>('/api/speech/parse', form)
    return data
  },

  analyze: async (
    patient_case_id: string,
    transcript: string,
    feature_vector: number[],
    patient_info?: PatientInfo
  ) => {
    const { data } = await client.post<{ task_id: string }>('/api/speech/analyze', {
      patient_case_id,
      transcript,
      feature_vector,
      patient_info,
    })
    return data
  },

  explain: async (
    patient_case_id: string,
    analysis_id: string,
    transcript: string,
    result: object,
    feature_vector: number[]
  ) => {
    const { data } = await client.post<{ task_id: string }>('/api/speech/explain', {
      patient_case_id,
      analysis_id,
      transcript,
      result,
      feature_vector,
    })
    return data
  },

  chat: async (
    message: string,
    nlp_result: object,
    transcript: string,
    history: unknown[] = []
  ) => {
    const { data } = await client.post<{ answer: string; sources: unknown[] }>('/api/speech/chat', {
      message,
      nlp_result,
      transcript,
      history,
    })
    return data
  },
}
