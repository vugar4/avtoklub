"use client";
import { useCallback, useEffect, useState } from "react";
import { api, User } from "./api";

export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true); setError(null);
    try { setData(await api<T>(path)); } catch (e) { setError(e instanceof Error ? e.message : "Məlumat yüklənmədi"); }
    finally { setLoading(false); }
  }, [path]);
  useEffect(() => { const timer = setTimeout(() => { void reload(); }, 0); return () => clearTimeout(timer); }, [reload]);
  return { data, setData, loading, error, reload };
}

export type MeResponse = { user: User | null; counts?: { notifications?: number; messages?: number } };
