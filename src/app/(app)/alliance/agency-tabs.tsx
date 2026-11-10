"use client";

// 1次代理店ごとの数字（★案件管理表★『全体管理』右側の集計・『日報生成』の見込み分析）と、
// 販売協力（代理店開拓）の進み具合。

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { AgencyRow, ProspectRow, Referral } from "@/lib/alliance-kpi";
import { closeRateOf } from "@/lib/alliance-kpi";
import { BALLS, DEAL_KINDS, PARTNERSHIP_PHASES, monthLabel, partnershipPhaseByKey } from "@/lib/alliance";
import { cn, formatDate } from "@/lib/utils";
import { Badge, Card } from "@/components/ui";
import { StickyTd, StickyTh, TableCard, Td, Th, num, pct, yen } from "./shared";

// =============================================================
// 代理店別（当月 / 全期間累計）
// =============================================================
export function AgencyTab({
  month,
  monthRows,
  allRows,
  starts,
  secondaryCounts,
}: {
  month: string;
  monthRows: AgencyRow[];
  allRows: AgencyRow[];
  /** 1次代理店ごとの初回紹介日（新規獲得の日） */
  starts: Map<string, string>;
  /** 1次代理店ごとの2次代理店（紹介をくれた窓口）の数 */
  secondaryCounts: Map<string, number>;
}) {
  const sum = (rows: AgencyRow[], f: (r: AgencyRow) => number) => rows.reduce((s, r) => s + f(r), 0);
  const totalOf = (rows: AgencyRow[]) => ({
    referrals: sum(rows, (r) => r.tally.referrals),
    closings: sum(rows, (r) => r.tally.closings),
    fee: sum(rows, (r) => r.tally.fee),
    sales: sum(rows, (r) => r.tally.sales),
  });
  const mt = totalOf(monthRows);
  const at = totalOf(allRows);

  return (
    <TableCard
      title="1次代理店別 実績"
      description={`当月（${monthLabel(month)}）と全期間の累計。代理店支払い分＝成約した案件の代理店報酬（直販は 0）`}
      minWidth={1100}
    >
      <thead>
        <tr>
          <StickyTh rowSpan={2}>1次代理店</StickyTh>
          <Th rowSpan={2}>初回紹介日</Th>
          <Th rowSpan={2}>2次代理店</Th>
          <Th colSpan={4} className="text-center">当月実績（{monthLabel(month)}）</Th>
          <Th colSpan={5} className="text-center">全期間 累計実績</Th>
        </tr>
        <tr>
          <Th>紹介数</Th>
          <Th>成約数</Th>
          <Th>成約率</Th>
          <Th>代理店支払い分</Th>
          <Th>紹介数</Th>
          <Th>成約数</Th>
          <Th>成約率</Th>
          <Th>売上</Th>
          <Th>代理店支払い分</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
        {allRows.map((all) => {
          const m = monthRows.find((r) => r.key === all.key)?.tally;
          const start = all.bankId ? starts.get(all.bankId) : undefined;
          const quiet = all.bankId && (m?.referrals ?? 0) === 0;
          return (
            <tr key={all.key}>
              <StickyTd>
                <span className="flex items-center gap-2">
                  {all.name}
                  {quiet && (
                    <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      当月紹介なし
                    </Badge>
                  )}
                </span>
              </StickyTd>
              <Td className="text-slate-500">{start ? formatDate(start) : "—"}</Td>
              <Td className="text-slate-500">
                {all.bankId ? `${num(secondaryCounts.get(all.bankId) ?? 0)}社` : "—"}
              </Td>
              <Td className="font-semibold">{num(m?.referrals ?? 0)}</Td>
              <Td>{num(m?.closings ?? 0)}</Td>
              <Td>{pct(m ? closeRateOf(m) : null)}</Td>
              <Td className="text-amber-700 dark:text-amber-300">{yen(m?.fee ?? 0)}</Td>
              <Td className="font-semibold">{num(all.tally.referrals)}</Td>
              <Td>{num(all.tally.closings)}</Td>
              <Td>{pct(closeRateOf(all.tally))}</Td>
              <Td>{yen(all.tally.sales)}</Td>
              <Td className="font-semibold text-amber-700 dark:text-amber-300">{yen(all.tally.fee)}</Td>
            </tr>
          );
        })}
        <tr className="bg-slate-50/80 font-bold dark:bg-slate-800/40">
          <StickyTd className="bg-slate-50 dark:bg-slate-800">合計</StickyTd>
          <Td />
          <Td />
          <Td>{num(mt.referrals)}</Td>
          <Td>{num(mt.closings)}</Td>
          <Td>{pct(closeRateOf(mt))}</Td>
          <Td className="text-amber-700 dark:text-amber-300">{yen(mt.fee)}</Td>
          <Td>{num(at.referrals)}</Td>
          <Td>{num(at.closings)}</Td>
          <Td>{pct(closeRateOf(at))}</Td>
          <Td>{yen(at.sales)}</Td>
          <Td className="text-amber-700 dark:text-amber-300">{yen(at.fee)}</Td>
        </tr>
      </tbody>
    </TableCard>
  );
}

