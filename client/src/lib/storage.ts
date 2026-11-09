const SESSION_STORAGE_KEY = "fogport.session.v1";

export function loadSavedSessionId(): string | null {
  try {
    const value = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export function saveSessionId(sessionId: string): void {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  } catch {
    // 浏览器禁用存储时仍可游玩当前页面，只是刷新后无法自动恢复。
  }
}

export function clearSavedSessionId(): void {
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}
