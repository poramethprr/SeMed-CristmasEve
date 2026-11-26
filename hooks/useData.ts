"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { DbDeco, DbTree, DbUser } from "@/lib/types";

/** All users keyed by id, kept live so renamed users update everywhere. */
export function useUsers() {
  const [users, setUsers] = useState<Record<string, DbUser>>({});
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    sb.from("users")
      .select("*")
      .then(({ data }) => {
        if (alive && data)
          setUsers(Object.fromEntries((data as DbUser[]).map((u) => [u.id, u])));
      });
    const ch = sb
      .channel("users-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "users" },
        (p) => {
          if (p.eventType === "DELETE") return;
          const u = p.new as DbUser;
          setUsers((prev) => ({ ...prev, [u.id]: u }));
        },
      )
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(ch);
    };
  }, []);
  return users;
}

export function useCommunityTreeId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    sb.from("trees")
      .select("id")
      .eq("type", "community")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (alive && data) setId((data as { id: string }).id);
      });
    return () => {
      alive = false;
    };
  }, []);
  return id;
}

/** Get-or-create the user's personal tree (needs the users row to exist). */
export function usePersonalTreeId(
  userId: string | null,
  enabled: boolean,
): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !userId || !enabled) return;
    let alive = true;
    sb.rpc("ensure_personal_tree", { p_user_id: userId }).then(({ data }) => {
      if (alive && data) setId((data as DbTree).id);
    });
    return () => {
      alive = false;
    };
  }, [userId, enabled]);
  return id;
}

/** A tree + its decorations, live via Supabase Realtime. */
export function useTreeData(
  treeId: string | null,
  onRemoteDeco?: (d: DbDeco) => void,
) {
  const [tree, setTree] = useState<DbTree | null>(null);
  const [decos, setDecos] = useState<DbDeco[]>([]);
  const cb = useRef(onRemoteDeco);
  useEffect(() => {
    cb.current = onRemoteDeco;
  });

  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !treeId) return;
    let alive = true;
    sb.from("trees")
      .select("*")
      .eq("id", treeId)
      .single()
      .then(({ data }) => {
        if (alive && data) setTree(data as DbTree);
      });
    sb.from("decorations")
      .select("*")
      .eq("tree_id", treeId)
      .then(({ data }) => {
        if (alive && data) setDecos(data as DbDeco[]);
      });
    const ch = sb
      .channel(`tree-${treeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trees", filter: `id=eq.${treeId}` },
        (p) => setTree(p.new as DbTree),
      )
      // DELETE events cannot be filtered server-side, so filter on the client.
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decorations" },
        (p) => {
          if (p.eventType === "DELETE") {
            const id = (p.old as { id: string }).id;
            setDecos((d) => d.filter((x) => x.id !== id));
            return;
          }
          const row = p.new as DbDeco;
          if (row.tree_id !== treeId) return;
          setDecos((d) => {
            const i = d.findIndex((x) => x.id === row.id);
            if (i < 0) {
              if (p.eventType === "INSERT") cb.current?.(row);
              return [...d, row];
            }
            const c = d.slice();
            c[i] = row;
            return c;
          });
        },
      )
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(ch);
    };
  }, [treeId]);

  const upsertDeco = useCallback((row: DbDeco) => {
    setDecos((d) => {
      const i = d.findIndex((x) => x.id === row.id);
      if (i < 0) return [...d, row];
      const c = d.slice();
      c[i] = row;
      return c;
    });
  }, []);
  const removeDeco = useCallback(
    (id: string) => setDecos((d) => d.filter((x) => x.id !== id)),
    [],
  );

  return {
    tree: tree && tree.id === treeId ? tree : null,
    decos: decos.filter((d) => d.tree_id === treeId),
    setTree,
    upsertDeco,
    removeDeco,
  };
}

/** Cheers this device already sent (one per item per device). */
export function useCheered() {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("xmas.cheered") ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSet(new Set(raw as string[]));
    } catch {}
  }, []);
  const add = useCallback((id: string) => {
    setSet((prev) => {
      const n = new Set(prev).add(id);
      localStorage.setItem("xmas.cheered", JSON.stringify([...n]));
      return n;
    });
  }, []);
  return { cheered: set, addCheered: add };
}
