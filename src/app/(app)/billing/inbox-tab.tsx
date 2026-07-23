"use client";

// 受領ボックス — LINE自動取込・手動登録された「受領」ステータスの請求書を確認する場所

import { Inbox, MessageCircle, Plus } from "lucide-react";
import { formatDate, timeAgo } from "@/lib/utils";
import type { Invoice, LineGroup, Partner } from "@/lib/types";
import { INVOICE_SOURCES } from "@/lib/constants";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { InvoiceFileView } from "./invoice-modals";
import { invoicePartnerLabel } from "./shared";

export function InboxTab({
  invoices,
  partners,
  lineGroups,
  isDemo,
  loading,
  onConfirm,
  onCreateReceived,
  onSimulateLine,
}: {
  invoices: Invoice[];
  partners: Partner[];
  lineGroups: LineGroup[];
  isDemo: boolean;
  loading: boolean;
  /** 「確認して登録」— フォームを開いて内容を確定させる */
  onConfirm: (inv: Invoice) => void;
  /** 手動で受領請求書を登録 */
  onCreateReceived: () => void;
  /** デモ専用: LINE受信をシミュレート */
  onSimulateLine: () => void;
}) {
  const inbox = invoices
    .filter((i) => i.status === "received")
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const groupName = (groupId: string) =>
    lineGroups.find((g) => g.group_id === groupId)?.group_name ?? "";

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          LINEグループや手動登録で受領した請求書を確認し、金額・期日を確定します。
        </p>
        <div className="flex gap-2">
          {isDemo && (
            <Button size="sm" variant="secondary" onClick={onSimulateLine}>
              <MessageCircle className="h-4 w-4" />
              LINE受信をシミュレート
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onCreateReceived}>
            <Plus className="h-4 w-4" />
            受領を手動登録
          </Button>
        </div>
      </div>

      {isDemo && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          デモモードのため実際のLINE受信は行われません。Supabase接続 + LINE公式アカウント設定後は、
          三者グループに届いた請求書（画像・PDF）がここへ自動で取り込まれます。
        </p>
      )}

      {inbox.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-10 w-10" />}
          title="未確認の受領請求書はありません"
          description="LINEグループに届いた請求書は自動でここに入ります"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {inbox.map((inv) => {
            const src = INVOICE_SOURCES[inv.source];
            const gname = inv.line_group_id ? groupName(inv.line_group_id) : "";
            return (
              <Card key={inv.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <Badge className={src.color}>{src.label}</Badge>
                  <span className="text-xs text-slate-400">{timeAgo(inv.created_at)}</span>
                </div>
                {inv.file_url ? (
                  <InvoiceFileView fileRef={inv.file_url} fileType={inv.file_type} className="max-h-40" />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400 dark:bg-slate-800/50">
                    添付ファイルなし
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{inv.title || "（件名未設定）"}</p>
                  <p className="truncate text-xs text-slate-400">
                    {invoicePartnerLabel(inv, partners)}
                    {gname && ` ・ ${gname}`}
                  </p>
                  {inv.issue_date && (
                    <p className="mt-0.5 text-xs text-slate-400">受領日: {formatDate(inv.issue_date)}</p>
                  )}
                </div>
                <Button size="sm" className="mt-auto" onClick={() => onConfirm(inv)}>
                  確認して登録
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
