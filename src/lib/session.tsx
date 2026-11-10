import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, loadToken, saveToken, setUnauthorizedHandler } from "./api";
import { setDraftOwner } from "./drafts";
import type { Me } from "./types";

type Session = {
  me: Me | null;
  ready: boolean;
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const clear = useCallback(async () => {
    setDraftOwner(null);
    await saveToken(null); // drop the token so nothing of the old session lingers on the phone
    setMe(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    loadToken()
      .then((t) => (t ? api<Me>("/me").then((m) => { setDraftOwner(m.user.id); setMe(m); }) : undefined))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [clear]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ token: string }>("/auth/login", { method: "POST", body: { email, password, client: "mobile" } });
    await saveToken(res.token);
    const m = await api<Me>("/me");
    setDraftOwner(m.user.id);
    setMe(m);
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await clear();
  }, [clear]);

  const value = useMemo<Session>(() => {
    const perms = new Set(me?.permissions ?? []);
    return { me, ready, can: (p) => perms.has(p), login, logout };
  }, [me, ready, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
