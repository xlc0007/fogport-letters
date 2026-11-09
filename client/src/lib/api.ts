import type {
  ApiErrorResponse,
  CreateSessionResponse,
  GetSessionResponse,
  HealthResponse,
  SubmitTurnResponse,
} from "@fogport/shared";

const API_PREFIX = (
  (import.meta.env.VITE_API_PREFIX as string | undefined) ||
  (import.meta.env.MODE === "hosted" ? "/functions/v1/app/api" : "/api")
).replace(/\/$/, "");

export class ApiClientError extends Error {
  readonly code: string | null;
  readonly status: number | null;
  readonly retryable: boolean;

  constructor(
    message: string,
    options: { code?: string | null; status?: number | null; retryable?: boolean } = {},
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = options.code ?? null;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
  }
}

export async function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>("/health");
}

export async function createSession(playerName?: string): Promise<CreateSessionResponse> {
  return request<CreateSessionResponse>("/sessions", {
    method: "POST",
    body: JSON.stringify(playerName ? { playerName } : {}),
  });
}

export async function getSession(sessionId: string): Promise<GetSessionResponse> {
  return request<GetSessionResponse>(`/sessions/${encodeURIComponent(sessionId)}`);
}

export async function submitTurn(
  sessionId: string,
  action: string,
): Promise<SubmitTurnResponse> {
  return request<SubmitTurnResponse>(`/sessions/${encodeURIComponent(sessionId)}/turns`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiClientError("无法连接服务器。请确认后端已启动，然后重试。", {
      code: "NETWORK_ERROR",
      retryable: true,
    });
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      throw new ApiClientError(payload.error.message, {
        code: payload.error.code,
        status: response.status,
        retryable: payload.error.retryable,
      });
    }
    throw new ApiClientError("服务器返回了无法识别的错误，请稍后重试。", {
      status: response.status,
      retryable: response.status >= 500,
    });
  }

  if (payload === null || typeof payload !== "object") {
    throw new ApiClientError("服务器返回的数据格式不正确。", {
      status: response.status,
    });
  }

  return payload as T;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== "object" || !("error" in value)) {
    return false;
  }
  const error = (value as { error?: unknown }).error;
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string",
  );
}

export function displayError(error: unknown): string {
  return toUiError(error).message;
}

export interface UiError {
  message: string;
  code: string | null;
  retryable: boolean;
}

export function toUiError(error: unknown): UiError {
  if (error instanceof ApiClientError) {
    return {
      message: error.message,
      code: error.code,
      retryable: error.retryable,
    };
  }
  return {
    message: "发生了意外错误。请稍后重试。",
    code: null,
    retryable: false,
  };
}
