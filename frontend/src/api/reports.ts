import client from './client'
import type { ReportEntry } from '../types'

export const reportsApi = {
  list: async (patient_case_id: string): Promise<ReportEntry[]> => {
    const { data } = await client.get<{ reports: ReportEntry[] }>(`/api/reports/${patient_case_id}`)
    return data.reports ?? []
  },

  generateCombined: async (patient_case_id: string, analysis_id?: string) => {
    const { data } = await client.post<{ task_id: string }>('/api/reports/combined', {
      patient_case_id,
      analysis_id,
    })
    return data
  },

  downloadUrl: (path: string) => `/api/reports/download?path=${encodeURIComponent(path)}`,
}
