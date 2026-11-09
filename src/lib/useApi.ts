import { useCallback, useEffect, useRef, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { api } from "./api";

/**
 * Loads a GET endpoint for a report screen (AC-24): keeps the last good data
 * with the time it was fetched, and says when the device is offline so old
 * figures are never shown as new ones.
 */
export function useApi<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const seq = useRef(0);

  // State changes only when a response arrives (never synchronously inside the effect).
  const fetchData = useCallback(() => {
    const mine = ++seq.current;
    api<T>(path)
      .then((d) => {
        if (mine !== seq.current) return;
        setData(d);
        setFetchedAt(new Date());
        setError(null);
      })
      .catch((e) => mine === seq.current && setError(e))
      .finally(() => {
        if (mine !== seq.current) return;
        setLoading(false);
        setRefreshing(false);
      });
  }, [path]);

  useEffect(() => fetchData(), [fetchData]);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);

  // Stable, so screens can call it from focus effects without refetching in a loop.
  const reload = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);
  return { data, fetchedAt, error, loading, refreshing, offline, reload };
}
