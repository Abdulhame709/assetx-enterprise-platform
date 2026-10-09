import { createContext, type PropsWithChildren, useContext, useEffect, useMemo, useState } from "react";
import { login, logout } from "./api";
import type { AssetXUser } from "./domain";
import { clearAuth, getBackendUrl, getStoredUser, getTokens, saveBackendUrl } from "./secure-storage";

interface SessionContextValue { ready: boolean; user: AssetXUser | null; backendUrl: string | null; signIn: (username: string, password: string) => Promise<void>; signOut: () => Promise<void>; updateBackendUrl: (url: string) => Promise<void>; }
const SessionContext = createContext<SessionContextValue | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false); const [user, setUser] = useState<AssetXUser | null>(null); const [backendUrl, setBackendUrl] = useState<string | null>(null);
  useEffect(() => { void (async () => { const [storedUrl, storedUser, tokens] = await Promise.all([getBackendUrl(), getStoredUser(), getTokens()]); setBackendUrl(storedUrl); setUser(storedUser && tokens ? storedUser : null); setReady(true); })(); }, []);
  const value = useMemo<SessionContextValue>(() => ({ ready, user, backendUrl, signIn: async (username, password) => { setUser(await login(username, password)); }, signOut: async () => { await logout(); setUser(null); }, updateBackendUrl: async (url) => { const nextUrl = await saveBackendUrl(url); if (nextUrl !== backendUrl) { await clearAuth(); setUser(null); } setBackendUrl(nextUrl); } }), [backendUrl, ready, user]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() { const context = useContext(SessionContext); if (!context) throw new Error("SessionProvider is required"); return context; }
