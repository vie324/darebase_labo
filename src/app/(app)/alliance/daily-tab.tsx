"use client";

// 日報（★案件管理表★『日報生成』と同じ3つの表）。
//   【日報】       指定日の 1次代理店別 紹介数・商談実施（種別ごと）・成約・ロスト・売上・粗利・代理店支払額
//   【月次集計】   指定日の月の 1次代理店別 集計と、計画（紹介総数・1社あたり紹介目標）に対する進捗
//   【月次計画進捗管理】 全社の目標 vs 実績（当月・計画期間の累計）
// 日報はそのまま共有できる文面にしてコピーできる。

import type { AgencyRow, MonthResult, Tally } from "@/lib/alliance-kpi";
import { achievement, closeRateOf } from "@/lib/alliance-kpi";
import { DEAL_KINDS, DEAL_KIND_KEYS, monthLabel } from "@/lib/alliance";
import type { PlanMonth, PlanTotals } from "@/lib/alliance-plan";
import { cn } from "@/lib/utils";
import { Badge, Card, Field, Input } from "@/components/ui";
import { CopyButton, Rate, StickyTd, StickyTh, TableCard, Td, Th, TextPreview, num, pct, yen } from "./shared";

function AgencyDayRows({ rows, total }: { rows: AgencyRow[]; total: Tally }) {
  return (
    <>
      {rows.map((r) => (
        <tr key={r.key}>
          <StickyTd>{r.name}</StickyTd>
          <Td className={cn(!r.tally.referrals && "text-slate-300 dark:text-slate-600")}>
            {num(r.tally.referrals)}
          </Td>
          {DEAL_KIND_KEYS.map((k) => (
            <Td key={k} className={cn(!r.tally.meetingsByKind[k] && "text-slate-300 dark:text-slate-600")}>
              {num(r.tally.meetingsByKind[k])}
            </Td>
          ))}
          <Td className="font-semibold">{num(r.tally.meetings)}</Td>
          <Td>{num(r.tally.closings)}</Td>
          <Td>{num(r.tally.lost)}</Td>
          <Td>{yen(r.tally.sales)}</Td>
          <Td>{yen(r.tally.profit)}</Td>
          <Td className="text-amber-700 dark:text-amber-300">{yen(r.tally.fee)}</Td>
        </tr>
      ))}
      <tr className="bg-slate-50/80 font-bold dark:bg-slate-800/40">
        <StickyTd className="bg-slate-50 dark:bg-slate-800">合計</StickyTd>
        <Td>{num(total.referrals)}</Td>
        {DEAL_KIND_KEYS.map((k) => (
          <Td key={k}>{num(total.meetingsByKind[k])}</Td>
        ))}
        <Td>{num(total.meetings)}</Td>
        <Td>{num(total.closings)}</Td>
        <Td>{num(total.lost)}</Td>
        <Td>{yen(total.sales)}</Td>
        <Td>{yen(total.profit)}</Td>
        <Td className="text-amber-700 dark:text-amber-300">{yen(total.fee)}</Td>
      </tr>
    </>
  );
}

