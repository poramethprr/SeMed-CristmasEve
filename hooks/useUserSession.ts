"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

const KEY_ID = "xmas.user_id";
const KEY_NAME = "xmas.display_name";

export interface UserSession {
  userId: string | null;
  displayName: string | null;
  /** true once localStorage has been read (avoids SSR flash of the modal). */
  ready: boolean;
  /** true when no name is stored yet → show the welcome modal. */
  needsName: boolean;
  saveName: (name: string) => Promise<void>;
}

export function useUserSession(): UserSession {
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let id = localStorage.getItem(KEY_ID);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY_ID, id);
    }
    // Hydrating from localStorage is an external-system sync; one-shot setState is intended.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserId(id);
    setDisplayName(localStorage.getItem(KEY_NAME));
    setReady(true);
  }, []);

  const saveName = useCallback(
    async (raw: string) => {
      const name = raw.trim().slice(0, 30);
      if (!name || !userId) return;
      localStorage.setItem(KEY_NAME, name);
      setDisplayName(name);
      const sb = getSupabase();
      if (sb) {
        // Upsert keeps one row per device; names shown elsewhere join on users.
        await sb.from("users").upsert({ id: userId, display_name: name });
      }
    },
    [userId],
  );

  return {
    userId,
    displayName,
    ready,
    needsName: ready && !displayName,
    saveName,
  };
}
