import type { ApiErrorCode } from "@fogport/shared";

export class GameError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly retryable: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode: number,
    retryable = false,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "GameError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}
