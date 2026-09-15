"use client";

// =============================================================
// 銀行・支店マスタ — 銀行一覧 → 支店一覧のドリルダウン
//
// このシステムの土台。支店ごとの最終接点日・アポ数・成約数を並べ、
// 放置されている支店をチェックして担当を振り替えられるようにする。
// 集計は @/lib/branch-metrics（テスト済みの純粋関数）に委譲する。
// =============================================================

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  Landmark,
  Plus,
  Upload,
  Users,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useBranchSettings } from "@/lib/settings";
import { buildBranchStats, summarizeBranches, type BranchStat } from "@/lib/branch-metrics";
import type { ImportPlan } from "@/lib/branch-import";
import { downloadCsv, toCsv } from "@/lib/csv";
import { cn, todayStr } from "@/lib/utils";
import type { Bank, Branch } from "@/lib/types";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  SearchInput,
  Select,
  StatCard,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { BranchTable } from "./branch-table";
import {
  BankFormModal,
  BranchActivityModal,
  BranchFormModal,
  BulkAssignModal,
} from "./bank-modals";
import { BranchImportModal } from "./import-modal";
import {
  DORMANCY_STYLE,
  formatRate,
  rateBarClass,
  rateTextClass,
  type BankFormValues,
  type BranchActivityFormValues,
  type BranchFormValues,
  type BranchSortKey,
} from "./shared";
import { useAccess } from "@/lib/use-access";
import { useBusinessUnit } from "@/lib/use-business-unit";
import { filterByUnit } from "@/lib/business-units";
import { UnitSwitch } from "@/components/ui/unit-switch";
import { DensityToggle } from "@/components/ui/density-toggle";

type DormancyFilter = "all" | "dormant" | "never" | "unassigned";

