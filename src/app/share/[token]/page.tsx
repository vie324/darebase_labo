"use client";

// =============================================================
// 紹介状況の共有ページ /share/[token]（ログイン不要・閲覧専用）
//
// 紹介元（銀行 / 1次代理店・2次代理店）のご担当者が、紹介した顧客の進捗を
// 確認するページ。表はそのまま CSV で持ち帰れ、Google スプレッドシートなら
// IMPORTDATA で自動更新もできる（/api/share/[token]/csv）。
//  - Supabase接続時: RPC get_client_share が「公開してよい項目だけ」を返す（0015）。
//    テーブルへの匿名アクセスは無い（0009 の公開予約リンクと同じ方式）
//  - デモモード: localStorage から同じ判定・同じ形で組み立てる（lib/client-share.ts）
// =============================================================

import { use, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
} from "lucide-react";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { readDemoTable, writeDemoTable } from "@/lib/use-collection";
import { normalizeUnitSlug, UNIT_TERMS } from "@/lib/business-units";
import {
  buildDemoSharePayload,
  CLIENT_STATUS_KEYS,
  CLIENT_STATUSES,
  countByStatus,
  formatExpiry,
  parseSharePayload,
  shareCsvRows,
  toClientRows,
  type ClientStatusKey,
  type SharePayload,
  type ShareResult,
} from "@/lib/client-share";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn, formatDate, formatDateTime, toDateStr } from "@/lib/utils";
import { Badge, Button, SearchInput } from "@/components/ui";
import { Logo } from "@/components/brand/logo";

async function loadShare(token: string): Promise<ShareResult> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.rpc("get_client_share", { p_token: token });
    if (error) return { ok: false, error: "unavailable" };
    return parseSharePayload(data);
  }
  // デモモード: 本番の関数と同じく、トークンで許された範囲だけを組み立てる
  const now = new Date();
  const shares = readDemoTable("client_shares");
  const result = buildDemoSharePayload(
    token,
    {
      shares,
      banks: readDemoTable("banks"),
      units: readDemoTable("business_units"),
      appointments: readDemoTable("appointments"),
      deals: readDemoTable("deals"),
      dealProducts: readDemoTable("deal_products"),
      branches: readDemoTable("branches"),
      events: readDemoTable("events"),
    },
    now
  );
  if (result.ok) {
    // 閲覧を記録する（発行側の画面の「最終閲覧」に出る）
    writeDemoTable(
      "client_shares",
      shares.map((s) =>
        s.token === token
          ? { ...s, last_accessed_at: now.toISOString(), access_count: s.access_count + 1 }
          : s
      )
    );
  }
  return result;
}

export default function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [result, setResult] = useState<ShareResult | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await loadShare(token);
      if (active) setResult(r);
    })();
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-cyan-50 via-white to-sky-50 dark:from-slate-950 dark:via-slate-950 dark:to-cyan-950/40">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Logo variant="inline" />
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
          紹介状況のご共有
        </span>
      </header>

      <main className="flex flex-1 justify-center p-4 sm:p-6">
        <div className="w-full max-w-6xl">
          {result === null ? (
            <MessageCard icon={<Loader2 className="h-8 w-8 animate-spin text-cyan-500" />}>
              読み込み中…
            </MessageCard>
          ) : result.ok ? (
            <ShareView data={result.data} token={token} />
          ) : (
            <MessageCard icon={<AlertCircle className="h-8 w-8 text-amber-500" />}>
              <p className="font-bold text-slate-700 dark:text-slate-200">
                {result.error === "expired"
                  ? "このリンクは有効期限が切れています"
                  : result.error === "not_found"
                    ? "このリンクは無効です"
                    : "読み込めませんでした"}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {result.error === "unavailable"
                  ? "時間をおいて再度お試しください。"
                  : "お手数ですが、リンクをお送りした担当者にお問い合わせください。"}
              </p>
            </MessageCard>
          )}
        </div>
      </main>

      <footer className="px-5 py-6 text-center text-xs text-slate-400 dark:text-slate-600">
        Powered by DARE BASE LABO
      </footer>
    </div>
  );
}

function MessageCard({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card mx-auto flex max-w-md animate-fade-up flex-col items-center gap-3 p-10 text-center">
      {icon}
      <div className="text-sm text-slate-500 dark:text-slate-400">{children}</div>
    </div>
  );
}

// ---------- 本体 ----------

