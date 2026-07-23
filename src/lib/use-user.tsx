"use client";

// 現在のユーザー管理。
// - デモモード: localStorage に保存したデモメンバーを利用（切替可能）
// - Supabase接続時: Supabase Auth のセッションを利用
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { getSupabase } from "./supabase";
import { DEMO_TEAM } from "./demo/team";

// 実ユーザーのアバター色を名前/メールから決定的に割り当てる
const AVATAR_PALETTE = ["indigo", "violet", "emerald", "sky", "amber", "rose", "teal"];
function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export interface CurrentUser {
  /** profiles.id（Supabase接続時は auth.uid()、デモモードは DEMO_TEAM の id） */
  id: string;
  name: string;
  email: string;
  role: string;
  color: string; // アバター色キー（constants.AVATAR_COLORS）
}

interface UserContextValue {
  user: CurrentUser | null;
  loading: boolean;
  isDemo: boolean;
  /** デモモードでユーザーを切り替える */
  switchDemoUser: (name: string) => void;
  signOut: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  loading: true,
  isDemo: true,
  switchDemoUser: () => {},
  signOut: async () => {},
});

const LS_KEY = "dbl:user";

export function UserProvider({ children }: { children: ReactNode }) {
  const sb = getSupabase();
  const isDemo = !sb;
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sb) {
      // デモモード: 保存済みユーザー or 先頭メンバー
      let name: string | null = null;
      try {
        name = localStorage.getItem(LS_KEY);
      } catch {}
      const member = DEMO_TEAM.find((m) => m.name === name) ?? DEMO_TEAM[0];
      // SSRではlocalStorageに触れないため、マウント後にユーザーを復元する
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser({
        id: member.id,
        name: member.name,
        email: member.email,
        role: member.role,
        color: member.color,
      });
      setLoading(false);
      return;
    }

    // Supabase Auth
    type SessionUser = {
      id: string;
      email?: string;
      user_metadata?: { name?: string; role?: string };
    };
    const toUser = (u: SessionUser): CurrentUser => ({
      id: u.id,
      name: u.user_metadata?.name ?? u.email?.split("@")[0] ?? "ユーザー",
      email: u.email ?? "",
      role: u.user_metadata?.role ?? "メンバー",
      color: colorFromString(u.email ?? u.id),
    });

    // ログインユーザーを profiles テーブルに1度だけ登録する（メンバー一覧に反映）。
    // 既存行があれば ignoreDuplicates で上書きしない。
    const ensureProfile = async (u: SessionUser) => {
      const cu = toUser(u);
      try {
        await sb
          .from("profiles")
          .upsert(
            {
              id: u.id,
              name: cu.name,
              email: cu.email,
              role: cu.role,
              department: "",
              color: cu.color,
            },
            { onConflict: "id", ignoreDuplicates: true }
          );
      } catch {
        // profiles未整備でも致命的ではないため無視
      }
    };

    sb.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (s) {
        setUser(toUser(s.user as SessionUser));
        ensureProfile(s.user as SessionUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser(toUser(session.user as SessionUser));
        ensureProfile(session.user as SessionUser);
      } else {
        setUser(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  const switchDemoUser = useCallback((name: string) => {
    const member = DEMO_TEAM.find((m) => m.name === name);
    if (!member) return;
    try {
      localStorage.setItem(LS_KEY, name);
    } catch {}
    setUser({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      color: member.color,
    });
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabase();
    if (client) await client.auth.signOut();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, isDemo, switchDemoUser, signOut }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
