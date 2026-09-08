import type { PatternKind, PatternPayload } from './types';

export type PatternSearchJob = {
  id: string;
  pattern: PatternKind;
  market: 'US' | 'TA';
  status: 'queued' | 'running' | 'completed' | 'failed';
  createdAt: string;
  finishedAt: string | null;
  summary: PatternPayload | null;
};
export type PatternRequestStatus = {
  serverTime: string;
  nextAllowedAt: string | null;
  job: PatternSearchJob | null;
  accepted?: boolean;
  reused?: boolean;
};
