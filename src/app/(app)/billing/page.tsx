"use client";

// =============================================================
// 請求・支払 — 受領ボックス / 請求書 / 入金消込 / 明細計算 / マスタ
// 全コレクションをこのページで束ね、各タブへ渡す（状態の一貫性のため）
// =============================================================

import { useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { PageHeader, Tabs } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { todayStr, uid } from "@/lib/utils";
import type { Invoice, InvoiceDirection, InvoicePayment, InvoiceStatus } from "@/lib/types";
import { InboxTab } from "./inbox-tab";
import { InvoicesTab } from "./invoices-tab";
import { ReconcileTab } from "./reconcile-tab";
import { StatementsTab } from "./statements-tab";
import { MastersTab } from "./masters-tab";
import { InvoiceDetailModal, InvoiceFormModal } from "./invoice-modals";
import { fetchLineStatus, pushInvoiceToLine } from "./line-client";
import { isOverdue, type InvoiceFormValues } from "./shared";
import type { PaymentEntry } from "./reconcile-tab";

type TabKey = "inbox" | "invoices" | "reconcile" | "statements" | "masters";

export default function BillingPage() {
  const { user, isDemo } = useUser();
  const { toast } = useToast();

  const invoices = useCollection("invoices", { realtime: true });
  const payments = useCollection("invoice_payments");
  const partners = useCollection("partners");
  const rates = useCollection("commission_rates");
  const statements = useCollection("maker_statements");
  const statementLines = useCollection("statement_lines");
  const lineGroups = useCollection("line_groups", { realtime: true });

  const [tab, setTab] = useState<TabKey>("inbox");
  const [formState, setFormState] = useState<{
    initial: Invoice | null;
    defaultDirection: InvoiceDirection;
  } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lineConfigured, setLineConfigured] = useState(false);

  const today = todayStr();
  const loading = invoices.loading || partners.loading;

  // サーバー側のLINE設定状況（デモモードでは問い合わせ不要）
  useEffect(() => {
    if (isDemo) return;
    let alive = true;
    fetchLineStatus().then((s) => {
      if (alive) setLineConfigured(s.configured);
    });
    return () => {
      alive = false;
    };
  }, [isDemo]);

  const inboxCount = invoices.items.filter((i) => i.status === "received").length;
  const overdueCount = invoices.items.filter((i) => isOverdue(i, today)).length;

  const detail = detailId ? (invoices.items.find((i) => i.id === detailId) ?? null) : null;

  // ---------- 請求書CRUD ----------

  const saveInvoice = async (values: InvoiceFormValues) => {
    const total = values.subtotal + values.tax - values.withholding;
    const patch = {
      direction: values.direction,
      partner_id: values.partner_id || null,
      partner_name: values.partner_name,
      invoice_number: values.invoice_number,
      title: values.title,
      subtotal: values.subtotal,
      tax: values.tax,
      withholding: values.withholding,
      total,
      issue_date: values.issue_date,
      due_date: values.due_date,
      status: values.status,
      file_url: values.file_url,
      file_type: values.file_type,
      ocr_text: values.ocr_text,
      memo: values.memo,
      updated_at: new Date().toISOString(),
    };
    if (formState?.initial) {
      await invoices.update(formState.initial.id, patch);
      toast("請求書を更新しました", "success");
    } else {
      await invoices.add({
        ...patch,
        paid_amount: 0,
        paid_date: "",
        source: "manual",
        statement_id: null,
        line_group_id: "",
        line_message_id: "",
      });
      toast("請求書を登録しました", "success");
    }
    setFormState(null);
  };

  const changeStatus = async (inv: Invoice, status: InvoiceStatus) => {
    await invoices.update(inv.id, { status, updated_at: new Date().toISOString() });
    toast(
      status === "sent"
        ? "送付済にしました"
        : status === "confirmed"
          ? "確認済にしました"
          : status === "cancelled"
            ? "取消にしました"
            : "ステータスを更新しました",
      "info"
    );
  };

  const deleteInvoice = async (inv: Invoice) => {
    if (!confirm(`「${inv.title}」を削除しますか？消込履歴も削除されます。`)) return;
    // 消込履歴 → 請求書の順で削除（Supabase側はFK cascadeでも消えるが、デモモードと状態を揃える）
    for (const p of payments.items.filter((p) => p.invoice_id === inv.id)) {
      await payments.remove(p.id);
    }
    await invoices.remove(inv.id);
    setDetailId(null);
    toast("請求書を削除しました", "info");
  };

  // ---------- 消込 ----------

  const recordPayment = async (inv: Invoice, entry: PaymentEntry) => {
    await payments.add({
      invoice_id: inv.id,
      amount: entry.amount,
      paid_on: entry.paid_on,
      method: entry.method,
      recorded_by: user?.name ?? "",
      memo: entry.memo,
    });
    const newPaid = inv.paid_amount + entry.amount;
    const fully = newPaid >= inv.total;
    await invoices.update(inv.id, {
      paid_amount: newPaid,
      paid_date: fully ? entry.paid_on : inv.paid_date,
      status: fully ? "paid" : inv.status,
      updated_at: new Date().toISOString(),
    });
    toast(
      fully
        ? inv.direction === "receivable"
          ? "全額入金済みにしました"
          : "支払済にしました"
        : "一部消込を記録しました",
      "success"
    );
  };

  const deletePayment = async (payment: InvoicePayment) => {
    const inv = invoices.items.find((i) => i.id === payment.invoice_id);
    await payments.remove(payment.id);
    if (inv) {
      const remaining = payments.items
        .filter((p) => p.invoice_id === inv.id && p.id !== payment.id)
        .reduce((s, p) => s + p.amount, 0);
      await invoices.update(inv.id, {
        paid_amount: remaining,
        paid_date: remaining >= inv.total ? inv.paid_date : "",
        status: remaining >= inv.total ? inv.status : inv.status === "paid" ? "confirmed" : inv.status,
        updated_at: new Date().toISOString(),
      });
    }
    toast("消込を取り消しました", "info");
  };

  // ---------- LINE ----------

  const lineReadyFor = (inv: Invoice): { ok: boolean; reason: string } => {
    if (isDemo) return { ok: false, reason: "デモモードではLINE送付は利用できません" };
    if (!lineConfigured)
      return { ok: false, reason: "LINE連携が未設定です（設定画面の手順を確認してください）" };
    const group =
      (inv.line_group_id && lineGroups.items.find((g) => g.group_id === inv.line_group_id)) ||
      lineGroups.items.find((g) => g.partner_id === inv.partner_id && g.status === "active");
    if (!group) return { ok: false, reason: "この取引先に紐付いたLINEグループがありません（マスタタブで紐付け）" };
    return { ok: true, reason: "" };
  };

  const pushLine = async (inv: Invoice) => {
    toast("LINEへ送信しています…", "info");
    const result = await pushInvoiceToLine(inv.id);
    if (result.ok) {
      toast("LINEグループへ送付しました", "success");
      if (inv.status === "draft") {
        await invoices.update(inv.id, { status: "sent", updated_at: new Date().toISOString() });
      }
    } else {
      toast(result.error ?? "LINE送付に失敗しました", "error");
    }
  };

  /** デモ専用: LINE受信をシミュレートして受領ボックスに追加する */
  const simulateLine = async () => {
    const group =
      lineGroups.items.find((g) => g.status === "active") ?? lineGroups.items[0] ?? null;
    await invoices.add({
      direction: "payable",
      partner_id: group?.partner_id ?? null,
      partner_name: "",
      invoice_number: "",
      title: `LINE受信 請求書（${new Date().getMonth() + 1}/${new Date().getDate()} シミュレート）`,
      subtotal: 0,
      tax: 0,
      withholding: 0,
      total: 0,
      issue_date: today,
      due_date: "",
      status: "received",
      paid_amount: 0,
      paid_date: "",
      source: "line",
      statement_id: null,
      line_group_id: group?.group_id ?? "",
      line_message_id: `demo-${uid()}`,
      file_url: "",
      file_type: "",
      ocr_text: "",
      memo: "デモ用に生成された受信データです。実運用ではLINEの画像・PDFが添付されます。",
      updated_at: new Date().toISOString(),
    });
    toast("LINE受信をシミュレートしました。受領ボックスを確認してください", "success");
  };

  return (
    <div>
      <PageHeader
        icon={<Receipt className="h-5 w-5" />}
        title="請求・支払"
        description="請求書の受領・発行、メーカー明細の代理店別計算、入金・支払の消込を一元管理"
      />

      <Tabs
        className="mb-5"
        tabs={[
          { key: "inbox", label: "受領ボックス", count: inboxCount },
          { key: "invoices", label: "請求書" },
          { key: "reconcile", label: "入金消込", count: overdueCount },
          { key: "statements", label: "明細計算" },
          { key: "masters", label: "マスタ" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "inbox" && (
        <InboxTab
          invoices={invoices.items}
          partners={partners.items}
          lineGroups={lineGroups.items}
          isDemo={isDemo}
          loading={loading}
          onConfirm={(inv) =>
            setFormState({
              initial: { ...inv, status: "confirmed" },
              defaultDirection: inv.direction,
            })
          }
          onCreateReceived={() => setFormState({ initial: null, defaultDirection: "payable" })}
          onSimulateLine={simulateLine}
        />
      )}
      {tab === "invoices" && (
        <InvoicesTab
          invoices={invoices.items}
          partners={partners.items}
          today={today}
          loading={loading}
          onOpenDetail={(inv) => setDetailId(inv.id)}
          onCreate={(direction) => setFormState({ initial: null, defaultDirection: direction })}
        />
      )}
      {tab === "reconcile" && (
        <ReconcileTab
          invoices={invoices.items}
          payments={payments.items}
          partners={partners.items}
          today={today}
          loading={loading || payments.loading}
          onRecordPayment={recordPayment}
          onDeletePayment={deletePayment}
          onOpenDetail={(inv) => setDetailId(inv.id)}
        />
      )}
      {tab === "statements" && (
        <StatementsTab
          statements={statements}
          lines={statementLines}
          invoices={invoices}
          partners={partners.items}
          rates={rates.items}
          currentUserName={user?.name ?? ""}
          loading={statements.loading || statementLines.loading}
          notify={toast}
        />
      )}
      {tab === "masters" && (
        <MastersTab
          partners={partners}
          rates={rates}
          lineGroups={lineGroups}
          isDemo={isDemo}
          notify={toast}
        />
      )}

      {formState && (
        <InvoiceFormModal
          initial={formState.initial}
          defaultDirection={formState.defaultDirection}
          partners={partners.items}
          today={today}
          onClose={() => setFormState(null)}
          onSubmit={saveInvoice}
        />
      )}

      {detail && (
        <InvoiceDetailModal
          invoice={detail}
          partners={partners.items}
          payments={payments.items.filter((p) => p.invoice_id === detail.id)}
          today={today}
          lineReady={lineReadyFor(detail)}
          onClose={() => setDetailId(null)}
          onEdit={(inv) => {
            setDetailId(null);
            setFormState({ initial: inv, defaultDirection: inv.direction });
          }}
          onDelete={deleteInvoice}
          onChangeStatus={changeStatus}
          onPushLine={pushLine}
        />
      )}
    </div>
  );
}
