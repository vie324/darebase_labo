"use client";

// =============================================================
// アライアンス数値管理
//
// 2026年9月〜2027年4月のアライアンス営業を、2つのスプレッドシートに準拠して管理する画面。
//   ・アライアンス事業計画※確定版 … 月次計画・月次実績・期間サマリー・月次目標生成・前提条件
//   ・★案件管理表★               … 全体管理の集計・日報生成（日報 / 月次集計 / 見込み分析 / 計画進捗）
// 数字はすべてアライアンス営業の案件（＋未案件化の紹介アポ）から自動で集計する。
// 入力は 案件管理（1紹介＝1案件）と、この画面の「計画」タブ（前提条件）だけ。
//
// 集計の定義は lib/alliance-kpi.ts、計画の計算は lib/alliance-plan.ts、
// シートの取込は lib/alliance-import.ts（いずれもテスト付き）。
// 売上・自社利益・代理店報酬が出るので、本部のメンバーだけに見せる（all_sales_data）。
// =============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Coins, FileSpreadsheet, Handshake, Target, Users } from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { useAlliancePlan } from "@/lib/settings";
import { ALLIANCE, BANKING, UNIT_TERMS } from "@/lib/business-units";
import { countUnitOf, monthLabel, monthOf } from "@/lib/alliance";
import { buildPlan, planMonths, planTotals } from "@/lib/alliance-plan";
import {
  achievement,
  agencyStarts,
  anyDate,
  between,
  buildReferrals,
  byAgency,
  closeRateOf,
  closings,
  dailyReportText,
  inMonth,
  onDay,
  partnershipFunnel,
  planBreakdown,
  planVsActual,
  prospectsByAgency,
  tally,
  DIRECT_LABEL,
} from "@/lib/alliance-kpi";
import { formatDate, todayStr } from "@/lib/utils";
import { RequireCapability } from "@/components/layout/require-capability";
import { UnitMissing } from "@/components/ui/unit-missing";
import { Button, PageHeader, PageSkeleton, Select, StatCard, Tabs } from "@/components/ui";
import { MonthlyTab } from "./monthly-tab";
import { DailyTab } from "./daily-tab";
import { AgencyTab, PartnershipTab, ProspectTab } from "./agency-tabs";
import { PlanTab } from "./plan-tab";
import { AllianceImportModal } from "./import-modal";
import { Rate, yen } from "./shared";

type TabKey = "monthly" | "daily" | "agency" | "prospect" | "partnership" | "plan";

export default function AlliancePage() {
  return (
    <RequireCapability
      cap="all_sales_data"
      title="アライアンス数値管理は本部のメンバーだけが見られます"
      message="売上・自社利益・代理店報酬が載っているため、代理店のアカウントには出していません"
    >
      <AllianceKpi />
    </RequireCapability>
  );
}

