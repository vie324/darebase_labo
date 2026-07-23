"use client";

// 明細詳細 — 行の割当修正 → 計算実行 → 承認 → 代理店別請求書の一括生成

import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Calculator,
  CheckCircle2,
  FileOutput,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { cn, formatYen, todayStr } from "@/lib/utils";
import type { Collection } from "@/lib/use-collection";
import type {
  CommissionRate,
  Invoice,
  MakerStatement,
  Partner,
  StatementLine,
} from "@/lib/types";
import { STATEMENT_STATUSES } from "@/lib/constants";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { calcAgencyShare, calcTax, findRate, nextDueDate, partnerName } from "./shared";

export function StatementDetail({
  statement,
  statements,
  lines,
  invoices,
  partners,
  rates,
  currentUserName,
  notify,
  onBack,
}: {
  statement: MakerStatement;
  statements: Collection<MakerStatement>;
  lines: Collection<StatementLine>;
  invoices: Collection<Invoice>;
  partners: Partner[];
  rates: CommissionRate[];
  currentUserName: string;
  notify: (message: string, type?: "success" | "error" | "info") => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [showAddRow, setShowAddRow] = useState(false);

  const st = statement;
  const meta = STATEMENT_STATUSES[st.status];
  const agencies = partners.filter((p) => p.kind === "agency");
  const editable = st.status === "draft" || st.status === "calculated";

  const myLines = useMemo(
    () =>
      lines.items
        .filter((l) => l.statement_id === st.id)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
    [lines.items, st.id]
  );

  /** 警告行: 代理店未割当 or 率未決定 */
  const warnings = myLines.filter((l) => !l.agency_id || l.rate_source === "");
  const totalAmount = myLines.reduce((s, l) => s + l.amount, 0);
  const totalAgency = myLines.reduce((s, l) => s + l.agency_amount, 0);
  const totalCompany = myLines.reduce((s, l) => s + l.company_amount, 0);

  const generatedInvoices = invoices.items.filter(
    (i) => i.statement_id === st.id && i.status !== "cancelled"
  );

  /** 代理店ごとの集計（計算後のサマリ表示・請求書生成に使用） */
  const byAgency = useMemo(() => {
    const map = new Map<string, { agencyId: string | null; lines: StatementLine[] }>();
    for (const l of myLines) {
      const key = l.agency_id ?? "__unassigned__";
      if (!map.has(key)) map.set(key, { agencyId: l.agency_id, lines: [] });
      map.get(key)!.lines.push(l);
    }
    return Array.from(map.values());
  }, [myLines]);

  const syncTotal = async (nextLines?: StatementLine[]) => {
    const total = (nextLines ?? myLines).reduce((s, l) => s + l.amount, 0);
    if (total !== st.total_amount) {
      await statements.update(st.id, { total_amount: total });
    }
  };

  // ---------- 計算実行 / 再計算 ----------
  const runCalc = async () => {
    if (busy) return;
    setBusy(true);
    try {
      let missing = 0;
      for (const line of myLines) {
        // 手動決定した率は再計算で上書きしない
        if (line.rate_source === "manual") continue;
        if (!line.agency_id) {
          missing++;
          await lines.update(line.id, {
            rate_percent: null,
            agency_amount: 0,
            company_amount: 0,
            rate_source: "",
          });
          continue;
        }
        const rate = findRate(rates, line.agency_id, st.maker_id, line.product_name, st.statement_month);
        if (!rate) {
          missing++;
          await lines.update(line.id, {
            rate_percent: null,
            agency_amount: 0,
            company_amount: 0,
            rate_source: "",
          });
          continue;
        }
        const agencyAmount = calcAgencyShare(line.amount, rate);
        await lines.update(line.id, {
          rate_percent: rate.rate_type === "percent" ? rate.rate_percent : null,
          agency_amount: agencyAmount,
          company_amount: line.amount - agencyAmount,
          rate_source: "master",
        });
      }
      await statements.update(st.id, { status: "calculated", total_amount: totalAmount });
      notify(
        missing > 0
          ? `計算しました（${missing}行は代理店または率が未設定です。修正して再計算してください）`
          : "全行の計算が完了しました。内容を確認して承認してください",
        missing > 0 ? "info" : "success"
      );
    } finally {
      setBusy(false);
    }
  };

  // ---------- 行の修正 ----------
  const setLineAgency = async (line: StatementLine, agencyId: string) => {
    // 割当変更後は率を再決定させる（手動率もリセット）
    await lines.update(line.id, {
      agency_id: agencyId || null,
      rate_percent: null,
      agency_amount: 0,
      company_amount: 0,
      rate_source: "",
    });
  };

  const setLineManualRate = async (line: StatementLine, percent: number) => {
    if (percent < 0 || percent > 100) return;
    const agencyAmount = Math.floor((line.amount * percent) / 100);
    await lines.update(line.id, {
      rate_percent: percent,
      agency_amount: agencyAmount,
      company_amount: line.amount - agencyAmount,
      rate_source: "manual",
    });
  };

  const removeLine = async (line: StatementLine) => {
    if (!confirm("この明細行を削除しますか？")) return;
    await lines.remove(line.id);
    await syncTotal(myLines.filter((l) => l.id !== line.id));
  };

  // ---------- 承認 ----------
  const approve = async () => {
    if (warnings.length > 0) {
      notify("代理店・率が未設定の行があるため承認できません", "error");
      return;
    }
    await statements.update(st.id, {
      status: "approved",
      approved_by: currentUserName,
      approved_at: new Date().toISOString(),
    });
    notify("承認しました。「請求書を生成」で代理店別の支払明細を発行できます", "success");
  };

  // ---------- 請求書生成 ----------
  const generateInvoices = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const today = todayStr();
      const makerLabel = partnerName(partners, st.maker_id);
      const monthCompact = st.statement_month.replace("-", "");
      let seq = 1;
      let count = 0;
      for (const group of byAgency) {
        if (!group.agencyId) continue;
        const subtotal = group.lines.reduce((s, l) => s + l.agency_amount, 0);
        seq++;
        if (subtotal <= 0) continue;
        // 冪等性: この明細から生成済みの請求書がある代理店はスキップ
        const exists = invoices.items.some(
          (i) => i.statement_id === st.id && i.partner_id === group.agencyId && i.status !== "cancelled"
        );
        if (exists) continue;
        const partner = partners.find((p) => p.id === group.agencyId);
        const tax = calcTax(subtotal);
        await invoices.add({
          direction: "payable",
          partner_id: group.agencyId,
          partner_name: partner?.name ?? "",
          invoice_number: `PAY-${monthCompact}-${seq - 1}`,
          title: `${st.statement_month}分 手数料お支払明細${makerLabel ? `（${makerLabel}）` : ""}`,
          subtotal,
          tax,
          withholding: 0,
          total: subtotal + tax,
          issue_date: today,
          due_date: nextDueDate(today, partner),
          status: "confirmed",
          paid_amount: 0,
          paid_date: "",
          source: "statement",
          statement_id: st.id,
          line_group_id: "",
          line_message_id: "",
          file_url: "",
          file_type: "",
          ocr_text: "",
          memo: "",
          updated_at: new Date().toISOString(),
        });
        count++;
      }
      await statements.update(st.id, { status: "invoiced" });
      notify(
        count > 0
          ? `${count}件の支払明細（請求書）を生成しました。「請求書」タブで確認できます`
          : "生成対象がありませんでした（すべて生成済みです）",
        count > 0 ? "success" : "info"
      );
    } finally {
      setBusy(false);
    }
  };

  // ---------- 差し戻し ----------
  const sendBack = async () => {
    if (st.status === "invoiced") {
      const generated = invoices.items.filter((i) => i.statement_id === st.id);
      if (generated.some((i) => i.paid_amount > 0)) {
        notify("入金・支払済みの請求書があるため差し戻せません（先に消込を取り消してください）", "error");
        return;
      }
      if (
        !confirm(
          `この明細から生成した請求書${generated.length}件を削除して下書きに戻します。よろしいですか？`
        )
      )
        return;
      for (const inv of generated) await invoices.remove(inv.id);
    } else if (!confirm("下書きに差し戻しますか？")) {
      return;
    }
    await statements.update(st.id, { status: "draft", approved_by: "", approved_at: "" });
    notify("下書きに差し戻しました", "info");
  };

  const removeStatement = async () => {
    if (!confirm("この明細と全行を削除しますか？（生成済みの請求書は削除されません）")) return;
    for (const line of myLines) await lines.remove(line.id);
    await statements.remove(st.id);
    onBack();
  };

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={onBack}
            aria-label="一覧へ戻る"
            className="mt-0.5 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={meta.color}>{meta.label}</Badge>
              {st.approved_by && (
                <span className="text-xs text-slate-400">承認: {st.approved_by}</span>
              )}
            </div>
            <h2 className="mt-1 text-lg font-bold">{st.title}</h2>
            <p className="text-xs text-slate-400">
              {partnerName(partners, st.maker_id) || "メーカー未設定"} ・ 対象月 {st.statement_month || "—"} ・ {myLines.length}行
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(st.status === "draft" || st.status === "calculated") && (
            <Button size="sm" onClick={runCalc} disabled={busy || myLines.length === 0}>
              <Calculator className="h-4 w-4" />
              {st.status === "draft" ? "計算実行" : "再計算"}
            </Button>
          )}
          {st.status === "calculated" && (
            <Button size="sm" variant="success" onClick={approve} disabled={busy}>
              <CheckCircle2 className="h-4 w-4" />
              承認する
            </Button>
          )}
          {st.status === "approved" && (
            <Button size="sm" variant="success" onClick={generateInvoices} disabled={busy}>
              <FileOutput className="h-4 w-4" />
              請求書を生成
            </Button>
          )}
          {st.status !== "draft" && (
            <Button size="sm" variant="secondary" onClick={sendBack} disabled={busy}>
              <RotateCcw className="h-4 w-4" />
              差し戻し
            </Button>
          )}
          {st.status !== "invoiced" && (
            <Button size="sm" variant="ghost" onClick={removeStatement} disabled={busy}>
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
          )}
        </div>
      </div>

      {/* 警告 */}
      {warnings.length > 0 && st.status !== "draft" && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {warnings.length}行で代理店または手数料率が未設定です。行内で修正するか、マスタタブで率を登録して再計算してください。
        </p>
      )}

      {/* 生成済み請求書のリンク情報 */}
      {st.status === "invoiced" && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          この明細から{generatedInvoices.length}件の支払明細（請求書）を生成済みです。「請求書」タブ・「入金消込」タブで管理できます。
        </p>
      )}

      {/* 明細行テーブル */}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs text-slate-400 dark:border-slate-800">
              <th className="px-4 py-3 font-semibold">商材 / 顧客</th>
              <th className="px-4 py-3 font-semibold">代理店</th>
              <th className="px-4 py-3 text-right font-semibold">明細金額</th>
              <th className="px-4 py-3 text-right font-semibold">率</th>
              <th className="px-4 py-3 text-right font-semibold">代理店取分</th>
              <th className="px-4 py-3 text-right font-semibold">自社取分</th>
              {editable && <th className="px-2 py-3" />}
            </tr>
          </thead>
          <tbody>
            {myLines.map((line) => {
              const warn = !line.agency_id || line.rate_source === "";
              return (
                <tr
                  key={line.id}
                  className={cn(
                    "border-b border-slate-50 last:border-0 dark:border-slate-800/60",
                    warn && st.status !== "draft" && "bg-amber-50/60 dark:bg-amber-500/5"
                  )}
                >
                  <td className="max-w-56 px-4 py-2.5">
                    <p className="truncate font-medium">{line.product_name || "（商材未設定）"}</p>
                    <p className="truncate text-xs text-slate-400">
                      {line.customer_name}
                      {line.memo && <span className="ml-1 text-amber-600 dark:text-amber-400">{line.memo}</span>}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    {editable ? (
                      <Select
                        value={line.agency_id ?? ""}
                        onChange={(e) => setLineAgency(line, e.target.value)}
                        className={cn(
                          "h-9 w-44 py-1 text-xs",
                          !line.agency_id && "border-amber-300 dark:border-amber-500/50"
                        )}
                      >
                        <option value="">未割当</option>
                        {agencies.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <span>{partnerName(partners, line.agency_id) || "未割当"}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    {formatYen(line.amount)}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {st.status === "calculated" && line.agency_id ? (
                      <span className="inline-flex items-center gap-1">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={line.rate_percent ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "") return;
                            setLineManualRate(line, Number(v));
                          }}
                          className="h-9 w-20 px-2 py-1 text-right text-xs"
                          placeholder="—"
                        />
                        %
                      </span>
                    ) : line.rate_source === "" ? (
                      <span className="text-amber-600 dark:text-amber-400">未決定</span>
                    ) : line.rate_percent === null ? (
                      <span title="固定額契約">固定</span>
                    ) : (
                      `${line.rate_percent}%`
                    )}
                    {line.rate_source === "manual" && (
                      <span className="ml-1 text-[10px] text-slate-400" title="手動で設定した率">
                        手動
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {line.rate_source ? formatYen(line.agency_amount) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {line.rate_source ? formatYen(line.company_amount) : "—"}
                  </td>
                  {editable && (
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => removeLine(line)}
                        aria-label="行を削除"
                        className="cursor-pointer rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:text-slate-600 dark:hover:bg-slate-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-100 text-sm font-semibold dark:border-slate-800">
              <td className="px-4 py-3" colSpan={2}>
                合計
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">{formatYen(totalAmount)}</td>
              <td />
              <td className="px-4 py-3 text-right whitespace-nowrap">{formatYen(totalAgency)}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                {formatYen(totalCompany)}
              </td>
              {editable && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* 行の追加（下書きのみ） */}
      {st.status === "draft" &&
        (showAddRow ? (
          <AddRowForm
            agencies={agencies}
            onCancel={() => setShowAddRow(false)}
            onAdd={async (row) => {
              await lines.add({
                statement_id: st.id,
                agency_id: row.agencyId || null,
                product_name: row.product,
                customer_name: row.customer,
                amount: row.amount,
                rate_percent: null,
                agency_amount: 0,
                company_amount: 0,
                rate_source: "",
                memo: "",
              });
              await statements.update(st.id, { total_amount: totalAmount + row.amount });
              setShowAddRow(false);
            }}
          />
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setShowAddRow(true)}>
            <Plus className="h-4 w-4" />
            行を追加
          </Button>
        ))}

      {/* 代理店別サマリ */}
      {st.status !== "draft" && (
        <div>
          <p className="mb-2 text-xs font-bold tracking-wider text-slate-400">代理店別サマリ</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byAgency.map((group) => {
              const label = group.agencyId
                ? partnerName(partners, group.agencyId)
                : "未割当";
              const subtotal = group.lines.reduce((s, l) => s + l.agency_amount, 0);
              const company = group.lines.reduce((s, l) => s + l.company_amount, 0);
              return (
                <Card key={group.agencyId ?? "none"} className={cn("p-4", !group.agencyId && "border-amber-200 dark:border-amber-500/30")}>
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{group.lines.length}行</p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">支払額（税抜）</span>
                      <span className="font-bold">{formatYen(subtotal)}</span>
                    </p>
                    <p className="flex justify-between text-xs">
                      <span className="text-slate-400">自社粗利</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {formatYen(company)}
                      </span>
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// 行の手動追加フォーム
// =============================================================
function AddRowForm({
  agencies,
  onCancel,
  onAdd,
}: {
  agencies: Partner[];
  onCancel: () => void;
  onAdd: (row: { product: string; customer: string; amount: number; agencyId: string }) => Promise<void>;
}) {
  const [product, setProduct] = useState("");
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState(0);
  const [agencyId, setAgencyId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || saving) return;
    setSaving(true);
    try {
      await onAdd({ product: product.trim(), customer: customer.trim(), amount, agencyId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"
    >
      <Field label="商材名" className="min-w-40 flex-1">
        <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="例: 光回線" />
      </Field>
      <Field label="顧客名" className="min-w-40 flex-1">
        <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="例: 株式会社サンプル" />
      </Field>
      <Field label="金額（円）" className="w-36">
        <Input
          type="number"
          min={1}
          value={amount === 0 ? "" : amount}
          onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          required
        />
      </Field>
      <Field label="代理店" className="w-44">
        <Select value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
          <option value="">未割当</option>
          {agencies.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex gap-2 pb-0.5">
        <Button type="button" size="sm" variant="secondary" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" size="sm" disabled={amount <= 0 || saving}>
          追加
        </Button>
      </div>
    </form>
  );
}
