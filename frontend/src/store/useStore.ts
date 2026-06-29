import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CNNResult,
  GradCAMImage,
  NLPResult,
  SpeechFeatures,
  PatientInfo,
  ReportPaths,
  ChatMessage,
  RAGSource,
} from '../types'

interface AppState {
  // Patient
  patientCaseId: string
  dbAvailable: boolean

  // Brain scan
  brainFileId: string | null
  brainFileName: string | null
  brainAge: number
  brainSex: 'F' | 'M'
  brainAnalysisId: string | null
  brainResult: CNNResult | null
  brainReportPaths: ReportPaths | null
  previewPath: string | null

  // GradCAM
  gradcamImages: GradCAMImage[]
  gradcamOrientation: string
  gradcamDisplayMode: string

  // Brain explanation
  brainExplanation: string
  brainSources: RAGSource[]
  brainMessages: ChatMessage[]

  // Speech
  speechFileName: string | null
  speechTranscript: string
  speechCleanedTranscript: string
  speechFeatures: SpeechFeatures | null
  speechFeatureVector: number[]
  speechAnalysisId: string | null
  speechResult: NLPResult | null
  speechReportPaths: ReportPaths | null
  speechExplanation: string
  speechMessages: ChatMessage[]
  patientInfo: PatientInfo

  // Actions
  setPatientCaseId: (id: string) => void
  setDbAvailable: (v: boolean) => void
  resetBrain: () => void
  resetSpeech: () => void
  resetPatient: () => void
  setBrainFile: (fileId: string, fileName: string) => void
  setBrainAge: (age: number) => void
  setBrainSex: (sex: 'F' | 'M') => void
  setBrainResult: (analysisId: string, result: CNNResult, reportPaths: ReportPaths) => void
  setGradcam: (images: GradCAMImage[], orientation: string, mode: string) => void
  setBrainExplanation: (answer: string, sources: RAGSource[]) => void
  addBrainMessage: (msg: ChatMessage) => void
  setSpeechFile: (
    fileName: string,
    transcript: string,
    cleanedTranscript: string,
    features: SpeechFeatures,
    featureVector: number[]
  ) => void
  setSpeechResult: (
    analysisId: string,
    result: NLPResult,
    reportPaths: ReportPaths,
    explanation: string
  ) => void
  setSpeechExplanation: (explanation: string) => void
  addSpeechMessage: (msg: ChatMessage) => void
  setPatientInfo: (info: PatientInfo) => void
  setPreviewPath: (path: string | null) => void
}

const INITIAL_BRAIN = {
  brainFileId: null,
  brainFileName: null,
  brainAge: 72,
  brainSex: 'F' as const,
  brainAnalysisId: null,
  brainResult: null,
  brainReportPaths: null,
  previewPath: null,
  gradcamImages: [],
  gradcamOrientation: 'multi',
  gradcamDisplayMode: 'overlay',
  brainExplanation: '',
  brainSources: [],
  brainMessages: [],
}

const INITIAL_SPEECH = {
  speechFileName: null,
  speechTranscript: '',
  speechCleanedTranscript: '',
  speechFeatures: null,
  speechFeatureVector: [],
  speechAnalysisId: null,
  speechResult: null,
  speechReportPaths: null,
  speechExplanation: '',
  speechMessages: [],
  patientInfo: {},
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      patientCaseId: '',
      dbAvailable: false,
      ...INITIAL_BRAIN,
      ...INITIAL_SPEECH,

      setPatientCaseId: (id) => set({ patientCaseId: id }),
      setDbAvailable: (v) => set({ dbAvailable: v }),
      resetBrain: () => set(INITIAL_BRAIN),
      resetSpeech: () => set(INITIAL_SPEECH),
      resetPatient: () => set({ patientCaseId: '', ...INITIAL_BRAIN, ...INITIAL_SPEECH }),
      setBrainFile: (fileId, fileName) =>
        set({ ...INITIAL_BRAIN, brainFileId: fileId, brainFileName: fileName }),
      setBrainAge: (age) => set({ brainAge: age }),
      setBrainSex: (sex) => set({ brainSex: sex }),
      setBrainResult: (analysisId, result, reportPaths) =>
        set({ brainAnalysisId: analysisId, brainResult: result, brainReportPaths: reportPaths }),
      setGradcam: (images, orientation, mode) =>
        set({ gradcamImages: images, gradcamOrientation: orientation, gradcamDisplayMode: mode }),
      setBrainExplanation: (answer, sources) =>
        set({ brainExplanation: answer, brainSources: sources }),
      addBrainMessage: (msg) => set((s) => ({ brainMessages: [...s.brainMessages, msg] })),
      setSpeechFile: (fileName, transcript, cleanedTranscript, features, featureVector) =>
        set({
          ...INITIAL_SPEECH,
          speechFileName: fileName,
          speechTranscript: transcript,
          speechCleanedTranscript: cleanedTranscript,
          speechFeatures: features,
          speechFeatureVector: featureVector,
        }),
      setSpeechResult: (analysisId, result, reportPaths, explanation) =>
        set({
          speechAnalysisId: analysisId,
          speechResult: result,
          speechReportPaths: reportPaths,
          speechExplanation: explanation,
        }),
      setSpeechExplanation: (explanation) => set({ speechExplanation: explanation }),
      addSpeechMessage: (msg) => set((s) => ({ speechMessages: [...s.speechMessages, msg] })),
      setPatientInfo: (info) => set({ patientInfo: info }),
      setPreviewPath: (path) => set({ previewPath: path }),
    }),
    {
      name: 'alzheimer-store',
      partialize: (state) => ({ patientCaseId: state.patientCaseId }), // only persist patient ID
    }
  )
)
