"use client";

// アライアンス営業の案件だけに出す項目（★案件管理表★『全体管理』の列）。
//
//   入力フォーム … 紹介日・商談実施日・商談種別・セールスフェーズ・販売協力フェーズ・
//                  成約日/ロスト日・失注理由・契約締結日・設置日・代理店支払日・対応・契約備考・月額など
//   案件の詳細   … 同じ項目の表示と、シートのプルダウンと同じ感覚で変えられる3つのセレクト
//                  （セールスフェーズ・販売協力フェーズ・対応）
//
// セールスフェーズを選ぶと、ステージ・確度ランク・受注後フェーズはそこから決まる
// （lib/alliance.ts の applySalesPhase。保存は親が行う）。

import type { ReactNode } from "react";
import { Handshake } from "lucide-react";
import {
  BALLS,
  BALL_KEYS,
  DEAL_KINDS,
  DEAL_KIND_KEYS,
  PARTNERSHIP_PHASES,
  SALES_PHASES,
  SALES_PHASE_GROUPS,
  hasPartnershipTrack,
  hasSalesTrack,
  kindOf,
  partnershipPhaseByKey,
  salesPhaseByKey,
  salesPhaseOf,
  type DealKind,
} from "@/lib/alliance";
import { cn, formatDate, formatYen, todayStr } from "@/lib/utils";
import type { Deal } from "@/lib/types";
import { Badge, Field, Input, Select } from "@/components/ui";
import type { DealFormValues } from "./shared";

