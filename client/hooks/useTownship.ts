import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { TwinSnapshot, TwinState } from "../../shared/twin";

export function useTownship() {
  const [snapshot, setSnapshot] = useState<TwinSnapshot | null>(null);
  const [online, setOnline] = useState(false);
  const [receivedAt, setReceivedAt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0),
    mounted = useRef(false),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      const before = generation.current;
      try {
        const next = await api<TwinSnapshot>("/twin");
        if (!cancelled && before === generation.current) {
          setSnapshot(next);
          setOnline(true);
          setReceivedAt(performance.now());
          setError("");
        }
      } catch (e) {
        if (!cancelled && before === generation.current) {
          setOnline(false);
          setError(e instanceof Error ? e.message : "Controller unavailable");
        }
      }
      if (!cancelled) timer = setTimeout(poll, 1000);
    }
    void poll();
    return () => {
      cancelled = true;
      mounted.current = false;
      clearTimeout(timer);
    };
  }, []);
  const command = useCallback(
    async (active: boolean, lossLps = active ? 3.6 : 0) => {
      if (pending.current) return;
      pending.current = true;
      setBusy(true);
      generation.current++;
      try {
        const state = await api<TwinState>("/twin/leak", "POST", {
          pipeId: "L-01",
          active,
          lossLps,
        });
        if (mounted.current) {
          setSnapshot((previous) => ({
            state,
            events: previous?.events || [],
          }));
          setOnline(true);
          setReceivedAt(performance.now());
          setError("");
        }
      } catch (e) {
        if (mounted.current)
          setError(e instanceof Error ? e.message : "Command failed");
      } finally {
        generation.current++;
        pending.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [],
  );
  return { snapshot, online, receivedAt, error, busy, command };
}