function ShareView({ data, token }: { data: SharePayload; token: string }) {
  const terms = UNIT_TERMS[normalizeUnitSlug(data.unit)];
  const rows = useMemo(() => toClientRows(data.rows), [data.rows]);
  const counts = countByStatus(rows);
  const [status, setStatus] = useState<ClientStatusKey | "all">("all");
  const [query, setQuery] = useState("");

  // 窓口で絞ったリンクなら窓口の列は要らない（全行同じになる）
  const showChannel = !data.channel;
  const q = query.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!q || `${r.company} ${r.channel} ${r.products}`.toLowerCase().includes(q))
  );

  const download = () => {
    const { headers, body } = shareCsvRows(filtered, terms.child);
    const stamp = toDateStr(new Date()).replace(/-/g, "");
    // ファイル名は英数字だけにする（日本語名はブラウザによって "download" に化ける）
    downloadCsv(`darebase_referrals_${stamp}.csv`, toCsv(headers, body));
  };

  return (
    <div className="animate-fade-up space-y-5">
      {/* 見出し */}
      <div className="card p-5 sm:p-7">
        <h1 className="text-xl font-bold text-slate-800 sm:text-2xl dark:text-slate-100">
          {data.title || "ご紹介案件の進捗"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {data.source}
          {data.channel && ` ${data.channel}`} 様からご紹介いただいた企業の進捗です。
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          {formatDateTime(data.generated_at)} 時点の情報です（開くたびに最新になります）
        </p>

        {/* ステータス別の件数（押すと絞り込み） */}
        <div className="mt-5 flex flex-wrap gap-2">
          <StatusChip
            label="すべて"
            count={rows.length}
            active={status === "all"}
            onClick={() => setStatus("all")}
          />
          {CLIENT_STATUS_KEYS.filter((k) => counts[k] > 0).map((k) => (
            <StatusChip
              key={k}
              label={CLIENT_STATUSES[k].label}
              count={counts[k]}
              color={CLIENT_STATUSES[k].color}
              active={status === k}
              onClick={() => setStatus(status === k ? "all" : k)}
            />
          ))}
        </div>
      </div>

      {/* 操作 */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="企業名・商材で検索…"
          className="w-full sm:w-72"
        />
        <Button variant="secondary" size="sm" className="ml-auto" onClick={download}>
          <Download className="h-4 w-4" />
          CSVをダウンロード
        </Button>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <div className="card py-14 text-center text-sm text-slate-400">
          {rows.length === 0 ? "まだご紹介の記録がありません" : "条件に合う企業がありません"}
        </div>
      ) : (
        <>
          {/* PC: 表 */}
          <div className="card hidden overflow-hidden md:block">
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 whitespace-nowrap">紹介日</th>
                    <th className="px-4 py-3">企業名</th>
                    {showChannel && <th className="px-4 py-3 whitespace-nowrap">{terms.child}</th>}
                    <th className="px-4 py-3 whitespace-nowrap">商談日</th>
                    <th className="px-4 py-3">ステータス</th>
                    <th className="px-4 py-3">商材</th>
                    <th className="px-4 py-3 whitespace-nowrap">担当</th>
                    <th className="px-4 py-3 whitespace-nowrap">更新</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filtered.map((r, i) => (
                    <tr key={`${r.referred_on}-${r.company}-${i}`}>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {r.referred_on ? formatDate(r.referred_on) : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.company}</td>
                      {showChannel && (
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {r.channel || "—"}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 tabular-nums dark:text-slate-400">
                        {r.meeting_at ? formatDateTime(r.meeting_at) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={CLIENT_STATUSES[r.status].color}>
                          {CLIENT_STATUSES[r.status].label}
                        </Badge>
                        {r.progress && (
                          <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400">
                            {r.progress}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        {r.products || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.owner || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-400 tabular-nums">
                        {r.updated_at ? formatDate(r.updated_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* スマホ: カード */}
          <ul className="space-y-2 md:hidden">
            {filtered.map((r, i) => (
              <li key={`${r.referred_on}-${r.company}-${i}`} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold">{r.company}</p>
                  <Badge className={CLIENT_STATUSES[r.status].color}>
                    {CLIENT_STATUSES[r.status].label}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  紹介 {r.referred_on ? formatDate(r.referred_on) : "—"}
                  {showChannel && r.channel && ` ・ ${r.channel}`}
                  {r.meeting_at && ` ・ 商談 ${formatDateTime(r.meeting_at)}`}
                </p>
                {(r.progress || r.products || r.owner) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {[r.progress, r.products, r.owner && `担当 ${r.owner}`]
                      .filter(Boolean)
                      .join(" ・ ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <SheetGuide token={token} />

      <p className="flex items-start justify-center gap-1.5 text-center text-[11px] leading-relaxed text-slate-400">
        <Lock className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          このページはリンクを知っている方だけが閲覧できます。社外への転送はお控えください。
          {data.expires_at && ` 有効期限: ${formatExpiry(data.expires_at)}`}
        </span>
      </p>
    </div>
  );
}

function StatusChip({
  label,
  count,
  color,
  active,
  onClick,
}: {
  label: string;
  count: number;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all",
        active
          ? "border-cyan-400 ring-2 ring-cyan-400/30 dark:border-cyan-500/60"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600",
        color ?? "bg-white text-slate-700 dark:bg-slate-900 dark:text-slate-200"
      )}
    >
      {label}
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

/** Google スプレッドシートで自動更新する方法（IMPORTDATA） */
function SheetGuide({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const live = isSupabaseConfigured();
  const formula = `=IMPORTDATA("${typeof window !== "undefined" ? window.location.origin : ""}/api/share/${token}/csv")`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formula);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では、表示された式を手で選んでもらう
    }
  };

  return (
    <details className="card group p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-200">
        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
        Googleスプレッドシートで自動更新する
        <span className="ml-auto text-xs font-normal text-slate-400 group-open:hidden">開く</span>
      </summary>
      {live ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <p>
            新しいシートの A1 セルに次の式を貼り付けると、この一覧が取り込まれ、以後は自動で更新されます
            （更新の間隔は Google の仕様でおおむね1時間ごとです）。
          </p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
              {formula}
            </code>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "コピーしました" : "コピー"}
            </Button>
          </div>
          <p className="text-xs text-slate-400">
            取り込んだシートも、このリンクと同じく社外への共有はお控えください。
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-400">
          デモモードでは使えません（本番環境で、この一覧を自動でスプレッドシートに取り込めます）。
        </p>
      )}
    </details>
  );
}
