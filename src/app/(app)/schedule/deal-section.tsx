"use client";

// 予定の入力画面の「案件」欄。
//
// チェックを入れると、予定の保存と同時に案件管理へ「商談予定」の案件を登録する。
// 入力は最小限（会社名・紹介元・商材・完了予定日）にして、確度や次のアクションなど
// 細かい項目は案件管理で直してもらう（案件の修正は案件管理に一本化する）。
// すでに案件に紐づいている予定は、案件の要約と案件管理へのリンクだけを出す。
// 初期値と二重登録の判定は lib/schedule-deal.ts。

import Link from "next/link";
import { AlertTriangle, ArrowRight, Briefcase, Package } from "lucide-react";
import { DEAL_STAGES } from "@/lib/constants";
import { filterByUnit, UNIT_TERMS, type BusinessUnitSlug } from "@/lib/business-units";
import { isOpenStage } from "@/lib/pipeline";
import { productColor } from "@/lib/products";
import { openDealsOfCompany, scheduleDealName } from "@/lib/schedule-deal";
import { cn, formatYen, formatYenShort } from "@/lib/utils";
import type { Appointment, Bank, Branch, BusinessUnit, Deal, Product } from "@/lib/types";
import { Badge, Field, FieldSet, Input, Select } from "@/components/ui";
import { UnitSwitch } from "@/components/ui/unit-switch";

/** 入力中の値（画面の中だけで持つ） */
export interface ScheduleDealDraft {
  enabled: boolean;
  unit: BusinessUnitSlug;
  company: string;
  /** "" = 会社名（＋商材）から自動で付ける */
  name: string;
  bank_id: string;
  branch_id: string;
  product_ids: string[];
  /** 商材を選ばないときの金額（入力中の文字列） */
  amount: string;
  expected_close: string;
}

/** 保存時に親へ渡す値 */
export interface ScheduleDealInput {
  business_unit_id: string | null;
  company: string;
  name: string;
  bank_id: string | null;
  branch_id: string | null;
  /** 選んだ商材（標準単価で明細を作る） */
  products: Product[];
  amount: number;
  expected_close: string;
}

/** 案件欄に必要なデータ一式（親のページが読み込んで渡す） */
export interface ScheduleDealContext {
  /** 選べる事業部（有効なもの） */
  units: BusinessUnit[];
  /** business_unit_id が空の既存行をどの事業部とみなすか */
  defaultUnitId: string | null;
  banks: Bank[];
  branches: Branch[];
  /** 取扱中の商材 */
  products: Product[];
  /** 二重登録の注意書き用 */
  deals: Deal[];
}

export function unitIdOf(ctx: ScheduleDealContext, slug: BusinessUnitSlug): string | null {
  return ctx.units.find((u) => u.slug === slug)?.id ?? ctx.defaultUnitId;
}

/** 事業部で使える商材（全事業部共通 + その事業部専用） */
function productsFor(ctx: ScheduleDealContext, unitId: string | null): Product[] {
  return ctx.products.filter((p) => !p.business_unit_id || p.business_unit_id === unitId);
}

/** 入力値を保存用の値にする。会社名が空なら null（＝登録しない・できない） */
export function toScheduleDealInput(
  draft: ScheduleDealDraft,
  ctx: ScheduleDealContext
): ScheduleDealInput | null {
  if (!draft.enabled) return null;
  const company = draft.company.trim();
  if (!company) return null;
  const unitId = unitIdOf(ctx, draft.unit);
  const products = productsFor(ctx, unitId).filter((p) => draft.product_ids.includes(p.id));
  return {
    business_unit_id: unitId,
    company,
    name: draft.name.trim() || scheduleDealName(company, products.map((p) => p.name)),
    bank_id: draft.bank_id || null,
    branch_id: draft.branch_id || null,
    products,
    // 商材を選んだら金額は明細（標準単価）の合計。案件の金額は明細の合計を正とするため
    amount:
      products.length > 0
        ? products.reduce((sum, p) => sum + p.unit_price, 0)
        : Math.max(0, Number(draft.amount) || 0),
    expected_close: draft.expected_close,
  };
}