function SalesPhaseOptions() {
  return (
    <>
      {SALES_PHASE_GROUPS.map((g) => (
        <optgroup key={g.key} label={g.label}>
          {SALES_PHASES.filter((p) => p.group === g.key).map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

// =============================================================
// 入力フォーム
// =============================================================
export function AllianceFormFields({
  values,
  set,
}: {
  values: DealFormValues;
  set: <K extends keyof DealFormValues>(key: K, v: DealFormValues[K]) => void;
}) {
  const kind = (values.deal_kind || "sales") as DealKind;
  const phase = salesPhaseByKey(values.sales_phase);
  const won = phase?.stage === "won";
  const lost = phase?.stage === "lost";
  const contracted = partnershipPhaseByKey(values.partnership_phase)?.contracted ?? false;

  return (
    <>
      <Field label="紹介日">
        <Input
          type="date"
          value={values.referred_at}
          onChange={(e) => set("referred_at", e.target.value)}
        />
      </Field>
      <Field label="商談実施日">
        <Input
          type="date"
          value={values.visited_at}
          onChange={(e) => set("visited_at", e.target.value)}
        />
      </Field>
      <Field label="商談種別">
        <Select value={kind} onChange={(e) => set("deal_kind", e.target.value)}>
          {DEAL_KIND_KEYS.map((k) => (
            <option key={k} value={k}>
              {DEAL_KINDS[k].label}
            </option>
          ))}
        </Select>
      </Field>
      {hasSalesTrack(kind) ? (
        <Field label="セールスフェーズ">
          <Select value={values.sales_phase} onChange={(e) => set("sales_phase", e.target.value)}>
            <option value="">‐（未設定）</option>
            <SalesPhaseOptions />
          </Select>
          <span className="mt-1 block text-[11px] text-slate-400">
            ステージ・確度ランク・受注後フェーズはここから決まります
          </span>
        </Field>
      ) : (
        <Field label="セールスフェーズ">
          <Input value="‐（販売協力のみ）" disabled />
        </Field>
      )}
      {won && (
        <Field label="成約日">
          <Input
            type="date"
            value={values.contracted_at}
            onChange={(e) => set("contracted_at", e.target.value)}
          />
          <span className="mt-1 block text-[11px] text-slate-400">
            空欄なら保存した日。月次の成約数はこの日の月で数えます
          </span>
        </Field>
      )}
      {lost && (
        <>
          <Field label="ロスト日">
            <Input type="date" value={values.lost_at} onChange={(e) => set("lost_at", e.target.value)} />
          </Field>
          <Field label="失注理由">
            <Input
              value={values.loss_reason}
              onChange={(e) => set("loss_reason", e.target.value)}
              placeholder="例: 他社導入済み"
            />
          </Field>
        </>
      )}
      <Field label="販売協力フェーズ">
        <Select
          value={values.partnership_phase}
          onChange={(e) => set("partnership_phase", e.target.value)}
        >
          <option value="">‐</option>
          {PARTNERSHIP_PHASES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </Select>
        {!hasPartnershipTrack(kind) && (
          <span className="mt-1 block text-[11px] text-slate-400">
            セールスの紹介でも、代理店になってもらう話が出たら入れてください
          </span>
        )}
      </Field>
      {(contracted || values.partnership_contracted_at) && (
        <Field label="契約締結日（代理店契約）">
          <Input
            type="date"
            value={values.partnership_contracted_at}
            onChange={(e) => set("partnership_contracted_at", e.target.value)}
          />
        </Field>
      )}
      <Field label="対応（ボール）">
        <Select value={values.ball} onChange={(e) => set("ball", e.target.value)}>
          <option value="">‐</option>
          {BALL_KEYS.map((k) => (
            <option key={k} value={k}>
              {BALLS[k].label}
            </option>
          ))}
        </Select>
      </Field>
      {won && (
        <>
          <Field label="設置日">
            <Input
              type="date"
              value={values.installed_at}
              onChange={(e) => set("installed_at", e.target.value)}
            />
          </Field>
          <Field label="代理店支払日">
            <Input
              type="date"
              value={values.agency_paid_at}
              onChange={(e) => set("agency_paid_at", e.target.value)}
            />
          </Field>
        </>
      )}
      <Field label="契約備考" className="sm:col-span-2">
        <Input
          value={values.contract_note}
          onChange={(e) => set("contract_note", e.target.value)}
          placeholder="例: 関連会社4社まとめて契約"
        />
      </Field>
      <details className="rounded-xl border border-slate-200 px-3.5 py-2.5 sm:col-span-2 dark:border-slate-700">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400">
          月額・工事費・ストック分（任意。記録のみで集計には使いません）
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <Field label="月額（円）">
            <Input
              type="number"
              min={0}
              value={values.monthly_fee || ""}
              onChange={(e) => set("monthly_fee", Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="工事費（円）">
            <Input
              type="number"
              min={0}
              value={values.construction_fee || ""}
              onChange={(e) => set("construction_fee", Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="ストック分（円）">
            <Input
              type="number"
              min={0}
              value={values.stock_amount || ""}
              onChange={(e) => set("stock_amount", Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>
      </details>
    </>
  );
}

// =============================================================
// 案件の詳細
// =============================================================

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-0.5 truncate text-sm font-medium">{children}</div>
    </div>
  );
}

const dateOr = (d: string | undefined) => (d ? formatDate(d) : "—");

export function AllianceDealPanel({
  deal,
  primaryName,
  secondaryName,
  onSalesPhase,
  onPatch,
}: {
  deal: Deal;
  /** 1次代理店名（"" = 直販） */
  primaryName: string;
  /** 2次代理店名（"" = 直紹介） */
  secondaryName: string;
  /** セールスフェーズを変える（ステージなども揃えて保存するのは親） */
  onSalesPhase: (deal: Deal, phaseKey: string) => void;
  /** そのまま保存してよい項目の変更（販売協力フェーズ・対応） */
  onPatch: (deal: Deal, patch: Partial<Deal>, note: string) => void;
}) {
  const kind = kindOf(deal);
  const phase = salesPhaseOf(deal);
  const partner = partnershipPhaseByKey(deal.partnership_phase);
  const ball = deal.ball ? BALLS[deal.ball] : undefined;

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <Handshake className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">案件管理表の項目</span>
        <Badge className={DEAL_KINDS[kind].color}>{DEAL_KINDS[kind].label}</Badge>
        {ball && <Badge className={ball.color}>{ball.label}</Badge>}
      </div>

      {/* シートのプルダウンと同じ3つは、ここからすぐ変えられる */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="セールスフェーズ">
          {hasSalesTrack(kind) ? (
            <Select
              value={phase?.key ?? ""}
              onChange={(e) => e.target.value && onSalesPhase(deal, e.target.value)}
              className={cn("h-9 py-0 text-sm", phase && phase.color)}
            >
              {!phase && <option value="">‐（未設定）</option>}
              <SalesPhaseOptions />
            </Select>
          ) : (
            <Input value="‐（販売協力のみ）" disabled className="h-9 py-0 text-sm" />
          )}
        </Field>
        <Field label="販売協力フェーズ">
          <Select
            value={deal.partnership_phase ?? ""}
            onChange={(e) => {
              const next = partnershipPhaseByKey(e.target.value);
              const patch: Partial<Deal> = { partnership_phase: e.target.value };
              // 契約締結に進めたら、契約締結日を当日で入れておく（月次の新規契約はこの日で数える）
              if (next?.contracted && !deal.partnership_contracted_at) {
                patch.partnership_contracted_at = todayStr();
              }
              onPatch(deal, patch, `販売協力フェーズを「${next?.label ?? "‐"}」に変更`);
            }}
            className={cn("h-9 py-0 text-sm", partner && partner.color)}
          >
            <option value="">‐</option>
            {PARTNERSHIP_PHASES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="対応">
          <Select
            value={deal.ball ?? ""}
            onChange={(e) =>
              onPatch(
                deal,
                { ball: e.target.value },
                `対応を「${BALLS[e.target.value]?.label ?? "‐"}」に変更`
              )
            }
            className={cn("h-9 py-0 text-sm", ball && ball.color)}
          >
            <option value="">‐</option>
            {BALL_KEYS.map((k) => (
              <option key={k} value={k}>
                {BALLS[k].label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Item label="紹介日">{dateOr(deal.referred_at)}</Item>
        <Item label="商談実施日">{dateOr(deal.visited_at)}</Item>
        <Item label="1次代理店">{primaryName || "直販"}</Item>
        <Item label="2次代理店">{secondaryName || "直紹介"}</Item>
        {deal.stage === "won" && <Item label="成約日">{dateOr(deal.contracted_at)}</Item>}
        {deal.stage === "lost" && <Item label="ロスト日">{dateOr(deal.lost_at)}</Item>}
        {deal.stage === "lost" && <Item label="失注理由">{deal.loss_reason || "—"}</Item>}
        {(partner?.contracted || deal.partnership_contracted_at) && (
          <Item label="契約締結日">{dateOr(deal.partnership_contracted_at)}</Item>
        )}
        {deal.stage === "won" && <Item label="設置日">{dateOr(deal.installed_at)}</Item>}
        {deal.stage === "won" && <Item label="代理店支払日">{dateOr(deal.agency_paid_at)}</Item>}
        {deal.contract_note && <Item label="契約備考">{deal.contract_note}</Item>}
        {(deal.monthly_fee ?? 0) > 0 && <Item label="月額">{formatYen(deal.monthly_fee ?? 0)}</Item>}
        {(deal.construction_fee ?? 0) > 0 && (
          <Item label="工事費">{formatYen(deal.construction_fee ?? 0)}</Item>
        )}
        {(deal.stock_amount ?? 0) > 0 && <Item label="ストック分">{formatYen(deal.stock_amount ?? 0)}</Item>}
      </div>
    </div>
  );
}