function AllianceKpi() {
  const { user } = useUser();
  const { can, loading: accessLoading } = useAccess();
  const units = useCollection("business_units");
  const deals = useCollection("deals");
  const lines = useCollection("deal_products");
  const products = useCollection("products");
  const banks = useCollection("banks");
  const branches = useCollection("branches");
  const appointments = useCollection("appointments");
  const activities = useCollection("deal_activities");
  const { plan, isDefault, loading: planLoading, save: savePlan } = useAlliancePlan();

  const today = todayStr();
  const [tab, setTab] = useState<TabKey>("monthly");
  const [month, setMonth] = useState(() => monthOf(today));
  const [day, setDay] = useState(today);
  const [importOpen, setImportOpen] = useState(false);

  const alliance = units.items.find((u) => u.slug === ALLIANCE && u.is_active) ?? null;
  const bankingId = units.items.find((u) => u.slug === BANKING)?.id ?? null;
  const unitId = alliance?.id ?? null;

  // ---------- アライアンス営業の行だけにする ----------
  const data = useMemo(() => {
    if (!unitId) return null;
    const mine = <T extends { business_unit_id?: string | null }>(rows: T[]) =>
      rows.filter((r) => (r.business_unit_id ?? bankingId) === unitId);
    const unitBanks = mine(banks.items);
    const bankIds = new Set(unitBanks.map((b) => b.id));
    const unitBranches = branches.items.filter((b) => bankIds.has(b.bank_id));
    const unitDeals = mine(deals.items);
    const dealIds = new Set(unitDeals.map((d) => d.id));
    const unitProducts = products.items.filter((p) => !p.business_unit_id || p.business_unit_id === unitId);
    const referrals = buildReferrals({
      deals: unitDeals,
      lines: lines.items.filter((l) => dealIds.has(l.deal_id)),
      products: products.items,
      appointments: mine(appointments.items),
    });
    return { unitBanks, unitBranches, unitDeals, unitProducts, referrals };
  }, [unitId, bankingId, banks.items, branches.items, deals.items, products.items, lines.items, appointments.items]);

  if (
    !user ||
    accessLoading ||
    planLoading ||
    units.loading ||
    deals.loading ||
    lines.loading ||
    products.loading ||
    banks.loading ||
    branches.loading ||
    appointments.loading ||
    activities.loading
  ) {
    return <PageSkeleton />;
  }

  if (!unitId || !data) {
    return (
      <div>
        <PageHeader title="アライアンス数値管理" icon={<Handshake className="h-5 w-5" />} />
        <UnitMissing
          slug={ALLIANCE}
          canCreate={can("master_add")}
          onCreate={async () =>
            (await units.add({ name: UNIT_TERMS[ALLIANCE].unit, slug: ALLIANCE, is_active: true })).id
          }
        />
      </div>
    );
  }

  const { unitBanks, unitBranches, unitDeals, unitProducts, referrals } = data;

  // ---------- 計画と実績 ----------
  const months = planMonths(plan);
  const planRows = buildPlan(plan);
  const totals = planTotals(planRows);
  const results = planVsActual(planRows, referrals);
  const selected = results.find((r) => r.month === month) ?? null;
  const periodFrom = `${months[0]}-01`;
  const periodTo = `${months.at(-1)}-31`;
  const inPeriod = between(periodFrom, periodTo);
  const upToSelected = results.filter((r) => r.month <= month);
  const cumFee = upToSelected.at(-1)?.actual.cumFee ?? 0;
  const cumPlanFee = upToSelected.at(-1)?.plan.cumFee ?? 0;

  const nameOfBank = (id: string | null) =>
    id ? (unitBanks.find((b) => b.id === id)?.name ?? "（マスタに無い1次代理店）") : DIRECT_LABEL;
  const nameOfBranch = (id: string | null) =>
    id ? (unitBranches.find((b) => b.id === id)?.name ?? "—") : "直紹介";

  // プラン別の列：アライアンスのプラン（商材マスタの並び。機器・クロスセルを除く）＋明細にだけ出てくる名前
  const planNames = Array.from(
    new Set([
      ...unitProducts
        .filter(
          (p) => p.business_unit_id === unitId && countUnitOf(p) === "contract" && p.unit_price > 0
        )
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => p.name),
      ...referrals.flatMap((r) => Object.keys(r.econ.planQty)),
    ])
  );

  // 日報
  const dayRows = byAgency(referrals, unitBanks, onDay(day));
  const dayTotal = tally(referrals, onDay(day));
  const dayMonth = monthOf(day);
  const dayMonthRows = byAgency(referrals, unitBanks, inMonth(dayMonth));
  const dayMonthTotal = tally(referrals, inMonth(dayMonth));
  const dayResult = results.find((r) => r.month === dayMonth) ?? null;
  const reportText = dailyReportText({
    dayLabel: formatDate(day).replace(/^(\d+)\/(\d+)/, `${day.slice(0, 4)}/$1/$2`),
    day: dayTotal,
    dayByAgency: dayRows,
    monthLabel: monthLabel(dayMonth),
    month: dayMonthTotal,
    plan: dayResult?.plan ?? null,
  });

  // 販売協力
  const partnershipRefs = referrals.filter((r) => r.kind !== "sales" || r.partnershipPhase !== "");
  const ballOf = (dealId: string | null) => unitDeals.find((d) => d.id === dealId)?.ball ?? "";
  const secondaryCounts = new Map<string, number>();
  for (const b of unitBranches) {
    if (b.name === "直接") continue;
    secondaryCounts.set(b.bank_id, (secondaryCounts.get(b.bank_id) ?? 0) + 1);
  }

  const prospects = referrals.filter(
    (r) => r.stage === "follow_up" && (r.rank === "A" || r.rank === "B" || r.rank === "C")
  );

  const monthOptions = Array.from(new Set([...months, monthOf(today)])).sort();

  return (
    <div>
      <PageHeader
        title="アライアンス数値管理"
        description="事業計画（確定版）と案件管理表に準拠。★KGI＝代理店をどれだけ儲けさせたか（代理店報酬の総額）"
        icon={<Handshake className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/deals">
              <Button size="sm" variant="secondary">
                <Briefcase className="h-4 w-4" />
                案件管理
              </Button>
            </Link>
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4" />
              案件管理表から取り込む
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-9 w-full py-0 sm:w-48"
          aria-label="対象月"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
              {m === monthOf(today) ? "（今月）" : ""}
            </option>
          ))}
        </Select>
        <p className="text-xs text-slate-400">
          計画期間 {monthLabel(months[0])}〜{monthLabel(months.at(-1)!)}（{plan.months}ヶ月）・
          {plan.scenario === "standard" ? "標準" : plan.scenario === "conservative" ? "保守" : "積極"}シナリオ
          {isDefault && "（確定版の値）"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label={`★代理店報酬（${monthLabel(month)}）`}
          value={yen(selected?.actual.fee ?? 0)}
          sub={
            selected ? (
              <>
                計画 {yen(selected.plan.fee)} ・ <Rate value={achievement(selected.actual.fee, selected.plan.fee)} />
              </>
            ) : (
              "計画期間の外です"
            )
          }
          icon={<Coins className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="★代理店報酬の累計"
          value={yen(cumFee)}
          sub={
            <>
              {monthLabel(month)}までの計画 {yen(cumPlanFee)} ・ 期間計画 {yen(totals.fee)}（
              <Rate value={achievement(cumFee, totals.fee)} />）
            </>
          }
          icon={<Target className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label={`紹介数（${monthLabel(month)}）`}
          value={`${selected?.actual.referrals ?? tally(referrals, inMonth(month)).referrals}件`}
          sub={
            selected ? (
              <>
                計画 {selected.plan.referrals}件 ・ <Rate value={achievement(selected.actual.referrals, selected.plan.referrals)} />
              </>
            ) : undefined
          }
          icon={<Users className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label={`成約数（${monthLabel(month)}）`}
          value={`${selected?.actual.closings ?? tally(referrals, inMonth(month)).closings}件`}
          sub={
            selected ? (
              <>
                計画 {selected.plan.closings}件 ・ 成約率 {closeRateOf(selected.actual)?.toFixed(1) ?? "—"}%
              </>
            ) : undefined
          }
          icon={<Briefcase className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <div className="mt-6 mb-4">
        <Tabs<TabKey>
          tabs={[
            { key: "monthly", label: "月次実績" },
            { key: "daily", label: "日報" },
            { key: "agency", label: "代理店別", count: unitBanks.length },
            { key: "prospect", label: "見込み", count: prospects.length },
            { key: "partnership", label: "販売協力", count: partnershipRefs.length },
            { key: "plan", label: "計画" },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === "monthly" && (
        <MonthlyTab
          results={results}
          totals={totals}
          breakdown={planBreakdown(referrals, months)}
          planNames={planNames}
          closings={closings(referrals, inPeriod)}
          nameOfBank={nameOfBank}
          nameOfBranch={nameOfBranch}
          selectedMonth={month}
        />
      )}
      {tab === "daily" && (
        <DailyTab
          day={day}
          onDayChange={setDay}
          dayRows={dayRows}
          dayTotal={dayTotal}
          monthRows={dayMonthRows}
          monthTotal={dayMonthTotal}
          monthResult={dayResult}
          periodResults={results}
          totals={totals}
          partnershipContractsInMonth={dayMonthTotal.partnershipContracts}
          partnershipContractsInPeriod={
            tally(referrals, (d) => inPeriod(d) && monthOf(d) <= dayMonth).partnershipContracts
          }
          reportText={reportText}
        />
      )}
      {tab === "agency" && (
        <AgencyTab
          month={month}
          monthRows={byAgency(referrals, unitBanks, inMonth(month))}
          allRows={byAgency(referrals, unitBanks, anyDate)}
          starts={agencyStarts(referrals)}
          secondaryCounts={secondaryCounts}
        />
      )}
      {tab === "prospect" && (
        <ProspectTab rows={prospectsByAgency(referrals, unitBanks)} prospects={prospects} nameOfBank={nameOfBank} />
      )}
      {tab === "partnership" && (
        <PartnershipTab
          funnel={partnershipFunnel(referrals)}
          referrals={partnershipRefs}
          ballOf={ballOf}
          nameOfBank={nameOfBank}
          nameOfBranch={nameOfBranch}
        />
      )}
      {tab === "plan" && (
        <PlanTab
          plan={plan}
          isDefault={isDefault}
          results={results}
          canEdit={can("settings_admin")}
          planProducts={unitProducts.filter((p) => countUnitOf(p) === "contract" && p.unit_price > 0)}
          selectedMonth={month}
          onSave={savePlan}
        />
      )}

      {importOpen && (
        <AllianceImportModal
          unitId={unitId}
          banks={banks}
          branches={branches}
          deals={deals}
          lines={lines}
          products={unitProducts}
          activities={activities}
          user={{ id: user.id, name: user.name }}
          today={today}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}
