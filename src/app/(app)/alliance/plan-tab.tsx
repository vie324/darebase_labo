"use client";

// 計画（事業計画※確定版の『期間サマリー』『月次目標生成』『前提条件』）。
//   期間サマリー … 前半・後半・期間合計の 計画 vs 実績
//   シナリオ比較 … 保守・標準・積極
//   月次目標     … その月の予算をそのまま共有できる文に（『月次目標生成』）
//   前提条件     … シナリオ・月別の紹介総数・成約率・新規獲得数・平均プラン（経営・管理部が編集）
// 計算は lib/alliance-plan.ts（シートの数式と1対1）。

import { useState, type FormEvent } from "react";
import { AlertTriangle, RotateCcw, Save } from "lucide-react";
import {
  SCENARIOS,
  SCENARIO_KEYS,
  budgetText,
  buildPlan,
  coercePlan,
  monthRange,
  planHalves,
  planTotals,
  unitFee,
  type AlliancePlanSettings,
  type Scenario,
} from "@/lib/alliance-plan";
import type { MonthResult } from "@/lib/alliance-kpi";
import { achievement } from "@/lib/alliance-kpi";
import { monthLabel } from "@/lib/alliance";
import type { Product } from "@/lib/types";
import { Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { CopyButton, Rate, StickyTd, StickyTh, TableCard, Td, Th, TextPreview, num, yen } from "./shared";

export function PlanTab({
  plan,
  isDefault,
  results,
  canEdit,
  planProducts,
  selectedMonth,
  onSave,
}: {
  plan: AlliancePlanSettings;
  isDefault: boolean;
  results: MonthResult[];
  canEdit: boolean;
  /** 平均プランの候補（商材マスタのプラン） */
  planProducts: Product[];
  selectedMonth: string;
  onSave: (next: AlliancePlanSettings) => Promise<void>;
}) {
  const rows = buildPlan(plan);
  const halves = planHalves(rows);
  const [budgetMonth, setBudgetMonth] = useState(
    rows.some((r) => r.month === selectedMonth) ? selectedMonth : (rows[0]?.month ?? "")
  );
  const text = budgetText(plan, budgetMonth) ?? "";

  return (
    <div className="space-y-5">
      {isDefault && (
        <Card className="flex items-start gap-2.5 p-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          『アライアンス事業計画※確定版』の値（{SCENARIOS[plan.scenario].label}シナリオ・
          {monthLabel(rows[0]?.month ?? "")}〜{monthLabel(rows.at(-1)?.month ?? "")}）で動いています。
          計画を見直したら、下の「前提条件」から上書きしてください。
        </Card>
      )}

      <TableCard
        title="期間サマリー（計画 vs 実績）"
        description={`KGI：代理店をどれだけ儲けさせたか（代理店報酬の総額）／ 平均プラン：${plan.planName}（売上 ${yen(plan.unitSales)}・自社利益 ${yen(plan.unitProfit)}・代理店報酬 ${yen(unitFee(plan))}）`}
        minWidth={980}
      >
        <thead>
          <tr>
            <StickyTh rowSpan={2}>指標</StickyTh>
            {halves.map((h) => (
              <Th key={h.label} colSpan={3} className="text-center">
                {h.label}
                <span className="ml-1 font-normal text-slate-400">
                  {monthLabel(h.rows[0]?.month ?? "")}〜{monthLabel(h.rows.at(-1)?.month ?? "")}
                </span>
              </Th>
            ))}
          </tr>
          <tr>
            {halves.flatMap((h) => [
              <Th key={`${h.label}-p`}>計画</Th>,
              <Th key={`${h.label}-a`}>実績</Th>,
              <Th key={`${h.label}-r`}>達成率</Th>,
            ])}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {(
            [
              ["★代理店報酬 総額（KGI）", (r: MonthResult) => r.plan.fee, (r: MonthResult) => r.actual.fee, true],
              ["紹介総数", (r: MonthResult) => r.plan.referrals, (r: MonthResult) => r.actual.referrals, false],
              ["成約数", (r: MonthResult) => r.plan.closings, (r: MonthResult) => r.actual.closings, false],
              ["売上", (r: MonthResult) => r.plan.sales, (r: MonthResult) => r.actual.sales, true],
              ["自社利益（粗利）", (r: MonthResult) => r.plan.profit, (r: MonthResult) => r.actual.profit, true],
              ["新規獲得 代理店数", (r: MonthResult) => r.plan.newAgencies, (r: MonthResult) => r.actual.newAgencies, false],
            ] as const
          ).map(([label, planOf, actualOf, money]) => (
            <tr key={label}>
              <StickyTd className={label.startsWith("★") ? "text-amber-700 dark:text-amber-300" : ""}>{label}</StickyTd>
              {halves.flatMap((h) => {
                const part = results.filter((r) => h.rows.some((x) => x.month === r.month));
                const p = part.reduce((s, r) => s + planOf(r), 0);
                const a = part.reduce((s, r) => s + actualOf(r), 0);
                return [
                  <Td key={`${h.label}-p`} className="text-slate-400">{money ? yen(p) : num(p)}</Td>,
                  <Td key={`${h.label}-a`} className="font-semibold">{money ? yen(a) : num(a)}</Td>,
                  <Td key={`${h.label}-r`}><Rate value={achievement(a, p)} /></Td>,
                ];
              })}
            </tr>
          ))}
          <tr>
            <StickyTd>期末 累計代理店数</StickyTd>
            {halves.flatMap((h) => {
              const last = results.find((r) => r.month === h.rows.at(-1)?.month);
              const p = h.rows.at(-1)?.cumAgencies ?? 0;
              const a = last?.actual.cumAgencies ?? 0;
              return [
                <Td key={`${h.label}-p`} className="text-slate-400">{num(p)}</Td>,
                <Td key={`${h.label}-a`} className="font-semibold">{num(a)}</Td>,
                <Td key={`${h.label}-r`}><Rate value={achievement(a, p)} /></Td>,
              ];
            })}
          </tr>
          <tr>
            <StickyTd>稼働1社あたり 月間報酬</StickyTd>
            {halves.flatMap((h) => {
              const t = planTotals(h.rows);
              const part = results.filter((r) => h.rows.some((x) => x.month === r.month));
              const months = part.reduce((s, r) => s + r.actual.cumAgencies, 0);
              const fee = part.reduce((s, r) => s + r.actual.fee, 0);
              const a = months > 0 ? Math.round(fee / months) : 0;
              return [
                <Td key={`${h.label}-p`} className="text-slate-400">{yen(t.perAgencyFee)}</Td>,
                <Td key={`${h.label}-a`} className="font-semibold">{yen(a)}</Td>,
                <Td key={`${h.label}-r`}><Rate value={achievement(a, t.perAgencyFee)} /></Td>,
              ];
            })}
          </tr>
        </tbody>
      </TableCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <TableCard title="シナリオ比較（期間合計）" description="紹介総数は第2版の各シナリオに準拠" minWidth={560}>
          <thead>
            <tr>
              <Th left>シナリオ</Th>
              <Th>紹介総数</Th>
              <Th>成約数</Th>
              <Th>売上</Th>
              <Th>★代理店報酬</Th>
              <Th>自社利益</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {SCENARIO_KEYS.map((s) => {
              const t = planTotals(buildPlan(plan, s));
              return (
                <tr key={s} className={s === plan.scenario ? "bg-cyan-50/60 dark:bg-cyan-500/5" : ""}>
                  <Td left className="font-semibold">
                    {SCENARIOS[s].label}
                    {s === plan.scenario && (
                      <Badge className="ml-1.5 bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">選択中</Badge>
                    )}
                  </Td>
                  <Td>{num(t.referrals)}</Td>
                  <Td>{num(t.closings)}</Td>
                  <Td>{yen(t.sales)}</Td>
                  <Td className="font-semibold text-amber-700 dark:text-amber-300">{yen(t.fee)}</Td>
                  <Td>{yen(t.profit)}</Td>
                </tr>
              );
            })}
          </tbody>
        </TableCard>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold">月次目標（予算）の文面</h2>
            <div className="flex items-center gap-2">
              <Select
                value={budgetMonth}
                onChange={(e) => setBudgetMonth(e.target.value)}
                className="h-9 w-36 py-0"
                aria-label="対象月"
              >
                {rows.map((r) => (
                  <option key={r.month} value={r.month}>
                    {monthLabel(r.month)}
                  </option>
                ))}
              </Select>
              <CopyButton text={text} />
            </div>
          </div>
          <TextPreview text={text} />
        </Card>
      </div>

      <PlanEditor key={JSON.stringify(plan)} plan={plan} canEdit={canEdit} planProducts={planProducts} onSave={onSave} />
    </div>
  );
}

// =============================================================
// 前提条件の編集
// =============================================================
function PlanEditor({
  plan,
  canEdit,
  planProducts,
  onSave,
}: {
  plan: AlliancePlanSettings;
  canEdit: boolean;
  planProducts: Product[];
  onSave: (next: AlliancePlanSettings) => Promise<void>;
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<AlliancePlanSettings>(plan);
  const [saving, setSaving] = useState(false);
  const months = monthRange(draft.startMonth, draft.months);
  const preview = buildPlan(draft);
  const totals = planTotals(preview);

  const setArray = (key: "closeRates" | "newAgencies", i: number, v: number) =>
    setDraft((d) => ({ ...d, [key]: d[key].map((x, j) => (j === i ? v : x)) }));
  const setReferral = (s: Scenario, i: number, v: number) =>
    setDraft((d) => ({
      ...d,
      referrals: { ...d.referrals, [s]: d.referrals[s].map((x, j) => (j === i ? v : x)) },
    }));
  /** 期間・開始月を変えたら、配列の長さを揃える（足りない月は 0） */
  const reshape = (patch: Partial<AlliancePlanSettings>) =>
    setDraft((d) => coercePlan({ ...d, ...patch } as unknown as Record<string, unknown>));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      toast("事業計画を保存しました", "success");
    } catch {
      toast("保存できませんでした。権限（経営・管理部）と通信状況を確認してください", "error");
    } finally {
      setSaving(false);
    }
  };

  const numberInput = (value: number, onChange: (v: number) => void, step = 1, label = "") => (
    <Input
      type="number"
      min={0}
      step={step}
      value={value}
      disabled={!canEdit}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
      className="h-8 w-20 px-2 py-0 text-right text-xs tabular-nums"
    />
  );

  return (
    <form onSubmit={submit}>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold">前提条件（事業計画※確定版『前提条件』）</h2>
            <p className="mt-0.5 text-xs text-slate-400">
              {canEdit
                ? "ここを変えると、月次実績・日報・期間サマリーの計画がすべて変わります"
                : "前提条件の変更は経営・管理部が行います"}
            </p>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setDraft(coercePlan(undefined))}
              >
                <RotateCcw className="h-4 w-4" />
                確定版の値に戻す
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "保存中…" : "保存する"}
              </Button>
            </div>
          )}
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="計画開始月">
            <Input
              type="month"
              value={draft.startMonth}
              disabled={!canEdit}
              onChange={(e) => e.target.value && reshape({ startMonth: e.target.value })}
            />
          </Field>
          <Field label="計画期間（ヶ月）">
            <Input
              type="number"
              min={1}
              max={24}
              value={draft.months}
              disabled={!canEdit}
              onChange={(e) => reshape({ months: Math.min(24, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </Field>
          <Field label="シナリオ選択">
            <Select
              value={draft.scenario}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, scenario: e.target.value as Scenario })}
            >
              {SCENARIO_KEYS.map((s) => (
                <option key={s} value={s}>
                  {SCENARIOS[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="商材名（月次目標の文面）">
            <Input
              value={draft.productLabel}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, productLabel: e.target.value })}
              placeholder="DDHBOX"
            />
          </Field>
          <Field label="平均プラン（全成約をこのプランで計上）">
            <Select
              value={planProducts.find((p) => p.name === draft.planName)?.id ?? ""}
              disabled={!canEdit}
              onChange={(e) => {
                const p = planProducts.find((x) => x.id === e.target.value);
                if (p) {
                  setDraft({
                    ...draft,
                    planName: p.name,
                    unitSales: p.unit_price,
                    unitProfit: p.unit_profit ?? 0,
                  });
                }
              }}
            >
              <option value="">{draft.planName}（手入力）</option>
              {planProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}（商材マスタから）
                </option>
              ))}
            </Select>
          </Field>
          <Field label="売上/件（円）">
            <Input
              type="number"
              min={0}
              value={draft.unitSales}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, unitSales: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
          <Field label="自社利益/件（円）">
            <Input
              type="number"
              min={0}
              value={draft.unitProfit}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, unitProfit: Math.max(0, Number(e.target.value) || 0) })}
            />
          </Field>
          <Field label="代理店報酬/件（自動）">
            <Input value={yen(unitFee(draft))} disabled />
          </Field>
          <Field label="目指すべき数字（参考・計算には使わない）" className="sm:col-span-2 lg:col-span-4">
            <Input
              value={draft.longTermGoal}
              disabled={!canEdit}
              onChange={(e) => setDraft({ ...draft, longTermGoal: e.target.value })}
            />
          </Field>
        </div>

        <div className="scrollbar-thin overflow-x-auto border-t border-slate-100 dark:border-slate-800">
          <table className="w-full text-sm" style={{ minWidth: 220 + months.length * 96 }}>
            <thead>
              <tr>
                <StickyTh>月別の入力</StickyTh>
                {months.map((m) => (
                  <Th key={m}>{monthLabel(m)}</Th>
                ))}
                <Th>期間合計</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {SCENARIO_KEYS.map((s) => (
                <tr key={s}>
                  <StickyTd className={s === draft.scenario ? "text-cyan-700 dark:text-cyan-300" : ""}>
                    紹介総数（{SCENARIOS[s].label}）
                  </StickyTd>
                  {months.map((m, i) => (
                    <Td key={m}>{numberInput(draft.referrals[s][i] ?? 0, (v) => setReferral(s, i, v), 1, `${monthLabel(m)} 紹介総数（${SCENARIOS[s].label}）`)}</Td>
                  ))}
                  <Td className="font-semibold">{num(draft.referrals[s].reduce((a, b) => a + b, 0))}</Td>
                </tr>
              ))}
              <tr>
                <StickyTd>成約率（%）</StickyTd>
                {months.map((m, i) => (
                  <Td key={m}>{numberInput(draft.closeRates[i] ?? 0, (v) => setArray("closeRates", i, Math.min(100, v)), 0.1, `${monthLabel(m)} 成約率`)}</Td>
                ))}
                <Td className="text-slate-400">平均 {(draft.closeRates.reduce((a, b) => a + b, 0) / Math.max(1, months.length)).toFixed(1)}%</Td>
              </tr>
              <tr>
                <StickyTd>新規獲得数（社）</StickyTd>
                {months.map((m, i) => (
                  <Td key={m}>{numberInput(draft.newAgencies[i] ?? 0, (v) => setArray("newAgencies", i, v), 1, `${monthLabel(m)} 新規獲得数`)}</Td>
                ))}
                <Td className="font-semibold">{num(totals.newAgencies)}</Td>
              </tr>
              <tr className="bg-slate-50/60 text-slate-500 dark:bg-slate-800/30">
                <StickyTd className="bg-slate-50 text-slate-500 dark:bg-slate-800">→ 成約数（自動）</StickyTd>
                {preview.map((r) => (
                  <Td key={r.month}>{num(r.closings)}</Td>
                ))}
                <Td className="font-semibold">{num(totals.closings)}</Td>
              </tr>
              <tr className="bg-amber-50/40 text-amber-700 dark:bg-amber-500/5 dark:text-amber-300">
                <StickyTd className="bg-amber-50 text-amber-700 dark:bg-slate-800 dark:text-amber-300">→ ★代理店報酬（自動）</StickyTd>
                {preview.map((r) => (
                  <Td key={r.month}>{yen(r.fee)}</Td>
                ))}
                <Td className="font-bold">{yen(totals.fee)}</Td>
              </tr>
            </tbody>
          </table>
        </div>
        {JSON.stringify(draft) !== JSON.stringify(plan) && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-[11px] text-amber-600 dark:border-slate-800 dark:text-amber-400">
            未保存の変更があります。保存するまで、ほかの画面の計画は変わりません。
          </p>
        )}
      </Card>
    </form>
  );
}
