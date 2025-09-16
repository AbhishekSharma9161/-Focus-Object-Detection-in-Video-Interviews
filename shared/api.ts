/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

export type ProctorEventType =
  | "LOOKING_AWAY"
  | "NO_FACE"
  | "MULTIPLE_FACES"
  | "PHONE_DETECTED"
  | "BOOK_DETECTED"
  | "DEVICE_DETECTED"
  | "DROWSINESS"
  | "AUDIO_DETECTED"
  | "INFO";

export interface ProctorEvent {
  id: string;
  type: ProctorEventType;
  message: string;
  atMs: number; // milliseconds since interview start
}

export interface ProctorSummaryCounts {
  focusLost: number;
  absenceEvents: number;
  multipleFaces: number;
  phoneDetections: number;
  bookDetections: number;
  deviceDetections: number;
}

export interface ProctorReport {
  id: string;
  candidateName: string;
  startedAt: string; // ISO timestamp
  endedAt: string; // ISO timestamp
  durationMs: number;
  events: ProctorEvent[];
  counts: ProctorSummaryCounts;
  integrityScore: number; // 0-100
}

export interface SaveReportRequest {
  report: ProctorReport;
}

export interface SaveReportResponse {
  ok: true;
  id: string;
}

export interface ListReportsResponse {
  reports: Array<{
    id: string;
    candidateName: string;
    startedAt: string;
    endedAt: string;
    integrityScore: number;
  }>;
}
