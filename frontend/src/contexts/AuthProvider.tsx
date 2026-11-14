import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  api,
  registerUnauthorizedHandler,
  type AuthMeResponse,
  type AuthUser,
  type LoginPayload,
  type LoginResponse,
  type WorkspaceInfo,
} from '@/lib/api';
import {
  clearAuthStorage,
  getActiveWorkspaceId,
  getAuthToken,
  saveActiveWorkspaceId,
  saveAuthToken,
} from '@/lib/authStorage';
import { AuthContext, type AuthStatus } from './auth-context';

function resolveInitialWorkspace(
  workspaces: WorkspaceInfo[],
  fallback: WorkspaceInfo | null
): WorkspaceInfo | null {
  const savedId = getActiveWorkspaceId();
  if (savedId !== null) {
    const matched = workspaces.find((ws) => ws.id === savedId);
    if (matched) return matched;
  }
  return fallback ?? workspaces[0] ?? null;
}

function syncBrowserPath(targetPath: string, replace = true): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === targetPath) return;

  if (replace) {
    window.history.replaceState(null, '', targetPath);
  } else {
    window.history.pushState(null, '', targetPath);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>('booting');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceInfo | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const statusRef = useRef<AuthStatus>(status);
  statusRef.current = status;

  const intendedPathRef = useRef<string>(
    typeof window !== 'undefined' && window.location.pathname !== '/login'
      ? window.location.pathname + window.location.search
      : '/'
  );

  const applyUnauthenticatedState = useCallback(
    (notice: string | null) => {
      clearAuthStorage();
      queryClient.clear();
      setUser(null);
      setWorkspaces([]);
      setActiveWorkspace(null);
      setSessionNotice(notice);
      setStatus('unauthenticated');
      syncBrowserPath('/login', true);
    },
    [queryClient]
  );

  // Register global 401 handler so expired/revoked tokens return the user to /login immediately
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      if (statusRef.current === 'unauthenticated') return;
      applyUnauthenticatedState('Sesi Anda telah berakhir. Silakan masuk kembali.');
    });

    return () => registerUnauthorizedHandler(null);
  }, [applyUnauthenticatedState]);

  // Verify existing token on initial load
  useEffect(() => {
    let active = true;
    const token = getAuthToken();

    if (!token) {
      setStatus('unauthenticated');
      syncBrowserPath('/login', true);
      return;
    }

    api
      .get<AuthMeResponse>('/me')
      .then((res) => {
        if (!active) return;
        const wsList = res.data.workspaces ?? [];
        const selected = resolveInitialWorkspace(wsList, res.data.active_workspace);
        if (selected) {
          saveActiveWorkspaceId(selected.id);
        }
        setUser(res.data.user);
        setWorkspaces(wsList);
        setActiveWorkspace(selected);
        setSessionNotice(null);
        setStatus('authenticated');
        if (window.location.pathname === '/login') {
          syncBrowserPath(intendedPathRef.current || '/', true);
        }
      })
      .catch(() => {
        if (!active) return;
        applyUnauthenticatedState(null);
      });

    return () => {
      active = false;
    };
  }, [applyUnauthenticatedState]);

  // Keep browser history aligned with auth state
  useEffect(() => {
    const handlePopState = () => {
      if (statusRef.current === 'unauthenticated' && window.location.pathname !== '/login') {
        syncBrowserPath('/login', true);
      } else if (statusRef.current === 'authenticated' && window.location.pathname === '/login') {
        syncBrowserPath('/', true);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await api.post<LoginResponse>('/auth/login', payload);
      const data = res.data;

      saveAuthToken(data.token, payload.remember);
      const wsList = data.workspaces ?? [];
      const selected = resolveInitialWorkspace(wsList, data.active_workspace);
      if (selected) {
        saveActiveWorkspaceId(selected.id);
      }

      queryClient.clear();
      setUser(data.user);
      setWorkspaces(wsList);
      setActiveWorkspace(selected);
      setSessionNotice(null);
      setStatus('authenticated');
      syncBrowserPath(intendedPathRef.current || '/', false);
    },
    [queryClient]
  );

  const logout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await api.post('/auth/logout');
    } catch {
      // Clear local session even if the token is already expired on the server
    } finally {
      setIsLoggingOut(false);
      intendedPathRef.current = '/';
      applyUnauthenticatedState('Anda telah keluar dari konsol.');
    }
  }, [applyUnauthenticatedState]);

  const switchWorkspace = useCallback(
    (workspaceId: number) => {
      const next = workspaces.find((ws) => ws.id === workspaceId);
      if (!next || next.id === activeWorkspace?.id) return;

      saveActiveWorkspaceId(next.id);
      setActiveWorkspace(next);
      queryClient.invalidateQueries();
    },
    [activeWorkspace?.id, queryClient, workspaces]
  );

  const clearSessionNotice = useCallback(() => {
    setSessionNotice(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        workspaces,
        activeWorkspace,
        sessionNotice,
        isLoggingOut,
        clearSessionNotice,
        login,
        logout,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

