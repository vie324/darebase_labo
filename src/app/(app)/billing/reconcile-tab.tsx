"use client";

// 入金消込タブ — 未消込の請求書に入金/支払を記録して突き合わせる

import { useMemo, useState, type FormEvent } from "react";
import { CircleCheck, HandCoins, Undo2 } from "lucide-react";
import { cn, formatDate, formatYen } from "@/lib/utils";
import type { Invoice, InvoiceDirection, InvoicePayment, Partner } from "@/lib/types";
import { Badge, Button, EmptyState, Field, Input, Modal, Select, Skeleton, Tabs, Textarea } from "@/components/ui";
import {
  invoicePartnerLabel,
  isOpenInvoice,
  isOverdue,
  openBalance,
  overdueDays,
} from "./shared";

export interface PaymentEntry {
  amount: number;
  paid_on: string;
  method: string;
  memo: string;
}

const METHODS = ["振込", "現金", "相殺", "その他"];

export function ReconcileTab({
  invoices,
  payments,
  partners,
  today,
  loading,
  onRecordPayment,
  onDeletePayment,
  onOpenDetail,
}: {
  invoices: Invoice[];
  payments: InvoicePayment[];
  partners: Partner[];
  today: string;
  loading: boolean;
  onRecordPayment: (inv: Invoice, entry: PaymentEntry) => Promise<void>;
  onDeletePayment: (payment: InvoicePayment) => Promise<void>;
  onOpenDetail: (inv: Invoice) => void;
}) {
  const [direction, setDirection] = useState<InvoiceDirection>("receivable");
  const [target, setTarget] = useState<Invoice | null>(null);

  const open = useMemo(
    () =>
      invoices
        .filter((i) => i.direction === direction && isOpenInvoice(i) && openBalance(i) > 0)
        .sort((a, b) => {
          // 期限超過を先頭に、その後は期日の近い順（期日なしは最後）
          const ao = isOverdue(a, today) ? 0 : 1;
          const bo = isOverdue(b, today) ? 0 : 1;
          if (ao !== bo) return ao - bo;
          const ad = a.due_date || "9999-12-31";
          const bd = b.due_date || "9999-12-31";
          return ad < bd ? -1 : 1;
        }),
    [invoices, direction, today]
  );

  const recent = useMemo(
    () =>
      payments
        .slice()
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 8)
        .map((p) => ({ payment: p, invoice: invoices.find((i) => i.id === p.invoice_id) })),
    [payments, invoices]
  );

  const totalOpen = open.reduce((s, i) => s + openBalance(i), 0);
  const overdueOpen = open.filter((i) => isOverdue(i, today));

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { key: "receivable", label: "入金の消込", count: invoices.filter((i) => i.direction === "receivable" && isOpenInvoice(i) && openBalance(i) > 0).length },
            { key: "payable", label: "支払の消込", count: invoices.filter((i) => i.direction === "payable" && isOpenInvoice(i) && openBalance(i) > 0).length },
          ]}
          active={direction}
          onChange={setDirection}
        />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          未消込 <span className="font-bold text-slate-700 dark:text-slate-200">{formatYen(totalOpen)}</span>
          {overdueOpen.length > 0 && (
            <span className="ml-2 font-semibold text-rose-600 dark:text-rose-400">
              うち期限超過 {overdueOpen.length}件
            </span>
          )}
        </p>
      </div>

      {open.length === 0 ? (
        <EmptyState
          icon={<CircleCheck className="h-10 w-10" />}
          title="未消込の請求書はありません"
          description={direction === "receivable" ? "すべての入金が消し込まれています" : "すべての支払が消し込まれています"}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
                <th className="px-4 py-3 font-semibold">支払期日</th>
                <th className="px-4 py-3 font-semibold">取引先 / 件名</th>
                <th className="px-4 py-3 text-right font-semibold">請求額</th>
                <th className="px-4 py-3 text-right font-semibold">消込済</th>
                <th className="px-4 py-3 text-right font-semibold">残額</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {open.map((inv) => {
                const overdue = isOverdue(inv, today);
                const balance = openBalance(inv);
                return (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {inv.due_date ? (
                        <span className={cn(overdue && "font-semibold text-rose-600 dark:text-rose-400")}>
                          {formatDate(inv.due_date)}
                          {overdue && (
                            <Badge className="ml-1.5 bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                              +{overdueDays(inv, today)}日
                            </Badge>
                          )}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="max-w-64 px-4 py-3">
                      <button
                        onClick={() => onOpenDetail(inv)}
                        className="block max-w-full cursor-pointer text-left"
                      >
                        <p className="truncate font-medium hover:underline">
                          {invoicePartnerLabel(inv, partners)}
                        </p>
                        <p className="truncate text-xs text-slate-400">{inv.title}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatYen(inv.total)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-400">
                      {inv.paid_amount > 0 ? formatYen(inv.paid_amount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold whitespace-nowrap tracking-tight">
                      {formatYen(balance)}
                      {inv.paid_amount > 0 && (
                        <Badge className="ml-1.5 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                          一部入金
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="secondary" onClick={() => setTarget(inv)}>
                        <HandCoins className="h-4 w-4" />
                        消込
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 最近の消込履歴 */}
      {recent.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wider text-slate-400">最近の消込</p>
          <div className="card divide-y divide-slate-50 dark:divide-slate-800/60">
            {recent.map(({ payment, invoice }) => (
              <div key={payment.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="whitespace-nowrap text-slate-400">{formatDate(payment.paid_on)}</span>
                <span className="min-w-0 flex-1 truncate">
                  {invoice ? invoicePartnerLabel(invoice, partners) : "（削除済みの請求書）"}
                  <span className="ml-1.5 text-xs text-slate-400">{invoice?.title}</span>
                </span>
                <span className="font-semibold whitespace-nowrap">{formatYen(payment.amount)}</span>
                <button
                  onClick={() => {
                    if (confirm("この消込を取り消しますか？請求書の残額に戻ります。")) {
                      onDeletePayment(payment);
                    }
                  }}
                  title="消込を取り消す"
                  className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                >
                  <Undo2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {target && (
        <PaymentModal
          invoice={target}
          partners={partners}
          today={today}
          onClose={() => setTarget(null)}
          onSubmit={async (entry) => {
            await onRecordPayment(target, entry);
            setTarget(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// 消込入力モーダル
// =============================================================
function PaymentModal({
  invoice,
  partners,
  today,
  onClose,
  onSubmit,
}: {
  invoice: Invoice;
  partners: Partner[];
  today: string;
  onClose: () => void;
  onSubmit: (entry: PaymentEntry) => Promise<void>;
}) {
  const balance = openBalance(invoice);
  const [amount, setAmount] = useState(balance);
  const [paidOn, setPaidOn] = useState(today);
  const [method, setMethod] = useState(METHODS[0]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = amount > 0 && paidOn !== "";
  const fully = amount >= balance;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({ amount, paid_on: paidOn, method, memo: memo.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={invoice.direction === "receivable" ? "入金を記録（消込）" : "支払を記録（消込）"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800/50">
          <p className="font-semibold">{invoicePartnerLabel(invoice, partners)}</p>
          <p className="text-xs text-slate-400">{invoice.title}</p>
          <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>請求額 {formatYen(invoice.total)}</span>
            <span>
              残額 <span className="font-bold text-slate-700 dark:text-slate-200">{formatYen(balance)}</span>
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={invoice.direction === "receivable" ? "入金額（円）" : "支払額（円）"} required>
            <Input
              type="number"
              min={1}
              value={amount === 0 ? "" : amount}
              onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              required
            />
            {amount > 0 && !fully && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                一部消込になります（残り {formatYen(balance - amount)}）
              </p>
            )}
            {amount > balance && (
              <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">
                残額より大きい金額です（過入金として記録されます）
              </p>
            )}
          </Field>
          <Field label={invoice.direction === "receivable" ? "入金日" : "支払日"} required>
            <Input type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} required />
          </Field>
        </div>

        <Field label="方法">
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="メモ">
          <Textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            rows={2}
            placeholder="振込名義の相違など（任意）"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" variant="success" disabled={!valid || saving}>
            <HandCoins className="h-4 w-4" />
            {saving ? "記録中…" : fully ? "全額を消込" : "一部を消込"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