export default function BanksPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { can } = useAccess();
  const banks = useCollection("banks");
  const branches = useCollection("branches");
  const appointments = useCollection("appointments");
  const activities = useCollection("branch_activities");
  const organizations = useCollection("organizations");
  const profiles = useCollection("profiles");
  const { settings } = useBranchSettings();
  // 事業部で銀行・支店を出し分ける。呼び名も事業部で変わる（lib/business-units.ts）
  const { slug, unitId, defaultUnitId, terms, setSlug } = useBusinessUnit();
  const defaultBusinessUnitId = unitId ?? defaultUnitId;

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dormancyFilter, setDormancyFilter] = useState<DormancyFilter>("all");
  const [sortKey, setSortKey] = useState<BranchSortKey>("lastContact");
  const [asc, setAsc] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [bankForm, setBankForm] = useState<{ initial: Bank | null } | null>(null);
  const [branchForm, setBranchForm] = useState<{ initial: Branch | null } | null>(null);
  const [activityTarget, setActivityTarget] = useState<Branch | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const loading =
    !user ||
    banks.loading ||
    branches.loading ||
    appointments.loading ||
    activities.loading ||
    organizations.loading;

  if (loading) return <PageSkeleton />;

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const today = todayStr();
  // 事業部で絞ってから集計する。business_unit_id が空の既存行は銀行営業扱い
  const unitBanks = filterByUnit(banks.items, unitId, defaultUnitId);
  const unitBankIds = new Set(unitBanks.map((b) => b.id));
  const unitBranches = filterByUnit(branches.items, unitId, defaultUnitId).filter((b) =>
    unitBankIds.has(b.bank_id)
  );
  const unitBranchIds = new Set(unitBranches.map((b) => b.id));
  const unitAppointments = appointments.items.filter(
    (a) => a.branch_id !== null && unitBranchIds.has(a.branch_id)
  );
  const unitActivities = activities.items.filter((a) => unitBranchIds.has(a.branch_id));

  const stats = buildBranchStats(
    unitBranches,
    unitAppointments,
    unitActivities,
    today,
    settings
  );

  // ---------- ルックアップ ----------
  const bankNameOf = (id: string) => banks.items.find((b) => b.id === id)?.name ?? "";
  const orgNameOf = (id: string | null) =>
    id ? (organizations.items.find((o) => o.id === id)?.name ?? "") : "";
  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "cyan";

  const selectedBank = selectedBankId
    ? (banks.items.find((b) => b.id === selectedBankId) ?? null)
    : null;

  // ---------- 銀行別の集計（一覧に出す） ----------
  const bankRows = unitBanks
    .map((bank) => {
      const rows = stats.filter((s) => s.branch.bank_id === bank.id);
      const s = summarizeBranches(rows);
      return { bank, ...s };
    })
    .sort((a, b) => (a.activeRate ?? 0) - (b.activeRate ?? 0) || b.totalBranches - a.totalBranches);

  // ---------- 支店の絞り込み ----------
  const q = query.trim().toLowerCase();
  const visible = stats
    .filter((s) => {
      if (selectedBankId && s.branch.bank_id !== selectedBankId) return false;
      if (ownerFilter === "unassigned" && s.branch.assigned_to) return false;
      if (ownerFilter !== "all" && ownerFilter !== "unassigned" && s.branch.assigned_to !== ownerFilter)
        return false;
      if (dormancyFilter === "dormant" && s.isActive) return false;
      if (dormancyFilter === "never" && s.lastContactAt !== "") return false;
      if (dormancyFilter === "unassigned" && s.branch.assigned_to) return false;
      if (q) {
        const hay = `${s.branch.name} ${s.branch.code} ${s.branch.prefecture} ${bankNameOf(s.branch.bank_id)}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => sortStats(a, b, sortKey, asc));

  const summary = summarizeBranches(
    selectedBankId ? stats.filter((s) => s.branch.bank_id === selectedBankId) : stats
  );

  // ---------- 操作 ----------
  const toggleSort = (key: BranchSortKey) => {
    if (key === sortKey) setAsc((v) => !v);
    else {
      setSortKey(key);
      setAsc(key === "name" || key === "assigned");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids: string[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const saveBank = async (values: BankFormValues) => {
    if (bankForm?.initial) {
      await banks.update(bankForm.initial.id, values);
      toast(`${terms.parent}を更新しました`, "success");
    } else {
      await banks.add({ ...values, business_unit_id: defaultBusinessUnitId });
      toast(`${terms.parent}を登録しました`, "success");
    }
    setBankForm(null);
  };

  const removeBank = async (bank: Bank) => {
    const count = branches.items.filter((b) => b.bank_id === bank.id).length;
    if (
      !confirm(
        `「${bank.name}」を削除しますか？\n紐づく ${count} ${terms.countUnit}とその活動ログも削除されます。`
      )
    ) {
      return;
    }
    for (const b of branches.items.filter((b) => b.bank_id === bank.id)) {
      for (const a of activities.items.filter((a) => a.branch_id === b.id)) {
        await activities.remove(a.id);
      }
      await branches.remove(b.id);
    }
    await banks.remove(bank.id);
    if (selectedBankId === bank.id) setSelectedBankId(null);
    setBankForm(null);
    toast(`${terms.parent}を削除しました`, "info");
  };

  const saveBranch = async (values: BranchFormValues) => {
    const assignedName = values.assigned_to
      ? (profiles.items.find((p) => p.id === values.assigned_to)?.name ?? "")
      : "";
    const patch = {
      bank_id: values.bank_id,
      name: values.name,
      code: values.code,
      prefecture: values.prefecture,
      address: values.address,
      assigned_to: values.assigned_to || null,
      assigned_name: assignedName,
      assigned_org_id: values.assigned_org_id || null,
      status: values.status,
      note: values.note,
      updated_at: new Date().toISOString(),
    };
    if (branchForm?.initial) {
      await branches.update(branchForm.initial.id, patch);
      toast(`${terms.child}を更新しました`, "success");
    } else {
      await branches.add({
        ...patch,
        last_contact_at: "",
        business_unit_id: defaultBusinessUnitId,
      });
      toast(`${terms.child}を登録しました`, "success");
    }
    setBranchForm(null);
  };

  const removeBranch = async (branch: Branch) => {
    if (!confirm(`「${branch.name}」を削除しますか？活動ログも削除されます。`)) return;
    for (const a of activities.items.filter((a) => a.branch_id === branch.id)) {
      await activities.remove(a.id);
    }
    await branches.remove(branch.id);
    setBranchForm(null);
    toast(`${terms.child}を削除しました`, "info");
  };

  const logActivity = async (branch: Branch, values: BranchActivityFormValues) => {
    await activities.add({
      branch_id: branch.id,
      bank_id: branch.bank_id,
      user_id: user.id,
      user_name: user.name,
      type: values.type,
      occurred_at: values.occurred_at,
      memo: values.memo,
      business_unit_id: branch.business_unit_id ?? defaultBusinessUnitId,
    });
    // 最終接点日のキャッシュを進める（過去日を記録した場合は巻き戻さない）
    if (values.occurred_at > branch.last_contact_at) {
      await branches.update(branch.id, {
        last_contact_at: values.occurred_at,
        updated_at: new Date().toISOString(),
      });
    }
    setActivityTarget(null);
    toast(`${branch.name} の活動を記録しました`, "success");
  };

  const bulkAssign = async (assignedTo: string, assignedOrgId: string, changeOrg: boolean) => {
    const name = assignedTo
      ? (profiles.items.find((p) => p.id === assignedTo)?.name ?? "")
      : "";
    const now = new Date().toISOString();
    for (const id of selected) {
      await branches.update(id, {
        assigned_to: assignedTo || null,
        assigned_name: name,
        ...(changeOrg ? { assigned_org_id: assignedOrgId || null } : {}),
        updated_at: now,
      });
    }
    toast(`${selected.size}${terms.child}の担当を変更しました`, "success");
    setSelected(new Set());
    setBulkOpen(false);
  };

  const applyImport = async (plan: ImportPlan) => {
    // 銀行を先に作り、生成された id を支店行に配る
    const bankIdByName = new Map<string, string>();
    for (const b of unitBanks) bankIdByName.set(normalize(b.name), b.id);

    for (const nb of plan.newBanks) {
      const created = await banks.add({
        name: nb.name,
        code: nb.code,
        is_active: true,
        business_unit_id: defaultBusinessUnitId,
      });
      bankIdByName.set(normalize(nb.name), created.id);
    }

    const now = new Date().toISOString();
    let created = 0;
    let updated = 0;
    for (const row of plan.rows) {
      if (row.action !== "create" && row.action !== "update") continue;
      const bankId = row.existingBankId ?? bankIdByName.get(normalize(row.bankName));
      if (!bankId) continue;
      const member = row.assignee
        ? profiles.items.find((p) => p.name === row.assignee.trim())
        : undefined;

      if (row.action === "update" && row.existingBranchId) {
        await branches.update(row.existingBranchId, {
          name: row.branchName,
          code: row.branchCode,
          prefecture: row.prefecture,
          address: row.address,
          note: row.note,
          // 担当者はCSVに書かれている場合のみ上書きする（既存の割当を消さない）
          ...(member ? { assigned_to: member.id, assigned_name: member.name } : {}),
          updated_at: now,
        });
        updated++;
      } else {
        await branches.add({
          bank_id: bankId,
          name: row.branchName,
          code: row.branchCode,
          address: row.address,
          prefecture: row.prefecture,
          assigned_to: member?.id ?? null,
          assigned_name: member?.name ?? "",
          assigned_org_id: null,
          status: "active",
          last_contact_at: "",
          note: row.note,
          business_unit_id: defaultBusinessUnitId,
          updated_at: now,
        });
        created++;
      }
    }
    toast(`取込完了: 新規 ${created}件 / 更新 ${updated}件`, "success");
  };

  const exportCsv = () => {
    const headers = [
      `${terms.parent}名`,
      terms.parentCode,
      `${terms.child}名`,
      terms.childCode,
      "都道府県",
      "担当者",
      "担当代理店",
      "ステータス",
      "最終接点日",
      "経過日数",
      `直近${settings.recentMonths}ヶ月アポ数`,
      "累計成約数",
      "成約率",
    ];
    const rows = visible.map((s) => [
      bankNameOf(s.branch.bank_id),
      banks.items.find((b) => b.id === s.branch.bank_id)?.code ?? "",
      s.branch.name,
      s.branch.code,
      s.branch.prefecture,
      s.branch.assigned_name,
      orgNameOf(s.branch.assigned_org_id),
      s.branch.status,
      s.lastContactAt,
      s.daysSinceContact === null ? "" : String(s.daysSinceContact),
      String(s.recentAppointments),
      String(s.wonCount),
      s.winRate === null ? "" : String(s.winRate),
    ]);
    downloadCsv(`darebase_branches_${today}.csv`, toCsv(headers, rows));
  };

  const members = profiles.items;
  const activeOrgs = organizations.items.filter((o) => o.is_active);
  const hasData = unitBanks.length > 0;
  // マスタの追加・取込・担当振り替えは本部のみ（DB 側も banks_write / branches_insert
  // が is_hq のため、代理店には操作させない）
  // 登録は本部社員全員。削除と担当の一括振り替えだけマネージャー以上に絞る。
  const canAddMaster = can("master_add");
  const canEditMaster = can("master_edit");

  return (
    <div>
      <PageHeader
        title={`${terms.parent}・${terms.child}`}
        description={terms.description}
        icon={<Landmark className="h-5 w-5" />}
        actions={
          canAddMaster ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                まとめて登録
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setBankForm({ initial: null })}
              >
                <Plus className="h-4 w-4" />
                {terms.parent}
              </Button>
              <Button
                size="sm"
                onClick={() => setBranchForm({ initial: null })}
                disabled={unitBanks.length === 0}
              >
                <Plus className="h-4 w-4" />
                {terms.child}
              </Button>
            </>
          ) : undefined
        }
      />

      {/* 事業部の切り替え。銀行営業とアライアンス営業で同じ画面を出し分ける */}
      <UnitSwitch slug={slug} onChange={setSlug} className="mb-5 w-full sm:w-auto sm:self-start" />

      {!hasData ? (
        <EmptyState
          icon={<Landmark className="h-10 w-10" />}
          title={`${terms.parent}が登録されていません`}
          description={
            canAddMaster
              ? `${terms.child}名を1行ずつ貼り付けるだけで登録できます。CSV・スプレッドシートからの取込にも対応しています`
              : `自社に割り当てられた${terms.child}がまだありません。本部にお問い合わせください`
          }
          action={
            canAddMaster ? (
              <Button onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                {terms.parent}・{terms.child}を登録
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {/* ---------- サマリー ---------- */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label={selectedBank ? `${selectedBank.name} の${terms.child}数` : `総${terms.child}数`}
              value={`${summary.totalBranches}${terms.countUnit}`}
              sub={
                summary.suspendedBranches > 0
                  ? `取引停止 ${summary.suspendedBranches}${terms.countUnit}を除く`
                  : `${terms.parent} ${selectedBank ? 1 : unitBanks.length}社`
              }
              icon={<Building2 className="h-5 w-5" />}
              accent="cyan"
            />
            <StatCard
              label={`稼働${terms.child}`}
              value={`${summary.activeBranches}${terms.countUnit}`}
              sub={`直近${settings.activeWindowDays}日に接点あり`}
              icon={<Users className="h-5 w-5" />}
              accent="emerald"
            />
            <StatCard
              label="稼働率"
              value={formatRate(summary.activeRate)}
              sub={
                summary.activeRate === null
                  ? `対象${terms.child}がありません`
                  : `休眠 ${summary.dormantBranches}${terms.countUnit}`
              }
              icon={<ArrowRight className="h-5 w-5" />}
              accent="sky"
            />
            <StatCard
              label="一度も接点なし"
              value={`${summary.neverContacted}${terms.countUnit}`}
              sub={`最優先で着手すべき${terms.child}`}
              icon={<Building2 className="h-5 w-5" />}
              accent="rose"
            />
          </div>

          {/* ---------- 銀行の切り替え ---------- */}
          <div className="mt-6">
            {selectedBank ? (
              <button
                onClick={() => {
                  setSelectedBankId(null);
                  setSelected(new Set());
                }}
                className="inline-flex cursor-pointer items-center gap-1 text-sm font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
              >
                <ChevronLeft className="h-4 w-4" />
                銀行一覧に戻る
              </button>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-bold">{terms.parent}別の稼働率</h2>
                  <Link
                    href="/banks/activity"
                    className="group inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
                  >
                    稼働ダッシュボードへ
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {bankRows.map(({ bank, totalBranches, activeBranches, activeRate }) => (
                    <Card
                      key={bank.id}
                      hover
                      className="p-4"
                      onClick={() => {
                        setSelectedBankId(bank.id);
                        setSelected(new Set());
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{bank.name}</p>
                          <p className="text-xs text-slate-400">
                            {bank.code ? `コード ${bank.code} ・ ` : ""}
                            {totalBranches}支店
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-lg font-bold tabular-nums",
                            rateTextClass(activeRate)
                          )}
                        >
                          {formatRate(activeRate)}
                        </span>
                      </div>
                      <ProgressBar
                        value={activeBranches}
                        max={Math.max(1, totalBranches)}
                        className="mt-3"
                        barClassName={rateBarClass(activeRate)}
                      />
                      <p className="mt-1.5 text-xs text-slate-400">
                        稼働 {activeBranches} / {totalBranches} 支店
                      </p>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* ---------- 支店一覧 ---------- */}
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-bold">
                {selectedBank ? `${selectedBank.name} の${terms.child}` : `全${terms.child}`}
                <span className="ml-2 text-xs font-normal text-slate-400">
                  {visible.length}件
                </span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {/* 支店は100件規模になるので、行の高さを選べるようにする（設定はブラウザに保存） */}
                <DensityToggle className="hidden lg:inline-flex" />
                {selectedBank && canAddMaster && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setBankForm({ initial: selectedBank })}
                  >
                    {terms.parent}を編集
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={exportCsv} disabled={visible.length === 0}>
                  CSV出力
                </Button>
              </div>
            </div>

            {/* フィルタ */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder={`${terms.child}名・コード・都道府県で検索…`}
                className="w-full sm:w-64"
              />
              <Select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="w-full sm:w-44"
                aria-label="担当者で絞り込み"
              >
                <option value="all">すべての担当者</option>
                <option value="unassigned">未割当のみ</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <div className="flex gap-1.5">
                {(
                  [
                    ["all", "すべて"],
                    ["dormant", "休眠のみ"],
                    ["never", "接点なし"],
                    ["unassigned", "未割当"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setDormancyFilter(key)}
                    className={cn(
                      "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
                      dormancyFilter === key
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 一括操作バー（担当の振り替えはマネージャー以上） */}
            {canEditMaster && selected.size > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50/70 px-4 py-2.5 dark:border-cyan-500/30 dark:bg-cyan-500/10">
                <p className="text-sm font-semibold">
                  {selected.size}
                  {terms.child}を選択中
                </p>
                <Button size="sm" onClick={() => setBulkOpen(true)}>
                  <Users className="h-4 w-4" />
                  担当者を変更
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  選択を解除
                </Button>
              </div>
            )}

            <BranchTable
              stats={visible}
              bankNameOf={bankNameOf}
              orgNameOf={orgNameOf}
              colorOf={colorOf}
              selected={selected}
              selectable={canEditMaster}
              onToggle={toggleSelect}
              onToggleAll={toggleSelectAll}
              sortKey={sortKey}
              asc={asc}
              onSort={toggleSort}
              onEdit={canAddMaster ? (b) => setBranchForm({ initial: b }) : undefined}
              onLogActivity={setActivityTarget}
              showBankColumn={!selectedBank}
              terms={terms}
            />

            {/* 凡例 */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>休眠バッジ:</span>
              {(["fresh", "warn", "alert", "critical", "never"] as const).map((level) => (
                <span key={level} className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", DORMANCY_STYLE[level].dot)} />
                  {DORMANCY_STYLE[level].label}
                  {level === "warn" && `（${settings.dormantWarnDays}日〜）`}
                  {level === "alert" && `（${settings.dormantAlertDays}日〜）`}
                  {level === "critical" && `（${settings.dormantCriticalDays}日〜）`}
                </span>
              ))}
              <Link href="/settings" className="text-cyan-600 hover:underline dark:text-cyan-400">
                閾値を変更
              </Link>
            </div>
          </div>
        </>
      )}

      {/* ---------- モーダル ---------- */}
      {bankForm && (
        <BankFormModal
          key={bankForm.initial?.id ?? "new-bank"}
          initial={bankForm.initial}
          onClose={() => setBankForm(null)}
          onSubmit={saveBank}
          onDelete={canEditMaster ? removeBank : undefined}
        />
      )}
      {branchForm && (
        <BranchFormModal
          key={branchForm.initial?.id ?? "new-branch"}
          initial={branchForm.initial}
          defaultBankId={selectedBankId ?? unitBanks[0]?.id ?? ""}
          banks={unitBanks}
          members={members}
          organizations={activeOrgs}
          onClose={() => setBranchForm(null)}
          onSubmit={saveBranch}
          onDelete={canEditMaster ? removeBranch : undefined}
        />
      )}
      {activityTarget && (
        <BranchActivityModal
          key={activityTarget.id}
          branch={activityTarget}
          bankName={bankNameOf(activityTarget.bank_id)}
          onClose={() => setActivityTarget(null)}
          onSubmit={(values) => logActivity(activityTarget, values)}
        />
      )}
      {importOpen && (
        <BranchImportModal
          banks={unitBanks}
          branches={unitBranches}
          onClose={() => setImportOpen(false)}
          onConfirm={applyImport}
        />
      )}
      {bulkOpen && (
        <BulkAssignModal
          count={selected.size}
          members={members}
          organizations={activeOrgs}
          onClose={() => setBulkOpen(false)}
          onSubmit={bulkAssign}
        />
      )}
    </div>
  );
}

// ---------- 並び替え ----------
function sortStats(a: BranchStat, b: BranchStat, key: BranchSortKey, asc: boolean): number {
  const dir = asc ? 1 : -1;
  switch (key) {
    case "name":
      return a.branch.name.localeCompare(b.branch.name, "ja") * dir;
    case "assigned":
      return a.branch.assigned_name.localeCompare(b.branch.assigned_name, "ja") * dir;
    case "recentAppointments":
      return (a.recentAppointments - b.recentAppointments) * dir;
    case "wonCount":
      return (a.wonCount - b.wonCount) * dir;
    case "winRate":
      // 未算出（結果が出たアポなし）は常に末尾
      if (a.winRate === null && b.winRate === null) return 0;
      if (a.winRate === null) return 1;
      if (b.winRate === null) return -1;
      return (a.winRate - b.winRate) * dir;
    case "lastContact":
    default: {
      // 接点なしは「最も放置されている」ため、経過日数の降順では先頭に置く
      const av = a.daysSinceContact ?? Number.MAX_SAFE_INTEGER;
      const bv = b.daysSinceContact ?? Number.MAX_SAFE_INTEGER;
      return (av - bv) * dir;
    }
  }
}

function normalize(name: string): string {
  return name.replace(/[\s　]/g, "");
}
