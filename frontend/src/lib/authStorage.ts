const TOKEN_KEY = 'trinetra_auth_token';
const WORKSPACE_ID_KEY = 'trinetra_active_workspace_id';

export function saveAuthToken(token: string, remember: boolean): void {
  try {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Ignore storage quota or restricted-mode errors
  }
}

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveActiveWorkspaceId(workspaceId: number): void {
  try {
    localStorage.setItem(WORKSPACE_ID_KEY, String(workspaceId));
  } catch {
    // Ignore storage errors
  }
}

export function getActiveWorkspaceId(): number | null {
  try {
    const raw = localStorage.getItem(WORKSPACE_ID_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function clearAuthStorage(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WORKSPACE_ID_KEY);
  } catch {
    // Ignore storage errors
  }
}

