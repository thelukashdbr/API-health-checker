export type CheckStatus = 'UP' | 'DOWN';

export type CheckErrorType = 'TIMEOUT' | 'CONNECTION_ERROR' | 'INVALID_URL' | 'BLOCKED_ADDRESS';

export interface CheckResult {
  status: CheckStatus;
  statusCode?: number;
  responseTimeMs: number;
  error?: CheckErrorType;
}

export interface BatchCheckResult extends CheckResult {
  url: string;
}
