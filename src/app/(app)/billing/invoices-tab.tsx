"use client";

// 請求書タブ — フィルタ付き一覧

import { useMemo, useState } from "react";
import { Plus, ReceiptText } from "lucide-react";
import { cn, formatDate, formatYen } from "@/lib/utils";
import type { Invoice, InvoiceDirection, InvoiceStatus, Partner } from "@/lib/types";
import { INVOICE_DIRECTIONS, INVOICE_SOURCES, INVOICE_STATUSES } from "@/lib/constants";
import { Badge, Button, EmptyState, SearchInput, Select, Skeleton } from "@/components/ui";
import { invoicePartnerLabel, isOverdue, overdueDays, statusLabel } from "./shared";

const STATUS_KEYS = Object.keys(INVOICE_STATUSES) as InvoiceStatus[];

export function InvoicesTab({
  invoices,
  partners,
  today,
  loading,
  onOpenDetail,
  onCreate,
}: {
  invoices: Invoice[];
  partners: Partner[];
  today: string;
  loading: boolean;
  onOpenDetail: (inv: Invoice) => void;
  onCreate: (direction: InvoiceDirection) => void;
}) {
  const [direction, setDirection] = useState<"all" | InvoiceDirection>("all");
  const [status, setStatus] = useState<"all" | InvoiceStatus>("all");
  const [month, setMonth] = useState("all");
  const [partnerId, setPartnerId] = useState("all");
  const [query, setQuery] = useState("");

  // 発行月の選択肢（データに存在する月のみ・新しい順）
  const months = useMemo(() => {
    const set = new Set(
      invoices.map((i) => i.issue_date.slice(0, 7)).filter((m) => m.length === 7)
    );
    return Array.from(set).sort().reverse();
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        if (direction !== "all" && inv.direction !== direction) return false;
        if (status !== "all" && inv.status !== status) return false;
        if (month !== "all" && inv.issue_date.slice(0, 7) !== month) return false;
        if (partnerId !== "all" && inv.partner_id !== partnerId) return false;
        if (q) {
          const label = invoicePartnerLabel(inv, partners).toLowerCase();
          if (
            !inv.title.toLowerCase().includes(q) &&
            !label.includes(q) &&
            !inv.invoice_number.toLowerCase().includes(q)
          )
            return false;
        }
        return true;
      })
      .sort((a, b) => (a.issue_date < b.issue_date ? 1 : -1));
  }, [invoices, partners, direction, status, month, partnerId, query]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* フィルタバー */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={direction}
          onChange={(e) => setDirection(e.target.value as "all" | InvoiceDirection)}
          className="w-auto"
        >
          <option value="all">入金・支払すべて</option>
          <option value="receivable">{INVOICE_DIRECTIONS.receivable.label}</option>
          <option value="payable">{INVOICE_DIRECTIONS.payable.label}</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as "all" | InvoiceStatus)}
          className="w-auto"
        >
          <option value="all">全ステータス</option>
          {STATUS_KEYS.map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUSES[s].label}
            </option>
          ))}
        </Select>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto">
          <option value="all">全期間</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {m.replace("-", "年")}月
            </option>
          ))}
        </Select>
        <Select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="w-auto">
          <option value="all">全取引先</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="件名・取引先・番号で検索"
          className="min-w-52 flex-1"
        />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onCreate("payable")}>
            <Plus className="h-4 w-4" />
            受領を登録
          </Button>
          <Button size="sm" onClick={() => onCreate("receivable")}>
            <Plus className="h-4 w-4" />
            請求書を作成
          </Button>
        </div>
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-10 w-10" />}
          title="該当する請求書がありません"
          description="フィルタ条件を変更するか、右上のボタンから登録してください"
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3 font-semibold">発行/受領日</th>
                <th className="px-4 py-3 font-semibold">区分</th>
                <th className="px-4 py-3 font-semibold">取引先 / 件名</th>
                <th className="px-4 py-3 text-right font-semibold">金額（税込）</th>
                <th className="px-4 py-3 font-semibold">支払期日</th>
                <th className="px-4 py-3 font-semibold">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => {
                const overdue = isOverdue(inv, today);
                return (
                  <tr
                    key={inv.id}
                    onClick={() => onOpenDetail(inv)}
                    className="cursor-pointer border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/70 dark:border-slate-800/60 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {inv.issue_date ? formatDate(inv.issue_date) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={INVOICE_DIRECTIONS[inv.direction].color}>
                        {inv.direction === "receivable" ? "入金" : "支払"}
                      </Badge>
                    </td>
                    <td className="max-w-64 px-4 py-3">
                      <p className="truncate font-medium">{invoicePartnerLabel(inv, partners)}</p>
                      <p className="truncate text-xs text-slate-400">
                        {inv.title}
                        {inv.source !== "manual" && (
                          <span
                            className={cn(
                              "ml-1.5 rounded px-1 py-px text-[10px] font-semibold",
                              INVOICE_SOURCES[inv.source].color
                            )}
                          >
                            {INVOICE_SOURCES[inv.source].label}
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tracking-tight">
                      {formatYen(inv.total)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {inv.due_date ? (
                        <span className={cn(overdue && "font-semibold text-rose-600 dark:text-rose-400")}>
                          {formatDate(inv.due_date)}
                          {overdue && (
                            <span className="ml-1 text-[11px]">
                              +{overdueDays(inv, today)}日
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={INVOICE_STATUSES[inv.status].color}>
                        {statusLabel(inv)}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-right text-xs text-slate-400">
        {filtered.length}件 ・ 合計 {formatYen(filtered.reduce((s, i) => s + i.total, 0))}
      </p>
    </div>
  );
}
