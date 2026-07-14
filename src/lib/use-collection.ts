"use client";

// =============================================================
// useCollection — 全モジュール共通のデータアクセスフック
//
// Supabase の環境変数が設定されていれば Supabase を、
// 未設定なら localStorage（デモデータをシード）を使う。
// UI 側はこの差を意識せず CRUD できる。
// =============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabase } from "./supabase";
import { DEMO_DATA } from "./demo-data";
import type { TableMap, TableName } from "./types";
import { uid } from "./utils";

const LS_PREFIX = "dbl:data:";

function loadLocal<K extends TableName>(table: K): TableMap[K][] {
  try {
    const raw = localStorage.getItem(LS_PREFIX + table);
    if (raw) return JSON.parse(raw) as TableMap[K][];
  } catch {
    // 壊れたデータはシードで上書き
  }
  const seed = DEMO_DATA[table] as TableMap[K][];
  try {
    localStorage.setItem(LS_PREFIX + table, JSON.stringify(seed));
  } catch {
    // 容量超過などは無視（メモリ上だけで動作継続）
  }
  return seed;
}

function saveLocal<K extends TableName>(table: K, items: TableMap[K][]) {
  try {
    localStorage.setItem(LS_PREFIX + table, JSON.stringify(items));
  } catch {
    // 容量超過は無視
  }
}

// 同一テーブルを使う複数コンポーネント間で変更を同期するための軽量イベントバス
const listeners = new Map<TableName, Set<() => void>>();
function notify(table: TableName) {
  listeners.get(table)?.forEach((fn) => fn());
}

export interface CollectionOptions {
  /** Supabase 接続時に Realtime 購読する（チャット等） */
  realtime?: boolean;
}

export interface Collection<T extends { id: string; created_at: string }> {
  items: T[];
  loading: boolean;
  /** デモモード（Supabase未接続）かどうか */
  isDemo: boolean;
  add: (item: Omit<T, "id" | "created_at"> & Partial<Pick<T, "id" | "created_at">>) => Promise<T>;
  update: (id: string, patch: Partial<T>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useCollection<K extends TableName>(
  table: K,
  options: CollectionOptions = {}
): Collection<TableMap[K]> {
  type Row = TableMap[K];
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const sb = getSupabase();
  const isDemo = !sb;
  const realtime = options.realtime ?? false;
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (!sb) {
      setItems(loadLocal(table));
      setLoading(false);
      return;
    }
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order("created_at", { ascending: true });
    if (!error && data && mounted.current) {
      setItems(data as Row[]);
    }
    if (mounted.current) setLoading(false);
  }, [sb, table]);

  useEffect(() => {
    mounted.current = true;
    refresh();

    if (!sb) {
      // デモモード: 同一タブ内の他コンポーネントと同期
      const listener = () => setItems(loadLocal(table));
      if (!listeners.has(table)) listeners.set(table, new Set());
      listeners.get(table)!.add(listener);
      return () => {
        mounted.current = false;
        listeners.get(table)?.delete(listener);
      };
    }

    if (realtime) {
      const channel = sb
        .channel(`realtime:${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => refresh()
        )
        .subscribe();
      return () => {
        mounted.current = false;
        sb.removeChannel(channel);
      };
    }
    return () => {
      mounted.current = false;
    };
  }, [sb, table, realtime, refresh]);

  const add = useCallback(
    async (
      item: Omit<Row, "id" | "created_at"> & Partial<Pick<Row, "id" | "created_at">>
    ): Promise<Row> => {
      const row = {
        id: uid(),
        created_at: new Date().toISOString(),
        ...item,
      } as Row;
      if (!sb) {
        const next = [...loadLocal(table), row];
        saveLocal(table, next);
        setItems(next);
        notify(table);
        return row;
      }
      // 動的テーブル名のため supabase-js の厳密型とは合わない。フックのAPI境界で型安全性は担保済み。
      const { data, error } = await sb.from(table).insert(row as never).select().single();
      if (error) throw error;
      const inserted = (data ?? row) as Row;
      setItems((prev) => [...prev, inserted]);
      return inserted;
    },
    [sb, table]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Row>): Promise<void> => {
      if (!sb) {
        const next = loadLocal(table).map((r) =>
          r.id === id ? ({ ...r, ...patch } as Row) : r
        );
        saveLocal(table, next);
        setItems(next);
        notify(table);
        return;
      }
      const { error } = await sb.from(table).update(patch as never).eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r)));
    },
    [sb, table]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      if (!sb) {
        const next = loadLocal(table).filter((r) => r.id !== id);
        saveLocal(table, next);
        setItems(next);
        notify(table);
        return;
      }
      const { error } = await sb.from(table).delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((r) => r.id !== id));
    },
    [sb, table]
  );

  return { items, loading, isDemo, add, update, remove, refresh };
}
