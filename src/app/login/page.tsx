"use client";

// ログインページ（Supabase Auth 用）。
// デモモード（Supabase未接続）ではダッシュボードへ即リダイレクト。

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { APP_TAGLINE } from "@/lib/constants";
import { Button, Field, Input } from "@/components/ui";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setError("");
    setInfo("");
    try {
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
      } else {
        const { error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) throw error;
        setInfo("確認メールを送信しました。メール内のリンクから登録を完了してください。");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-4 dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950/40">
      <div className="card w-full max-w-md animate-fade-up p-8">
        <div className="mb-8 text-center">
          <div className="bg-brand-gradient mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Dare<span className="text-gradient">Base</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{APP_TAGLINE}</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <Field label="氏名" required>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="山田 太郎"
                required
              />
            </Field>
          )}
          <Field label="メールアドレス" required>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </Field>
          <Field label="パスワード" required>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8文字以上"
              minLength={8}
              required
            />
          </Field>

          {error && (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
              {info}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "処理中…" : mode === "signin" ? "ログイン" : "アカウント作成"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          {mode === "signin" ? "アカウントをお持ちでない方は" : "すでにアカウントをお持ちの方は"}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="ml-1 cursor-pointer font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {mode === "signin" ? "新規登録" : "ログイン"}
          </button>
        </p>
      </div>
    </div>
  );
}