// =============================================================
// 見込み分析（確度 A/B/C）
// =============================================================
export function ProspectTab({
  rows,
  prospects,
  nameOfBank,
}: {
  rows: ProspectRow[];
  /** 見込み（後追い中で確度 A/B/C）の紹介 */
  prospects: Referral[];
  nameOfBank: (id: string | null) => string;
}) {
  const total = rows.reduce(
    (t, r) => ({
      A: t.A + r.A,
      B: t.B + r.B,
      C: t.C + r.C,
      count: t.count + r.count,
      sales: t.sales + r.sales,
      profit: t.profit + r.profit,
      fee: t.fee + r.fee,
      noPlan: t.noPlan + r.noPlan,
    }),
    { A: 0, B: 0, C: 0, count: 0, sales: 0, profit: 0, fee: 0, noPlan: 0 }
  );
  const rankOrder = { A: 0, B: 1, C: 2 } as Record<string, number>;
  return (
    <div className="space-y-5">
      <TableCard
        title="【見込み分析】セールス見込み確度別（A/B/C）"
        description="セールスフェーズが見込みA・B・Cの案件。金額は載っているプラン・機器から（プラン未定の案件は件数だけ数えます）"
        minWidth={980}
      >
        <thead>
          <tr>
            <StickyTh>1次代理店</StickyTh>
            <Th>見込みA</Th>
            <Th>見込みB</Th>
            <Th>見込みC</Th>
            <Th>見込み案件数 計</Th>
            <Th>見込み売上</Th>
            <Th>見込み自社利益</Th>
            <Th>見込み代理店支払額</Th>
            <Th left>備考</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((r) => (
            <tr key={r.key}>
              <StickyTd>{r.name}</StickyTd>
              <Td className={cn(r.A > 0 && "font-bold text-rose-600 dark:text-rose-400")}>{num(r.A)}</Td>
              <Td className={cn(r.B > 0 && "font-semibold text-orange-600 dark:text-orange-400")}>{num(r.B)}</Td>
              <Td>{num(r.C)}</Td>
              <Td className="font-semibold">{num(r.count)}</Td>
              <Td>{yen(r.sales)}</Td>
              <Td>{yen(r.profit)}</Td>
              <Td className="text-amber-700 dark:text-amber-300">{yen(r.fee)}</Td>
              <Td left className="text-xs text-slate-400">
                {r.noPlan > 0 ? `プラン未定 ${r.noPlan}件` : r.key === "__direct__" && r.count > 0 ? "直販のため支払¥0" : ""}
              </Td>
            </tr>
          ))}
          <tr className="bg-slate-50/80 font-bold dark:bg-slate-800/40">
            <StickyTd className="bg-slate-50 dark:bg-slate-800">合計</StickyTd>
            <Td>{num(total.A)}</Td>
            <Td>{num(total.B)}</Td>
            <Td>{num(total.C)}</Td>
            <Td>{num(total.count)}</Td>
            <Td>{yen(total.sales)}</Td>
            <Td>{yen(total.profit)}</Td>
            <Td className="text-amber-700 dark:text-amber-300">{yen(total.fee)}</Td>
            <Td left className="text-xs font-normal text-slate-400">
              {total.noPlan > 0 ? `プラン未定 ${total.noPlan}件` : ""}
            </Td>
          </tr>
        </tbody>
      </TableCard>

      <TableCard title={`見込み案件（${prospects.length}件）`} minWidth={820}>
        <thead>
          <tr>
            <Th left>確度</Th>
            <Th left>企業名</Th>
            <Th left>1次代理店</Th>
            <Th left>プラン</Th>
            <Th>見込み売上</Th>
            <Th>代理店報酬</Th>
            <Th left>商談実施日</Th>
            <Th left>担当</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...prospects]
            .sort((a, b) => (rankOrder[a.rank] ?? 9) - (rankOrder[b.rank] ?? 9) || b.econ.sales - a.econ.sales)
            .map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <Td left>
                  <Badge className={r.salesPhase?.color}>{r.salesPhase?.label ?? `見込み${r.rank}`}</Badge>
                </Td>
                <Td left className="font-semibold">
                  {r.dealId ? (
                    <Link href={`/deals?deal=${r.dealId}`} className="inline-flex items-center gap-1 hover:text-cyan-600 hover:underline">
                      {r.company}
                      <ExternalLink className="h-3 w-3 text-slate-300" />
                    </Link>
                  ) : (
                    r.company
                  )}
                </Td>
                <Td left>{nameOfBank(r.bankId)}</Td>
                <Td left className="text-slate-500">{r.econ.plans.join(" / ") || "未定"}</Td>
                <Td>{r.econ.sales ? yen(r.econ.sales) : "—"}</Td>
                <Td className="text-amber-700 dark:text-amber-300">{r.econ.fee ? yen(r.econ.fee) : "—"}</Td>
                <Td left className="text-slate-500">{r.metOn ? formatDate(r.metOn) : "—"}</Td>
                <Td left className="text-slate-500">{r.ownerName || "—"}</Td>
              </tr>
            ))}
        </tbody>
      </TableCard>
    </div>
  );
}

