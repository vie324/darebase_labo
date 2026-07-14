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

export interface CurrentUser {
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
      setUser({
        name: member.name,
        email: member.email,
        role: member.role,
        color: member.color,
      });
      setLoading(false);
      return;
    }

    // Supabase Auth
    let unsub: (() => void) | undefined;
    sb.auth.getSession().then(({ data }) => {
      const s = data.session;
      setUser(
        s
          ? {
              name:
                (s.user.user_metadata?.name as string) ??
                s.user.email?.split("@")[0] ??
                "ユーザー",
              email: s.user.email ?? "",
              role: (s.user.user_metadata?.role as string) ?? "メンバー",
              color: "indigo",
            }
          : null
      );
      setLoading(false);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      setUser(
        session
          ? {
              name:
                (session.user.user_metadata?.name as string) ??
                session.user.email?.split("@")[0] ??
                "ユーザー",
              email: session.user.email ?? "",
              role: (session.user.user_metadata?.role as string) ?? "メンバー",
              color: "indigo",
            }
          : null
      );
    });
    unsub = () => sub.subscription.unsubscribe();
    return unsub;
  }, [sb]);

  const switchDemoUser = useCallback((name: string) => {
    const member = DEMO_TEAM.find((m) => m.name === name);
    if (!member) return;
    try {
      localStorage.setItem(LS_KEY, name);
    } catch {}
    setUser({
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
