"use client";

// =============================================================
// クライアント共有 — 紹介元に、紹介いただいた顧客の進捗を共有リンクで公開する
//
// 紹介元（銀行 / 1次代理店・2次代理店）ごとに推測できない URL を発行し、
// ログインなしの閲覧専用ページ（/share/[token]）で進捗を見せる。
// スプレッドシートが欲しい相手には、同じ内容を CSV（ダウンロード /
// Google スプレッドシートの IMPORTDATA で自動更新）でも渡せる。
//
// データの正はこのシステムに1つだけ置き、相手に渡るのは公開してよい項目だけ
// （lib/client-share.ts・0015 の get_client_share）。リンクは停止・再発行・期限切れで
// いつでも閉じられる。発行・停止はマネージャー以上（client_share）。
// =============================================================

import { useMemo, useState } from "react";
import {
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Link2,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { useBusinessUnit } from "@/lib/use-business-unit";
import { filterByUnit } from "@/lib/business-units";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  collectShareRows,
  EXPIRY_OPTIONS,
  expiresAtFrom,
  formatExpiry,
  generateShareToken,
  SHARE_STATES,
  shareState,
} from "@/lib/client-share";
import { cn, timeAgo } from "@/lib/utils";
import type { ClientShare } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
} from "@/components/ui";
import { UnitSwitch } from "@/components/ui/unit-switch";
import { UnitMissing } from "@/components/ui/unit-missing";
import { RequireCapability } from "@/components/layout/require-capability";
import { useToast } from "@/components/ui/toast";
import { PUBLIC_FIELDS, ShareFormModal, ShareLinkModal, type ShareFormValues } from "./share-modals";

export default function SharesPage() {
  // 共有リンクの URL は鍵そのもの。本部の社員だけが一覧を見られる（RLS も同じ）
  return (
    <RequireCapability
      cap="all_sales_data"
      title="クライアント共有は本部のメンバーのみ利用できます"
    >
      <SharesContent />
    </RequireCapability>
  );
}