export function DailyTab({
  day,
  onDayChange,
  dayRows,
  dayTotal,
  monthRows,
  monthTotal,
  monthResult,
  periodResults,
  totals,
  partnershipContractsInMonth,
  partnershipContractsInPeriod,
  reportText,
}: {
  day: string;
  onDayChange: (day: string) => void;
  dayRows: AgencyRow[];
  dayTotal: Tally;
  /** 指定日の月の1次代理店別 */
  monthRows: AgencyRow[];
  monthTotal: Tally;
  /** 指定日の月の計画対比（計画期間外なら null） */
  monthResult: MonthResult | null;
  /** 計画期間の各月（累計の進捗に使う） */
  periodResults: MonthResult[];
  totals: PlanTotals;
  partnershipContractsInMonth: number;
  partnershipContractsInPeriod: number;
  reportText: string;
}) {
  const month = day.slice(0, 7);
  const plan: PlanMonth | null = monthResult?.plan ?? null;
  const upToMonth = periodResults.filter((r) => r.month <= month);
  const cum = (f: (r: MonthResult) => number) => upToMonth.reduce((s, r) => s + f(r), 0);
  const cumAgencies = upToMonth.at(-1)?.actual.cumAgencies ?? 0;

  const progressRows: {
    group: string;
    label: string;
    planMonth: number | null;
    actualMonth: number;
    planPeriod: number | null;
    actualPeriod: number;
    money?: boolean;
    kgi?: boolean;
    note: string;
  }[] = [
    {
      group: "代理店開拓",
      label: "新規獲得数（1次代理店）",
      planMonth: plan?.newAgencies ?? null,
      actualMonth: monthResult?.actual.newAgencies ?? 0,
      planPeriod: totals.newAgencies,
      actualPeriod: cum((r) => r.actual.newAgencies),
      note: "1次代理店から初めて紹介が来た月で数える",
    },
    {
      group: "代理店開拓",
      label: "累計代理店数",
      planMonth: plan?.cumAgencies ?? null,
      actualMonth: monthResult?.actual.cumAgencies ?? cumAgencies,
      planPeriod: totals.endAgencies,
      actualPeriod: cumAgencies,
      note: "月末までに紹介が来ている1次代理店（直販は除く）",
    },
    {
      group: "代理店開拓",
      label: "販売協力 契約締結",
      planMonth: null,
      actualMonth: partnershipContractsInMonth,
      planPeriod: null,
      actualPeriod: partnershipContractsInPeriod,
      note: "販売協力フェーズが「契約締結」以降（契約締結日で数える）",
    },
    {
      group: "顧客紹介",
      label: "案件紹介数",
      planMonth: plan?.referrals ?? null,
      actualMonth: monthTotal.referrals,
      planPeriod: totals.referrals,
      actualPeriod: cum((r) => r.actual.referrals),
      note: "紹介日で数える（商談種別を問わない）",
    },
    {
      group: "顧客紹介",
      label: "商談実施数（セールス）",
      planMonth: plan?.referrals ?? null,
      actualMonth: monthTotal.salesMeetings,
      planPeriod: totals.referrals,
      actualPeriod: cum((r) => r.actual.salesMeetings),
      note: "セールス＋セールス兼販売協力。計画は紹介総数と同じ数",
    },
    {
      group: "顧客紹介",
      label: "成約数",
      planMonth: plan?.closings ?? null,
      actualMonth: monthTotal.closings,
      planPeriod: totals.closings,
      actualPeriod: cum((r) => r.actual.closings),
      note: "成約日で数える",
    },
    {
      group: "顧客紹介",
      label: "売上高",
      planMonth: plan?.sales ?? null,
      actualMonth: monthTotal.sales,
      planPeriod: totals.sales,
      actualPeriod: cum((r) => r.actual.sales),
      money: true,
      note: "成約した案件のプラン・機器の売上",
    },
    {
      group: "顧客紹介",
      label: "自社利益（粗利）",
      planMonth: plan?.profit ?? null,
      actualMonth: monthTotal.profit,
      planPeriod: totals.profit,
      actualPeriod: cum((r) => r.actual.profit),
      money: true,
      note: "直販は代理店報酬ぶんも自社利益",
    },
    {
      group: "★ KGI",
      label: "代理店報酬（支払総額）",
      planMonth: plan?.fee ?? null,
      actualMonth: monthTotal.fee,
      planPeriod: totals.fee,
      actualPeriod: cum((r) => r.actual.fee),
      money: true,
      kgi: true,
      note: "代理店をどれだけ儲けさせたか（直販は除く）",
    },
  ];

  const fmt = (v: number | null, money?: boolean) => (v === null ? "—" : money ? yen(v) : num(v));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <TableCard
          title={`【日報】指定日の商談実績・紹介数（${day.replace(/-/g, "/")}）`}
          description="紹介数は紹介日、商談は商談実施日、成約・ロストは成約日・ロスト日がこの日のもの"
          actions={
            <Field label="日報の対象日" className="w-44">
              <Input type="date" value={day} onChange={(e) => e.target.value && onDayChange(e.target.value)} />
            </Field>
          }
          minWidth={980}
        >
          <thead>
            <tr>
              <StickyTh>1次代理店</StickyTh>
              <Th>案件紹介数</Th>
              {DEAL_KIND_KEYS.map((k) => (
                <Th key={k}>{DEAL_KINDS[k].label}</Th>
              ))}
              <Th>商談実施 合計</Th>
              <Th>成約</Th>
              <Th>ロスト</Th>
              <Th>売上</Th>
              <Th>粗利</Th>
              <Th>代理店支払額</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            <AgencyDayRows rows={dayRows} total={dayTotal} />
          </tbody>
        </TableCard>

        <Card className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">日報の文面</h2>
            <CopyButton text={reportText} />
          </div>
          <TextPreview text={reportText} />
          <p className="text-[11px] text-slate-400">チャット・LINE にそのまま貼れます</p>
        </Card>
      </div>

      <TableCard
        title={`【月次集計】1次代理店別 商談種別実績・計画進捗（${monthLabel(month)}）`}
        description={
          plan
            ? `計画：紹介総数 ${plan.referrals}件 ／ 1社あたり紹介目標 ${plan.perAgencyReferrals}件（切上げ目安）`
            : "この月は計画期間の外です"
        }
        minWidth={1180}
      >
        <thead>
          <tr>
            <StickyTh>1次代理店</StickyTh>
            <Th>案件紹介数</Th>
            {DEAL_KIND_KEYS.map((k) => (
              <Th key={k}>{DEAL_KINDS[k].label}</Th>
            ))}
            <Th>商談実施（セールス計）</Th>
            <Th>商談実施 合計</Th>
            <Th>成約</Th>
            <Th>ロスト</Th>
            <Th>成約率</Th>
            <Th>1社あたり紹介目標</Th>
            <Th>紹介進捗率</Th>
            <Th>代理店報酬</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {monthRows.map((r) => {
            const target = r.bankId && plan ? plan.perAgencyReferrals : null;
            return (
              <tr key={r.key}>
                <StickyTd>{r.name}</StickyTd>
                <Td className="font-semibold">{num(r.tally.referrals)}</Td>
                {DEAL_KIND_KEYS.map((k) => (
                  <Td key={k}>{num(r.tally.meetingsByKind[k])}</Td>
                ))}
                <Td>{num(r.tally.salesMeetings)}</Td>
                <Td>{num(r.tally.meetings)}</Td>
                <Td>{num(r.tally.closings)}</Td>
                <Td>{num(r.tally.lost)}</Td>
                <Td>{pct(closeRateOf(r.tally))}</Td>
                <Td className="text-slate-400">{target === null ? "—" : num(target)}</Td>
                <Td>
                  {target === null ? <span className="text-slate-300">—</span> : <Rate value={achievement(r.tally.referrals, target)} />}
                </Td>
                <Td className="text-amber-700 dark:text-amber-300">{yen(r.tally.fee)}</Td>
              </tr>
            );
          })}
          <tr className="bg-slate-50/80 font-bold dark:bg-slate-800/40">
            <StickyTd className="bg-slate-50 dark:bg-slate-800">合計</StickyTd>
            <Td>{num(monthTotal.referrals)}</Td>
            {DEAL_KIND_KEYS.map((k) => (
              <Td key={k}>{num(monthTotal.meetingsByKind[k])}</Td>
            ))}
            <Td>{num(monthTotal.salesMeetings)}</Td>
            <Td>{num(monthTotal.meetings)}</Td>
            <Td>{num(monthTotal.closings)}</Td>
            <Td>{num(monthTotal.lost)}</Td>
            <Td>{pct(closeRateOf(monthTotal))}</Td>
            <Td className="text-slate-400">{plan ? `計 ${num(plan.referrals)}` : "—"}</Td>
            <Td>{plan ? <Rate value={achievement(monthTotal.referrals, plan.referrals)} /> : "—"}</Td>
            <Td className="text-amber-700 dark:text-amber-300">{yen(monthTotal.fee)}</Td>
          </tr>
        </tbody>
      </TableCard>

      <TableCard
        title={`【月次計画進捗管理】全社目標 vs 実績（${monthLabel(month)}）`}
        description="目標は事業計画（確定版）の月次計画。累計は計画開始月から対象月まで"
        minWidth={1180}
      >
        <thead>
          <tr>
            <Th left>大区分</Th>
            <Th left>管理指標</Th>
            <Th>月次目標</Th>
            <Th>当月実績</Th>
            <Th>進捗率</Th>
            <Th>計画差</Th>
            <Th>期間目標</Th>
            <Th>累計実績</Th>
            <Th>全体進捗率</Th>
            <Th left>達成状況</Th>
            <Th left>算出定義</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {progressRows.map((r) => {
            const rate = r.planMonth === null ? null : achievement(r.actualMonth, r.planMonth);
            const diff = r.planMonth === null ? null : r.actualMonth - r.planMonth;
            const done = r.planMonth !== null && r.actualMonth >= r.planMonth;
            return (
              <tr key={r.label} className={cn(r.kgi && "bg-amber-50/40 dark:bg-amber-500/5")}>
                <Td left className="text-xs text-slate-500">{r.group}</Td>
                <Td left className={cn("font-semibold", r.kgi && "text-amber-700 dark:text-amber-300")}>
                  {r.label}
                </Td>
                <Td className="text-slate-400">{fmt(r.planMonth, r.money)}</Td>
                <Td className="font-semibold">{fmt(r.actualMonth, r.money)}</Td>
                <Td><Rate value={rate} /></Td>
                <Td className={cn(diff !== null && diff < 0 ? "text-rose-500" : "text-slate-500")}>
                  {diff === null ? "—" : `${diff > 0 ? "+" : ""}${r.money ? yen(diff) : num(diff)}`}
                </Td>
                <Td className="text-slate-400">{fmt(r.planPeriod, r.money)}</Td>
                <Td>{fmt(r.actualPeriod, r.money)}</Td>
                <Td>
                  <Rate value={r.planPeriod === null ? null : achievement(r.actualPeriod, r.planPeriod)} />
                </Td>
                <Td left>
                  {r.planMonth === null ? (
                    <span className="text-xs text-slate-400">—</span>
                  ) : done ? (
                    <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">達成</Badge>
                  ) : (
                    <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">未達</Badge>
                  )}
                </Td>
                <Td left className="text-[11px] text-slate-400">{r.note}</Td>
              </tr>
            );
          })}
        </tbody>
      </TableCard>
    </div>
  );
}
