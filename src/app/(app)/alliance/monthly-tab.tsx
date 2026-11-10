"use client";

// 月次実績（事業計画※確定版『月次実績』と同じ並び）。
//   ① 代理店開拓 … 新規獲得数・累計代理店数・1社あたり紹介数
//   ② 顧客紹介   … 紹介数・成約数・成約率・機器台数・売上・自社利益・★代理店報酬（KGI）
// その下に『プラン別 実績件数』と『成約明細』。数字はすべて案件から自動で集計する。

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { MonthResult, PlanBreakdownRow, Referral } from "@/lib/alliance-kpi";
import { achievement, closeRateOf } from "@/lib/alliance-kpi";
import { monthLabel, monthOf } from "@/lib/alliance";
import type { PlanTotals } from "@/lib/alliance-plan";
import { LineChart } from "@/components/ui/charts";
import { cn, formatDate, formatYenShort } from "@/lib/utils";
import { Card } from "@/components/ui";
import { Rate, StickyTd, StickyTh, TableCard, Td, Th, num, pct, yen } from "./shared";

export function MonthlyTab({
  results,
  totals,
  breakdown,
  planNames,
  closings,
  nameOfBank,
  nameOfBranch,
  selectedMonth,
}: {
  results: MonthResult[];
  totals: PlanTotals;
  breakdown: PlanBreakdownRow[];
  /** プラン別の列（商材マスタの並び。機器は除く） */
  planNames: string[];
  /** 成約明細（計画期間の成約） */
  closings: Referral[];
  nameOfBank: (id: string | null) => string;
  nameOfBranch: (id: string | null) => string;
  selectedMonth: string;
}) {
  const sum = (f: (r: MonthResult) => number) => results.reduce((s, r) => s + f(r), 0);
  const actual = {
    newAgencies: sum((r) => r.actual.newAgencies),
    cumAgencies: results.at(-1)?.actual.cumAgencies ?? 0,
    agencyMonths: sum((r) => r.actual.cumAgencies),
    referrals: sum((r) => r.actual.referrals),
    closings: sum((r) => r.actual.closings),
    devices: sum((r) => r.actual.devices),
    sales: sum((r) => r.actual.sales),
    profit: sum((r) => r.actual.profit),
    fee: sum((r) => r.actual.fee),
  };
  const perAgency =
    actual.agencyMonths > 0 ? Math.round((actual.referrals / actual.agencyMonths) * 10) / 10 : null;

  // 累計代理店報酬の推移（計画 vs 実績）。実績は今月までだけ線を引く
  const labels = results.map((r) => monthLabel(r.month).replace(/^\d{4}年/, ""));
  const lastActual = results.findIndex((r) => r.month > selectedMonth);
  const upto = lastActual === -1 ? results.length : lastActual;

  return (
    <div className="space-y-5">
      <TableCard
        title="月次実績（計画対比）"
        description="紹介数は紹介日、成約・売上・代理店報酬は成約日の月で数えます。代理店数は、1次代理店から初めて紹介が来た月を新規獲得とします（直販は数えません）。"
        minWidth={1680}
      >
        <thead>
          <tr>
            <StickyTh rowSpan={2}>月</StickyTh>
            <Th colSpan={3} className="text-center">新規獲得数</Th>
            <Th colSpan={3} className="text-center">累計代理店数</Th>
            <Th colSpan={2} className="text-center">1社あたり紹介数</Th>
            <Th colSpan={3} className="text-center">紹介数</Th>
            <Th colSpan={3} className="text-center">成約数</Th>
            <Th colSpan={2} className="text-center">成約率</Th>
            <Th rowSpan={2}>機器台数</Th>
            <Th colSpan={3} className="text-center">売上</Th>
            <Th rowSpan={2}>自社利益</Th>
            <Th colSpan={4} className="bg-amber-50/80 text-center text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              ★KGI：代理店報酬
            </Th>
          </tr>
          <tr>
            {["実績", "計画", "達成率", "実績", "計画", "達成率", "実績", "計画", "実績", "計画", "達成率", "実績", "計画", "達成率", "実績", "計画", "実績", "計画", "達成率"].map(
              (h, i) => (
                <Th key={i}>{h}</Th>
              )
            )}
            <Th className="bg-amber-50/80 dark:bg-amber-500/10">実績</Th>
            <Th className="bg-amber-50/80 dark:bg-amber-500/10">計画</Th>
            <Th className="bg-amber-50/80 dark:bg-amber-500/10">達成率</Th>
            <Th className="bg-amber-50/80 dark:bg-amber-500/10">累計実績</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {results.map((r) => {
            const a = r.actual;
            const p = r.plan;
            const current = r.month === selectedMonth;
            return (
              <tr
                key={r.month}
                className={cn(current && "bg-cyan-50/60 dark:bg-cyan-500/5")}
              >
                <StickyTd className={cn(current && "bg-cyan-50 dark:bg-slate-900")}>
                  {monthLabel(r.month)}
                </StickyTd>
                <Td>{num(a.newAgencies)}</Td>
                <Td className="text-slate-400">{num(p.newAgencies)}</Td>
                <Td><Rate value={achievement(a.newAgencies, p.newAgencies)} /></Td>
                <Td>{num(a.cumAgencies)}</Td>
                <Td className="text-slate-400">{num(p.cumAgencies)}</Td>
                <Td><Rate value={achievement(a.cumAgencies, p.cumAgencies)} /></Td>
                <Td>{num(a.perAgencyReferrals, 1)}</Td>
                <Td className="text-slate-400">{num(p.perAgencyReferrals)}</Td>
                <Td className="font-semibold">{num(a.referrals)}</Td>
                <Td className="text-slate-400">{num(p.referrals)}</Td>
                <Td><Rate value={achievement(a.referrals, p.referrals)} /></Td>
                <Td className="font-semibold">{num(a.closings)}</Td>
                <Td className="text-slate-400">{num(p.closings)}</Td>
                <Td><Rate value={achievement(a.closings, p.closings)} /></Td>
                <Td>{pct(a.closeRate)}</Td>
                <Td className="text-slate-400">{pct(p.closeRate)}</Td>
                <Td>{num(a.devices)}</Td>
                <Td>{yen(a.sales)}</Td>
                <Td className="text-slate-400">{yen(p.sales)}</Td>
                <Td><Rate value={achievement(a.sales, p.sales)} /></Td>
                <Td>{yen(a.profit)}</Td>
                <Td className="bg-amber-50/40 font-bold text-amber-700 dark:bg-amber-500/5 dark:text-amber-300">
                  {yen(a.fee)}
                </Td>
                <Td className="bg-amber-50/40 text-slate-400 dark:bg-amber-500/5">{yen(p.fee)}</Td>
                <Td className="bg-amber-50/40 dark:bg-amber-500/5">
                  <Rate value={achievement(a.fee, p.fee)} />
                </Td>
                <Td className="bg-amber-50/40 dark:bg-amber-500/5">{yen(a.cumFee)}</Td>
              </tr>
            );
          })}
          <tr className="bg-slate-50/80 font-bold dark:bg-slate-800/40">
            <StickyTd className="bg-slate-50 dark:bg-slate-800">期間合計</StickyTd>
            <Td>{num(actual.newAgencies)}</Td>
            <Td className="text-slate-400">{num(totals.newAgencies)}</Td>
            <Td><Rate value={achievement(actual.newAgencies, totals.newAgencies)} /></Td>
            <Td>{num(actual.cumAgencies)}</Td>
            <Td className="text-slate-400">{num(totals.endAgencies)}</Td>
            <Td><Rate value={achievement(actual.cumAgencies, totals.endAgencies)} /></Td>
            <Td>{num(perAgency, 1)}</Td>
            <Td className="text-slate-400">{num(totals.perAgencyReferrals)}</Td>
            <Td>{num(actual.referrals)}</Td>
            <Td className="text-slate-400">{num(totals.referrals)}</Td>
            <Td><Rate value={achievement(actual.referrals, totals.referrals)} /></Td>
            <Td>{num(actual.closings)}</Td>
            <Td className="text-slate-400">{num(totals.closings)}</Td>
            <Td><Rate value={achievement(actual.closings, totals.closings)} /></Td>
            <Td>{pct(closeRateOf(actual))}</Td>
            <Td className="text-slate-400">{pct(totals.closeRate)}</Td>
            <Td>{num(actual.devices)}</Td>
            <Td>{yen(actual.sales)}</Td>
            <Td className="text-slate-400">{yen(totals.sales)}</Td>
            <Td><Rate value={achievement(actual.sales, totals.sales)} /></Td>
            <Td>{yen(actual.profit)}</Td>
            <Td className="bg-amber-50/60 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {yen(actual.fee)}
            </Td>
            <Td className="bg-amber-50/60 text-slate-400 dark:bg-amber-500/10">{yen(totals.fee)}</Td>
            <Td className="bg-amber-50/60 dark:bg-amber-500/10">
              <Rate value={achievement(actual.fee, totals.fee)} />
            </Td>
            <Td className="bg-amber-50/60 dark:bg-amber-500/10">{yen(results.at(-1)?.actual.cumFee ?? 0)}</Td>
          </tr>
        </tbody>
      </TableCard>

      <Card className="p-5">
        <h2 className="text-sm font-bold">★代理店報酬の累計（計画 vs 実績）</h2>
        <p className="mt-0.5 text-xs text-slate-400">KGI：代理店をどれだけ儲けさせたか</p>
        <div className="mt-3">
          <LineChart
            labels={labels}
            formatValue={formatYenShort}
            series={[
              {
                name: "計画",
                values: results.map((r) => r.plan.cumFee),
                colorClass: "text-violet-600 dark:text-violet-500",
                dotClass: "bg-violet-600 dark:bg-violet-500",
              },
              {
                name: "実績",
                values: results.slice(0, upto).map((r) => r.actual.cumFee),
                colorClass: "text-cyan-600",
                dotClass: "bg-cyan-600",
              },
            ]}
            tooltip={(i, s) =>
              `${labels[i]} ${s.name}：${yen(s.values[i] ?? 0)}`
            }
          />
        </div>
      </Card>

      <TableCard
        title="プラン別 実績件数"
        description="成約した案件の明細から集計（機器は台数、それ以外は契約数）"
        minWidth={240 + planNames.length * 90}
      >
        <thead>
          <tr>
            <StickyTh>月</StickyTh>
            {planNames.map((n) => (
              <Th key={n}>{n}</Th>
            ))}
            <Th>機器台数</Th>
            <Th>契約数 合計</Th>
            <Th>売上 合計</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {breakdown.map((b) => (
            <tr key={b.month}>
              <StickyTd>{monthLabel(b.month)}</StickyTd>
              {planNames.map((n) => (
                <Td key={n} className={cn(!b.counts[n] && "text-slate-300 dark:text-slate-600")}>
                  {b.counts[n] ? num(b.counts[n]) : "-"}
                </Td>
              ))}
              <Td>{b.devices ? num(b.devices) : "-"}</Td>
              <Td className="font-semibold">{b.contracts ? num(b.contracts) : "-"}</Td>
              <Td>{b.sales ? yen(b.sales) : "-"}</Td>
            </tr>
          ))}
          <tr className="bg-slate-50/80 font-bold dark:bg-slate-800/40">
            <StickyTd className="bg-slate-50 dark:bg-slate-800">期間合計</StickyTd>
            {planNames.map((n) => {
              const c = breakdown.reduce((s, b) => s + (b.counts[n] ?? 0), 0);
              return <Td key={n}>{c ? num(c) : "-"}</Td>;
            })}
            <Td>{num(breakdown.reduce((s, b) => s + b.devices, 0))}</Td>
            <Td>{num(breakdown.reduce((s, b) => s + b.contracts, 0))}</Td>
            <Td>{yen(breakdown.reduce((s, b) => s + b.sales, 0))}</Td>
          </tr>
        </tbody>
      </TableCard>

      <TableCard
        title={`成約明細（${closings.length}件）`}
        description="1成約＝1行。プラン・機器台数は案件の商材明細、金額は商材マスタの単価 × 数量です（直販は代理店報酬ゼロ）。"
        minWidth={1160}
      >
        <thead>
          <tr>
            <Th left>No.</Th>
            <Th left>計上月</Th>
            <Th left>成約日</Th>
            <Th left>1次代理店</Th>
            <Th left>2次代理店</Th>
            <Th left>顧客名</Th>
            <Th left>プラン</Th>
            <Th>機器台数</Th>
            <Th>契約数</Th>
            <Th>売上</Th>
            <Th>自社利益</Th>
            <Th>代理店報酬</Th>
            <Th left>セールスフェーズ</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {closings.length === 0 ? (
            <tr>
              <td colSpan={13} className="py-8 text-center text-sm text-slate-400">
                計画期間の成約はまだありません
              </td>
            </tr>
          ) : (
            closings.map((r, i) => (
              <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                <Td left className="text-slate-400">{i + 1}</Td>
                <Td left>{monthLabel(monthOf(r.wonOn))}</Td>
                <Td left>{formatDate(r.wonOn)}</Td>
                <Td left>{nameOfBank(r.bankId)}</Td>
                <Td left className="text-slate-500">{nameOfBranch(r.branchId)}</Td>
                <Td left className="font-semibold">
                  {r.dealId ? (
                    <Link
                      href={`/deals?deal=${r.dealId}`}
                      className="inline-flex items-center gap-1 hover:text-cyan-600 hover:underline"
                    >
                      {r.company}
                      <ExternalLink className="h-3 w-3 text-slate-300" />
                    </Link>
                  ) : (
                    r.company
                  )}
                </Td>
                <Td left>{r.econ.plans.join(" / ") || "—"}</Td>
                <Td>{r.econ.devices || "—"}</Td>
                <Td>{r.econ.contracts}</Td>
                <Td>{yen(r.econ.sales)}</Td>
                <Td>{yen(r.econ.profit)}</Td>
                <Td className="font-semibold text-amber-700 dark:text-amber-300">
                  {r.econ.direct ? <span className="text-slate-400">直販 ¥0</span> : yen(r.econ.fee)}
                </Td>
                <Td left className="text-slate-500">{r.salesPhase?.label ?? "—"}</Td>
              </tr>
            ))
          )}
        </tbody>
      </TableCard>
    </div>
  );
}
