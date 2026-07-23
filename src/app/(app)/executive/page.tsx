"use client";

// =============================================================
// 経営ダッシュボード（経営層限定）
// 売上・粗利トレンド / 取引先別収益 / 請求・入金ステータス / キャッシュフロー予測
// =============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BanknoteArrowDown,
  CalendarRange,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn, formatDate, formatYen, formatYenShort, todayStr } from "@/lib/utils";
import { useCollection } from "@/lib/use-collection";
import { useAccess } from "@/lib/use-access";
import { INVOICE_DIRECTIONS } from "@/lib/constants";
import { Badge, Card, PageHeader, PageSkeleton, StatCard, Tabs } from "@/components/ui";
import { CountUp } from "@/components/ui/count-up";
import { DivergingBarChart, LineChart, RankBars } from "@/components/ui/charts";
import { invoicePartnerLabel, statusLabel } from "../billing/shared";
import {
  cashflowForecast,
  countable,
  lastMonths,
  momRate,
  monthKey,
  monthLabel,
  monthlyRevenueSeries,
  nextMonths,
  overdueList,
  partnerRanking,
  totalPayableBalance,
  totalReceivableBalance,
} from "./kpi";

type Period = "1m" | "3m" | "12m";

export default function ExecutivePage() {
  const { isExecutive, loading: accessLoading } = useAccess();
  const invoices = useCollection("invoices");
  const partners = useCollection("partners");
  const [rankPeriod, setRankPeriod] = useState<Period>("3m");

  const today = todayStr();
  const now = useMemo(() => new Date(), []);
  const loading = accessLoading || invoices.loading || partners.loading;

  // ---------- 集計 ----------
  const trendMonths = useMemo(() => lastMonths(12, now), [now]);
  const trend = useMemo(
    () => monthlyRevenueSeries(invoices.items, trendMonths),
    [invoices.items, trendMonths]
  );

  const thisMonthRevenue = trend.revenue[trend.revenue.length - 1] ?? 0;
  const prevMonthRevenue = trend.revenue[trend.revenue.length - 2] ?? 0;
  const thisMonthProfit = trend.profit[trend.profit.length - 1] ?? 0;
  const revenueMom = momRate(thisMonthRevenue, prevMonthRevenue);
  const profitRate =
    thisMonthRevenue > 0 ? Math.round((thisMonthProfit / thisMonthRevenue) * 100) : null;

  const receivableBalance = totalReceivableBalance(invoices.items);
  const payableBalance = totalPayableBalance(invoices.items);
  const overdue = useMemo(() => overdueList(invoices.items, today), [invoices.items, today]);
  const overdueReceivable = overdue.filter((o) => o.invoice.direction === "receivable");
  const overdueReceivableAmount = overdueReceivable.reduce((s, o) => s + o.balance, 0);

  const rankMonths = useMemo(
    () => lastMonths(rankPeriod === "1m" ? 1 : rankPeriod === "3m" ? 3 : 12, now),
    [rankPeriod, now]
  );
  const makerRank = useMemo(
    () => partnerRanking(invoices.items, partners.items, "receivable", rankMonths),
    [invoices.items, partners.items, rankMonths]
  );
  const agencyRank = useMemo(
    () => partnerRanking(invoices.items, partners.items, "payable", rankMonths, ["agency"]),
    [invoices.items, partners.items, rankMonths]
  );

  const cfMonths = useMemo(() => nextMonths(6, now), [now]);
  const cashflow = useMemo(
    () => cashflowForecast(invoices.items, cfMonths, today),
    [invoices.items, cfMonths, today]
  );
  const netForecast =
    cashflow.inflow.reduce((s, v) => s + v, 0) - cashflow.outflow.reduce((s, v) => s + v, 0);

  // ステータス概況（下書き・取消以外）
  const statusSummary = useMemo(() => {
    const list = countable(invoices.items);
    return (["receivable", "payable"] as const).map((direction) => {
      const rows = list.filter((i) => i.direction === direction);
      const issuedThisMonth = rows.filter((i) => monthKey(i.issue_date) === monthKey(today));
      return {
        direction,
        open: rows.filter((i) => i.status !== "paid").length,
        // 消込完了日ベースで「今月消し込んだ件数」を数える
        paidThisMonth: rows.filter((i) => i.paid_date !== "" && monthKey(i.paid_date) === monthKey(today)).length,
        totalThisMonth: issuedThisMonth.reduce((s, i) => s + i.total, 0),
      };
    });
  }, [invoices.items, today]);

  // ---------- ゲート ----------
  if (loading) return <PageSkeleton />;

  if (!isExecutive) {
    return (
      <div>
        <PageHeader
          icon={<TrendingUp className="h-5 w-5" />}
          title="経営ダッシュボード"
          description="売上・粗利・入金状況・キャッシュフローの経営指標"
        />
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              このページは経営層のみ閲覧できます
            </p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
              閲覧権限が必要な場合は、経営層のメンバーに「設定 &gt; 権限管理」からの変更を依頼してください
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const currentMonthNum = Number(monthKey(today).slice(5, 7));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<TrendingUp className="h-5 w-5" />}
        title="経営ダッシュボード"
        description="売上・粗利・入金状況・キャッシュフローの経営指標（経営層限定）"
      />

      {/* ---------- KPI ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`今月の売上（${currentMonthNum}月・税抜）`}
          value={<CountUp value={thisMonthRevenue} format={formatYen} />}
          sub={
            revenueMom !== null ? (
              <span className={revenueMom >= 0 ? "text-emerald-500" : "text-rose-500"}>
                前月比 {revenueMom >= 0 ? "+" : ""}
                {revenueMom}%
              </span>
            ) : (
              "前月データなし"
            )
          }
          icon={<TrendingUp className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="今月の粗利（税抜）"
          value={<CountUp value={thisMonthProfit} format={formatYen} />}
          sub={profitRate !== null ? `粗利率 ${profitRate}%` : "—"}
          icon={<Wallet className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="未入金残高（税込）"
          value={<CountUp value={receivableBalance} format={formatYen} />}
          sub={`支払予定残高 ${formatYenShort(payableBalance)}`}
          icon={<BanknoteArrowDown className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="期限超過の未回収"
          value={<CountUp value={overdueReceivableAmount} format={formatYen} />}
          sub={
            overdueReceivable.length > 0 ? (
              <span className="text-rose-500">{overdueReceivable.length}件が回収遅延中</span>
            ) : (
              "遅延なし"
            )
          }
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="rose"
        />
      </div>

      {/* ---------- 売上・粗利トレンド ---------- */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-bold">売上・粗利の推移（過去12ヶ月・税抜）</h2>
        </div>
        <LineChart
          labels={trend.months.map(monthLabel)}
          series={[
            {
              name: "売上",
              values: trend.revenue,
              colorClass: "text-cyan-600",
              dotClass: "bg-cyan-600",
            },
            {
              name: "粗利",
              values: trend.profit,
              colorClass: "text-violet-600 dark:text-violet-500",
              dotClass: "bg-violet-600 dark:bg-violet-500",
            },
          ]}
          formatValue={formatYenShort}
          tooltip={(i, s) =>
            `${trend.months[i]} ${s.name}: ${formatYen(s.values[i] ?? 0)}`
          }
        />
      </Card>

      {/* ---------- 取引先別ランキング ---------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">取引先別の収益（税抜）</h2>
          <Tabs
            tabs={[
              { key: "1m", label: "今月" },
              { key: "3m", label: "3ヶ月" },
              { key: "12m", label: "12ヶ月" },
            ]}
            active={rankPeriod}
            onChange={setRankPeriod}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <p className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
              メーカー・顧客別 売上
            </p>
            <RankBars
              rows={makerRank.map((r) => ({
                label: r.label,
                value: r.value,
                sub: `${r.count}件`,
              }))}
              barClass="bg-cyan-500"
              formatValue={formatYenShort}
              emptyText="対象期間の売上データがありません"
            />
          </Card>
          <Card className="p-5">
            <p className="mb-4 text-sm font-semibold text-slate-500 dark:text-slate-400">
              代理店別 支払（手数料分配）
            </p>
            <RankBars
              rows={agencyRank.map((r) => ({
                label: r.label,
                value: r.value,
                sub: `${r.count}件`,
              }))}
              barClass="bg-violet-500"
              formatValue={formatYenShort}
              emptyText="対象期間の支払データがありません"
            />
          </Card>
        </div>
      </div>

      {/* ---------- 請求・入金ステータス ---------- */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">請求・入金の概況</h2>
          <div className="space-y-4">
            {statusSummary.map((row) => (
              <div key={row.direction} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-center justify-between">
                  <Badge className={INVOICE_DIRECTIONS[row.direction].color}>
                    {INVOICE_DIRECTIONS[row.direction].label}
                  </Badge>
                  <p className="text-xs text-slate-400">
                    今月 {formatYenShort(row.totalThisMonth)}
                  </p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/50">
                    <p className="text-lg font-bold">{row.open}</p>
                    <p className="text-[11px] text-slate-400">
                      {row.direction === "receivable" ? "未入金" : "未払い"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/50">
                    <p className="text-lg font-bold">{row.paidThisMonth}</p>
                    <p className="text-[11px] text-slate-400">今月消込済</p>
                  </div>
                </div>
              </div>
            ))}
            <Link
              href="/billing"
              className="flex items-center justify-center gap-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-cyan-600 transition-colors hover:bg-cyan-50 dark:border-slate-700 dark:text-cyan-400 dark:hover:bg-cyan-500/10"
            >
              請求・支払を開く <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <h2 className="mb-4 flex items-center gap-2 font-bold">
            期限超過アラート
            {overdue.length > 0 && (
              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                {overdue.length}件
              </Badge>
            )}
          </h2>
          {overdue.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">
              期限超過の請求書はありません 🎉
            </p>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800/60">
              {overdue.slice(0, 6).map(({ invoice, days, balance }) => (
                <Link
                  key={invoice.id}
                  href="/billing"
                  className="flex items-center gap-3 py-2.5 transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <Badge className={INVOICE_DIRECTIONS[invoice.direction].color}>
                    {invoice.direction === "receivable" ? "入金" : "支払"}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {invoicePartnerLabel(invoice, partners.items)}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {invoice.title} ・ 期日 {formatDate(invoice.due_date)} ・ {statusLabel(invoice)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold whitespace-nowrap">{formatYen(balance)}</p>
                    <p className="text-xs font-semibold text-rose-500">{days}日超過</p>
                  </div>
                </Link>
              ))}
              {overdue.length > 6 && (
                <p className="pt-2.5 text-center text-xs text-slate-400">
                  ほか{overdue.length - 6}件 — 請求・支払の入金消込タブで確認できます
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* ---------- キャッシュフロー予測 ---------- */}
      <Card className="p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-bold">
            <CalendarRange className="h-4 w-4 text-slate-400" />
            キャッシュフロー予測（未消込の請求書の期日ベース・税込）
          </h2>
          <p className="text-sm">
            6ヶ月純収支見込
            <span
              className={cn(
                "ml-2 text-lg font-bold tracking-tight",
                netForecast >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}
            >
              {netForecast >= 0 ? "+" : ""}
              {formatYen(netForecast)}
            </span>
          </p>
        </div>
        <DivergingBarChart
          labels={cashflow.labels}
          up={{
            name: "入金予定",
            values: cashflow.inflow,
            barClass: "fill-cyan-600",
            dotClass: "bg-cyan-600",
          }}
          down={{
            name: "支払予定",
            values: cashflow.outflow,
            barClass: "fill-amber-600",
            dotClass: "bg-amber-600",
          }}
          formatValue={formatYenShort}
          highlightFirst
        />
        <p className="mt-2 text-xs text-slate-400">
          「超過分」は支払期日を過ぎても未消込の金額（回収・支払の遅延）。
          {(cashflow.undatedInflow > 0 || cashflow.undatedOutflow > 0) &&
            ` 期日未設定のため予測に含まれない残高: 入金 ${formatYenShort(cashflow.undatedInflow)} / 支払 ${formatYenShort(cashflow.undatedOutflow)}。`}
        </p>
      </Card>
    </div>
  );
}
