import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, loadToken, saveToken, setUnauthorizedHandler } from "./api";
import { setDraftOwner } from "./drafts";
import { registerForPush, unregisterPush } from "./push";
import type { Me } from "./types";

type Session = {
  me: Me | null;
  ready: boolean;
  can: (permission: string) => boolean;
  /** `code` is the authenticator or recovery code when the account uses two-step sign-in. */
  login: (email: string, password: string, code?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Reloads who is signed in (after changing the password). */
  refresh: () => Promise<void>;
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
      .then((t) => (t ? api<Me>("/me").then((m) => { setDraftOwner(m.user.id); setMe(m); void registerForPush(); }) : undefined))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [clear]);

  const login = useCallback(async (email: string, password: string, code?: string) => {
    // Six digits is an authenticator code; anything else is a one-time recovery code.
    const second = !code ? {} : /^\d{6}$/.test(code.replace(/\s/g, "")) ? { code } : { recovery_code: code };
    const res = await api<{ token: string }>("/auth/login", { method: "POST", body: { email, password, client: "mobile", ...second } });
    await saveToken(res.token);
    const m = await api<Me>("/me");
    setDraftOwner(m.user.id);
    setMe(m);
    void registerForPush();
  }, []);

  const refresh = useCallback(async () => { setMe(await api<Me>("/me")); }, []);

  const logout = useCallback(async () => {
    await unregisterPush();
    await api("/auth/logout", { method: "POST" }).catch(() => undefined);
    await clear();
  }, [clear]);

  const value = useMemo<Session>(() => {
    const perms = new Set(me?.permissions ?? []);
    return { me, ready, can: (p) => perms.has(p), login, logout, refresh };
  }, [me, ready, login, logout, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
