export interface ApiErrorEnvelope {
  code: string;
  message: string;
  retryable: boolean;
  details?: unknown;
}

export interface ApiResponseEnvelope<TData = unknown> {
  data: TData | null;
  error: ApiErrorEnvelope | null;
  meta?: {
    traceId?: string;
    timestamp?: string;
    [k: string]: unknown;
  };
}
