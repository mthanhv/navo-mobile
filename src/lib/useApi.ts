import { useCallback, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";

/** Retained data is scoped to its request; API failure is stale even with working internet. */
export function useApi<T>(path: string) {
  const [snapshot, setSnapshot] = useState<{ path: string; value: T; at: Date } | null>(null);
  const [failure, setFailure] = useState<{ path: string; error: unknown } | null>(null);
  const [settledPath, setSettledPath] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [disconnected, setDisconnected] = useState(false);
  const seq = useRef(0);
  const fetchData = useCallback(() => {
    const mine = ++seq.current;
    api<T>(path).then((value) => {
      if (mine !== seq.current) return;
      setSnapshot({ path, value, at: new Date() });
      setFailure(null);
    }).catch((error) => {
      if (mine === seq.current) setFailure({ path, error });
    }).finally(() => {
      if (mine !== seq.current) return;
      setSettledPath(path); setRefreshing(false);
    });
  }, [path]);
  const invalidate = useCallback(() => { seq.current++; }, []);
  useEffect(() => { fetchData(); return invalidate; }, [fetchData, invalidate]);
  useEffect(() => NetInfo.addEventListener((s) => setDisconnected(s.isConnected === false)), []);
  const reload = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);
  const data = snapshot?.path === path ? snapshot.value : null;
  const fetchedAt = snapshot?.path === path ? snapshot.at : null;
  const error = failure?.path === path ? failure.error : null;
  return { data, fetchedAt, error, loading: settledPath !== path, refreshing, offline: disconnected || (error != null && data !== null), reload };
}
