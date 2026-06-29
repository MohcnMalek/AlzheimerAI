import client from './client'
import type { PatientCase, HistoryEntry } from '../types'

export const patientsApi = {
  getCases: async (): Promise<PatientCase[]> => {
    const { data } = await client.get<{ cases: PatientCase[] }>('/api/patients/cases')
    return data.cases ?? []
  },

  getHistory: async (patient_case_id: string): Promise<HistoryEntry[]> => {
    const { data } = await client.get<{ history: HistoryEntry[] }>(`/api/patients/${patient_case_id}/history`)
    return data.history ?? []
  },

  savePatient: async (patient: PatientCase): Promise<void> => {
    await client.post('/api/patients/', patient)
  },

  newCaseId: async (): Promise<string> => {
    const { data } = await client.get<{ case_id: string }>('/api/patients/new-case-id')
    return data.case_id
  },

  newAnalysisId: async (): Promise<string> => {
    const { data } = await client.get<{ analysis_id: string }>('/api/patients/new-analysis-id')
    return data.analysis_id
  },
}
