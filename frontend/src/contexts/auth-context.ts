import { createContext } from 'react';
import type { AuthUser, LoginPayload, WorkspaceInfo } from '@/lib/api';

export type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  workspaces: WorkspaceInfo[];
  activeWorkspace: WorkspaceInfo | null;
  sessionNotice: string | null;
  isLoggingOut: boolean;
  clearSessionNotice: () => void;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  switchWorkspace: (workspaceId: number) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

