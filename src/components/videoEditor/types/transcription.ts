import type { LanguageCode } from './language';

export type TranscriptionLanguage = LanguageCode | 'auto';

export type TranscriptionSubtask = 'transcribe' | 'translate';

export interface TranscriptionSegment {
  text: string;
  start: number;
  end: number;
}

export interface TranscriptionChunk {
  text: string;
  timestamp: [number, number | null];
  finalised: boolean;
  offset: number;
}

export interface TranscriptionResult {
  text: string;
  segments: TranscriptionSegment[];
  language: string;
  tps?: number;
}

export type TranscriptionStatus = 'idle' | 'loading-model' | 'transcribing' | 'complete' | 'error';

export interface TranscriptionProgress {
  status: TranscriptionStatus;
  progress: number;
  message?: string;
}

export interface CaptionChunk {
  text: string;
  startTime: number;
  duration: number;
}