export function ScheduleDealSection({
  draft,
  onChange,
  context,
  linkedDeal,
  sourceAppointment,
}: {
  draft: ScheduleDealDraft;
  onChange: (patch: Partial<ScheduleDealDraft>) => void;
  context: ScheduleDealContext;
  /** この予定がすでに紐づいている案件（あれば入力欄は出さない） */
  linkedDeal: Deal | null;
  /** この予定を作った紹介アポ（未案件化）。紹介元はここから引き継ぐ */
  sourceAppointment: Appointment | null;
}) {
  if (linkedDeal) return <LinkedDealCard deal={linkedDeal} />;

  const terms = UNIT_TERMS[draft.unit];
  const unitId = unitIdOf(context, draft.unit);
  const hasBothUnits =
    context.units.some((u) => u.slug === "banking") &&
    context.units.some((u) => u.slug === "alliance");

  // 紹介元の選択肢は選んだ事業部のものだけ（銀行営業の銀行がアライアンスに出ないように）
  const unitBanks = filterByUnit(context.banks, unitId, context.defaultUnitId).filter(
    (b) => b.is_active
  );
  const branchOptions = filterByUnit(context.branches, unitId, context.defaultUnitId).filter(
    (b) => b.bank_id === draft.bank_id && b.status !== "suspended"
  );
  const unitProducts = productsFor(context, unitId);
  const picked = unitProducts.filter((p) => draft.product_ids.includes(p.id));
  const productTotal = picked.reduce((sum, p) => sum + p.unit_price, 0);

  const sameCompany = openDealsOfCompany(
    filterByUnit(context.deals, unitId, context.defaultUnitId),
    draft.company,
    isOpenStage
  );

  const sourceBank = sourceAppointment
    ? context.banks.find((b) => b.id === sourceAppointment.bank_id)
    : undefined;
  const sourceBranch = sourceAppointment
    ? context.branches.find((b) => b.id === sourceAppointment.branch_id)
    : undefined;

  const toggleProduct = (id: string) =>
    onChange({
      product_ids: draft.product_ids.includes(id)
        ? draft.product_ids.filter((x) => x !== id)
        : [...draft.product_ids, id],
    });

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition-colors",
        draft.enabled
          ? "border-cyan-200 bg-cyan-50/40 dark:border-cyan-500/30 dark:bg-cyan-500/5"
          : "border-slate-200 dark:border-slate-700"
      )}
    >
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => onChange({ enabled: e.target.checked })}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-cyan-600"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Briefcase className="h-4 w-4 text-cyan-500" />
            この予定で案件も登録する
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">
            案件管理に「商談予定」として登録します。確度・次のアクションなどの修正は案件管理から行えます
          </span>
        </span>
      </label>

      {draft.enabled && (
        <div className="mt-4 space-y-4">
          {sourceAppointment ? (
            // 紹介アポから来た予定。紹介元はアポのものを引き継ぎ、アポの側も案件化済みにする
            <p className="rounded-xl bg-white/80 px-3.5 py-2.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              {terms.referral}のアポから引き継ぎます：
              <b className="ml-1 text-slate-700 dark:text-slate-200">
                {[sourceBank?.name, sourceBranch?.name].filter(Boolean).join(" ") || "—"}
              </b>
              <span className="mt-0.5 block">
                登録するとアポイントの側も「案件化済み」になります
              </span>
            </p>
          ) : (
            hasBothUnits && (
              <FieldSet label="事業部">
                <UnitSwitch
                  slug={draft.unit}
                  // 事業部が変わると紹介元・商材の選択肢も変わるので、選び直してもらう
                  onChange={(unit) =>
                    onChange({ unit, bank_id: "", branch_id: "", product_ids: [] })
                  }
                  className="w-full sm:w-auto"
                />
              </FieldSet>
            )
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="会社名" required>
              <Input
                value={draft.company}
                onChange={(e) => onChange({ company: e.target.value })}
                placeholder="例: 株式会社サンプル"
              />
            </Field>
            <Field label="案件名">
              <Input
                value={draft.name}
                onChange={(e) => onChange({ name: e.target.value })}
                placeholder={
                  draft.company.trim()
                    ? scheduleDealName(draft.company, picked.map((p) => p.name))
                    : "空欄なら会社名から自動で付けます"
                }
              />
            </Field>
            {!sourceAppointment && (
              <>
                <Field label={`${terms.parent}（任意）`}>
                  <Select
                    value={draft.bank_id}
                    onChange={(e) => onChange({ bank_id: e.target.value, branch_id: "" })}
                  >
                    <option value="">紐づけない</option>
                    {unitBanks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label={`${terms.child}（任意）`}>
                  <Select
                    value={draft.branch_id}
                    onChange={(e) => onChange({ branch_id: e.target.value })}
                    disabled={!draft.bank_id}
                  >
                    <option value="">
                      {draft.bank_id ? "紐づけない（直紹介）" : `先に${terms.parent}を選択`}
                    </option>
                    {branchOptions.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            )}
          </div>

          {unitProducts.length > 0 && (
            <FieldSet label="商材（任意・複数可）">
              <div className="flex flex-wrap gap-1.5">
                {unitProducts.map((p) => {
                  const active = draft.product_ids.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleProduct(p.id)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all active:scale-[0.97]",
                        active
                          ? cn(productColor(p.color), "ring-2 ring-cyan-400/60 dark:ring-cyan-500/50")
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                      )}
                    >
                      <Package className="h-3.5 w-3.5" />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </FieldSet>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {picked.length > 0 ? (
              <FieldSet label="金額">
                <p className="rounded-xl bg-white/80 px-3.5 py-2 dark:bg-slate-900/60">
                  <b className="block text-sm tabular-nums">{formatYen(productTotal)}</b>
                  <span className="block text-[11px] leading-snug text-slate-400">
                    商材の標準単価の合計（調整は案件管理から）
                  </span>
                </p>
              </FieldSet>
            ) : (
              <Field label="金額（円・任意）">
                <Input
                  type="number"
                  min={0}
                  step={10000}
                  value={draft.amount}
                  onChange={(e) => onChange({ amount: e.target.value })}
                  placeholder="0"
                />
                {Number(draft.amount) > 0 && (
                  <p className="mt-1 text-right text-xs font-semibold text-cyan-500 dark:text-cyan-400">
                    {formatYenShort(Number(draft.amount))}
                  </p>
                )}
              </Field>
            )}
            <Field label="完了予定日" required>
              <Input
                type="date"
                value={draft.expected_close}
                onChange={(e) => onChange({ expected_close: e.target.value })}
              />
            </Field>
          </div>

          {sameCompany.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                同じ会社の進行中の案件があります：
                {sameCompany.slice(0, 3).map((d) => (
                  <Link
                    key={d.id}
                    href={`/deals?deal=${d.id}`}
                    className="ml-1 font-semibold underline underline-offset-2"
                  >
                    {d.name}
                  </Link>
                ))}
                <span className="block">
                  同じ商談の続きなら、案件は登録せずに予定だけ作成してください
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** すでに案件に紐づいている予定。修正は案件管理でしてもらう */
export function LinkedDealCard({ deal }: { deal: Deal }) {
  const stage = DEAL_STAGES[deal.stage];
  return (
    <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
        <Briefcase className="h-3.5 w-3.5 text-cyan-500" />
        この予定の案件
      </p>
      <Link
        href={`/deals?deal=${deal.id}`}
        className="group flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 transition-colors hover:bg-cyan-50 dark:bg-slate-800/60 dark:hover:bg-cyan-500/10"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold group-hover:text-cyan-700 dark:group-hover:text-cyan-300">
            {deal.name}
          </span>
          <span className="block truncate text-xs text-slate-400">{deal.company}</span>
        </span>
        <Badge className={stage?.color}>{stage?.label ?? deal.stage}</Badge>
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-cyan-500" />
      </Link>
      <p className="mt-2 text-[11px] text-slate-400">
        案件の修正（ステージ・金額・確度など）は案件管理から行えます
      </p>
    </div>
  );
}