// =============================================================
// 販売協力（代理店開拓）
// =============================================================
export function PartnershipTab({
  funnel,
  referrals,
  ballOf,
  nameOfBank,
  nameOfBranch,
}: {
  funnel: Map<string, number>;
  /** 販売協力の線がある紹介（販売協力・兼販売協力・フェーズの入ったセールス） */
  referrals: Referral[];
  ballOf: (dealId: string | null) => string;
  nameOfBank: (id: string | null) => string;
  nameOfBranch: (id: string | null) => string;
}) {
  const unset = funnel.get("") ?? 0;
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="text-sm font-bold">販売協力フェーズ別の件数</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          「契約締結」以降（契約締結・初回紹介済み・成約獲得）が代理店契約を結んだ数です
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {PARTNERSHIP_PHASES.map((p) => (
            <div
              key={p.key}
              className={cn(
                "rounded-xl border px-3 py-2.5",
                p.contracted
                  ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                  : "border-slate-200 dark:border-slate-700"
              )}
            >
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{p.label}</p>
              <p className="mt-0.5 text-xl font-bold tabular-nums">{num(funnel.get(p.key) ?? 0)}</p>
            </div>
          ))}
          {unset > 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 px-3 py-2.5 dark:border-slate-700">
              <p className="text-[11px] font-semibold text-slate-400">未設定（‐）</p>
              <p className="mt-0.5 text-xl font-bold text-slate-400 tabular-nums">{num(unset)}</p>
            </div>
          )}
        </div>
      </Card>

      <TableCard title={`販売協力の紹介（${referrals.length}件）`} minWidth={1080}>
        <thead>
          <tr>
            <Th left>紹介日</Th>
            <Th left>1次代理店</Th>
            <Th left>2次代理店</Th>
            <Th left>企業名</Th>
            <Th left>商談種別</Th>
            <Th left>販売協力フェーズ</Th>
            <Th left>契約締結日</Th>
            <Th left>対応</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...referrals]
            .sort((a, b) => b.referredOn.localeCompare(a.referredOn))
            .map((r) => {
              const phase = partnershipPhaseByKey(r.partnershipPhase);
              const ball = BALLS[ballOf(r.dealId)];
              return (
                <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <Td left className="text-slate-500">{r.referredOn ? formatDate(r.referredOn) : "—"}</Td>
                  <Td left>{nameOfBank(r.bankId)}</Td>
                  <Td left className="text-slate-500">{nameOfBranch(r.branchId)}</Td>
                  <Td left className="font-semibold">
                    {r.dealId ? (
                      <Link href={`/deals?deal=${r.dealId}`} className="inline-flex items-center gap-1 hover:text-cyan-600 hover:underline">
                        {r.company}
                        <ExternalLink className="h-3 w-3 text-slate-300" />
                      </Link>
                    ) : (
                      r.company
                    )}
                  </Td>
                  <Td left>
                    <Badge className={DEAL_KINDS[r.kind].color}>{DEAL_KINDS[r.kind].short}</Badge>
                  </Td>
                  <Td left>{phase ? <Badge className={phase.color}>{phase.label}</Badge> : <span className="text-slate-400">‐</span>}</Td>
                  <Td left className="text-slate-500">
                    {r.partnershipContractedOn ? formatDate(r.partnershipContractedOn) : "—"}
                  </Td>
                  <Td left>{ball ? <Badge className={ball.color}>{ball.label}</Badge> : <span className="text-slate-400">‐</span>}</Td>
                </tr>
              );
            })}
        </tbody>
      </TableCard>
    </div>
  );
}