function SharesContent() {
  const { user } = useUser();
  const { can } = useAccess();
  const { toast } = useToast();
  const shares = useCollection("client_shares");
  const banks = useCollection("banks");
  const branches = useCollection("branches");
  // 公開される件数を確認するために、公開ページと同じ材料を読む
  const appointments = useCollection("appointments");
  const deals = useCollection("deals");
  const dealProducts = useCollection("deal_products");
  const events = useCollection("events");
  const { slug, unitId, defaultUnitId, terms, missing, setSlug, createUnit } = useBusinessUnit();

  const [form, setForm] = useState<{ initial: ClientShare | null } | null>(null);
  const [linkTarget, setLinkTarget] = useState<ClientShare | null>(null);

  // 公開ページと同じ材料。件数はデータが変わったときだけ数え直す（モーダルの開閉では数えない）
  const dataset = useMemo(
    () => ({
      appointments: appointments.items,
      deals: deals.items,
      dealProducts: dealProducts.items,
      branches: branches.items,
      events: events.items,
    }),
    [appointments.items, deals.items, dealProducts.items, branches.items, events.items]
  );
  const countOf = useMemo(() => {
    const at = new Date();
    return new Map(shares.items.map((s) => [s.id, collectShareRows(s, dataset, at).length]));
  }, [shares.items, dataset]);

  if (
    !user ||
    shares.loading ||
    banks.loading ||
    branches.loading ||
    appointments.loading ||
    deals.loading ||
    dealProducts.loading ||
    events.loading
  ) {
    return <PageSkeleton />;
  }

  const canManage = can("client_share");
  const live = isSupabaseConfigured();
  const now = new Date();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urlOf = (s: ClientShare) => `${origin}/share/${s.token}`;
  const csvUrlOf = (s: ClientShare) => `${origin}/api/share/${s.token}/csv`;

  const unitBanks = filterByUnit(banks.items, unitId, defaultUnitId);
  const unitBankIds = new Set(unitBanks.map((b) => b.id));
  const unitBranches = filterByUnit(branches.items, unitId, defaultUnitId).filter((b) =>
    unitBankIds.has(b.bank_id)
  );
  // 事業部は紹介元で決まる（business_unit_id が空の古い行も紹介元から判定できる）
  const unitShares = shares.items
    .filter((s) => unitBankIds.has(s.bank_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const bankNameOf = (id: string) => banks.items.find((b) => b.id === id)?.name ?? "（削除された紹介元）";
  const branchNameOf = (id: string | null) =>
    id ? (branches.items.find((b) => b.id === id)?.name ?? "") : "";

  const previewRows = (bankId: string, branchId: string) =>
    collectShareRows({ bank_id: bankId, branch_id: branchId || null }, dataset, now);

  // ---------- 操作 ----------

  const copyLink = async (s: ClientShare) => {
    try {
      await navigator.clipboard.writeText(urlOf(s));
      toast("共有リンクをコピーしました", "success");
    } catch {
      setLinkTarget(s);
    }
  };

  const save = async (values: ShareFormValues) => {
    const nowIso = new Date().toISOString();
    const days = EXPIRY_OPTIONS.find((o) => o.key === values.expiry)?.days;
    if (form?.initial) {
      await shares.update(form.initial.id, {
        title: values.title,
        note: values.note,
        is_active: values.is_active,
        ...(values.expiry === "keep" || days === undefined
          ? {}
          : { expires_at: expiresAtFrom(days, new Date()) }),
        updated_at: nowIso,
      });
      toast("共有リンクを更新しました", "success");
      setForm(null);
      return;
    }
    const bank = banks.items.find((b) => b.id === values.bank_id);
    const created = await shares.add({
      token: generateShareToken(),
      title: values.title,
      bank_id: values.bank_id,
      branch_id: values.branch_id || null,
      business_unit_id: bank?.business_unit_id ?? unitId ?? defaultUnitId,
      expires_at: expiresAtFrom(days ?? null, new Date()),
      is_active: true,
      note: values.note,
      created_by: user.name,
      owner_id: user.id,
      last_accessed_at: null,
      access_count: 0,
      updated_at: nowIso,
    });
    setForm(null);
    // 発行したらすぐ送れるよう、送り方の画面を開く
    setLinkTarget(created);
  };

  /** 一覧からの操作。失敗したら黙らずに知らせる（停止できていないのに止めたつもりにならないように） */
  const attempt = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch {
      toast("操作できませんでした。時間をおいて再度お試しください", "error");
    }
  };

  const toggleActive = (s: ClientShare) =>
    attempt(async () => {
      await shares.update(s.id, { is_active: !s.is_active, updated_at: new Date().toISOString() });
      toast(s.is_active ? "共有を停止しました" : "共有を再開しました", "info");
    });

  const regenerate = async (s: ClientShare) => {
    if (
      !confirm(
        `「${s.title}」の URL を再発行しますか？\n今の URL（スプレッドシートの自動取得を含む）は開けなくなります。`
      )
    ) {
      return;
    }
    await attempt(async () => {
      const token = generateShareToken();
      await shares.update(s.id, { token, updated_at: new Date().toISOString() });
      toast("新しい URL を発行しました。相手に送り直してください", "success");
      setLinkTarget({ ...s, token });
    });
  };

  const remove = async (s: ClientShare) => {
    if (!confirm(`「${s.title}」を削除しますか？\nこの URL は開けなくなります。`)) return;
    await attempt(async () => {
      await shares.remove(s.id);
      toast("共有リンクを削除しました", "info");
    });
  };

  return (
    <div>
      <PageHeader
        title="クライアント共有"
        description={`${terms.parent}・${terms.child}に、紹介いただいた顧客の進捗を共有する`}
        icon={<Share2 className="h-5 w-5" />}
        actions={
          canManage && !missing ? (
            <Button size="sm" onClick={() => setForm({ initial: null })} disabled={unitBanks.length === 0}>
              <Plus className="h-4 w-4" />
              共有リンクを発行
            </Button>
          ) : undefined
        }
      />

      <UnitSwitch slug={slug} onChange={setSlug} className="mb-5 w-full sm:w-auto" />

      {missing ? (
        <UnitMissing slug={slug} canCreate={can("master_add")} onCreate={createUnit} />
      ) : (
        <>
          {/* しくみの説明（おすすめの共有方法） */}
          <Card className="mb-5 p-5">
            <p className="flex items-center gap-2 text-sm font-bold">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              共有のしかた
            </p>
            <ol className="mt-3 grid gap-3 text-xs leading-relaxed text-slate-500 sm:grid-cols-3 dark:text-slate-400">
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <b className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Link2 className="h-3.5 w-3.5 text-cyan-500" />
                  1. リンクを送る
                </b>
                ログイン不要・閲覧専用のページ。開くたびに最新の状態が見え、CSV でも保存できます。
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <b className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
                  2. スプレッドシートで自動更新
                </b>
                Google スプレッドシートに式を1つ貼るだけで、一覧が自動で取り込まれ続けます。
              </li>
              <li className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <b className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <Pause className="h-3.5 w-3.5 text-amber-500" />
                  3. いつでも止められる
                </b>
                停止・URL の再発行・有効期限で、送ったリンクをこちらから閉じられます。
              </li>
            </ol>
            <p className="mt-3 text-[11px] text-slate-400">
              公開されるのは {PUBLIC_FIELDS} だけです。金額・メモ・確度・先方担当者などの社内情報は出ません。
            </p>
          </Card>

          {unitShares.length === 0 ? (
            <EmptyState
              icon={<Share2 className="h-10 w-10" />}
              title="まだ共有リンクがありません"
              description={
                canManage
                  ? `${terms.parent}ごとにリンクを発行して、紹介いただいた顧客の進捗を共有しましょう`
                  : "発行はマネージャー以上のメンバーが行えます"
              }
              action={
                canManage && unitBanks.length > 0 ? (
                  <Button onClick={() => setForm({ initial: null })}>
                    <Plus className="h-4 w-4" />
                    共有リンクを発行
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {unitShares.map((s) => {
                const state = shareState(s, now);
                const count = countOf.get(s.id) ?? 0;
                const branchName = branchNameOf(s.branch_id);
                return (
                  <Card key={s.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={SHARE_STATES[state].color}>
                            {SHARE_STATES[state].label}
                          </Badge>
                          <p className="min-w-0 truncate font-semibold">{s.title}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {bankNameOf(s.bank_id)}
                          {branchName ? ` ・ ${branchName}のみ` : `（すべての${terms.child}）`}
                          <span className="mx-1.5 text-slate-300 dark:text-slate-600">|</span>
                          公開中の紹介 <b className="tabular-nums">{count}</b>件
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {s.expires_at ? `${formatExpiry(s.expires_at)}まで` : "無期限"}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {s.last_accessed_at
                              ? `最終閲覧 ${timeAgo(s.last_accessed_at)}（${s.access_count}回）`
                              : "まだ開かれていません"}
                          </span>
                          {s.created_by && <span>発行 {s.created_by}</span>}
                        </p>
                        {s.note && (
                          <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
                            {s.note}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => copyLink(s)}
                          disabled={state !== "active"}
                        >
                          <Copy className="h-4 w-4" />
                          リンクをコピー
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setLinkTarget(s)}>
                          <FileSpreadsheet className="h-4 w-4" />
                          送り方
                        </Button>
                        <a
                          href={urlOf(s)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 sm:h-8 dark:text-slate-300 dark:hover:bg-slate-800",
                            state !== "active" && "pointer-events-none opacity-50"
                          )}
                        >
                          <ExternalLink className="h-4 w-4" />
                          開く
                        </a>
                        {canManage && (
                          <>
                            <IconButton label="編集" onClick={() => setForm({ initial: s })}>
                              <Pencil className="h-4 w-4" />
                            </IconButton>
                            <IconButton
                              label={s.is_active ? "停止" : "再開"}
                              onClick={() => toggleActive(s)}
                            >
                              {s.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </IconButton>
                            <IconButton label="URL を再発行" onClick={() => regenerate(s)}>
                              <RefreshCw className="h-4 w-4" />
                            </IconButton>
                            <IconButton label="削除" onClick={() => remove(s)} danger>
                              <Trash2 className="h-4 w-4" />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {form && (
        <ShareFormModal
          key={form.initial?.id ?? "new"}
          initial={form.initial}
          banks={unitBanks.filter((b) => b.is_active || b.id === form.initial?.bank_id)}
          branches={unitBranches}
          terms={terms}
          previewRows={previewRows}
          onClose={() => setForm(null)}
          onSubmit={save}
        />
      )}
      {linkTarget && (
        <ShareLinkModal
          key={linkTarget.id + linkTarget.token}
          share={linkTarget}
          url={urlOf(linkTarget)}
          csvUrl={csvUrlOf(linkTarget)}
          live={live}
          onClose={() => setLinkTarget(null)}
        />
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "cursor-pointer rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800",
        danger ? "hover:text-rose-500" : "hover:text-slate-600 dark:hover:text-slate-200"
      )}
    >
      {children}
    </button>
  );
}
