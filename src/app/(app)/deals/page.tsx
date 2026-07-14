"use client";

// =============================================================
// 案件管理 — ボード（カンバン）/ リスト / レポートの3ビュー。
// ステージ移動は deal_activities に履歴を自動記録し、
// updated_at を更新する。
// =============================================================

import { useState } from "react";
import { Briefcase, Percent, Plus, Target, TrendingUp, Trophy } from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { DEAL_STAGES } from "@/lib/constants";
import { formatYenShort, todayStr } from "@/lib/utils";
import type { ActivityType, Deal, DealStage } from "@/lib/types";
import {
  Button,
  PageHeader,
  PageSkeleton,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import { isOpenStage, sumAmount, weightedAmount, type DealFormValues } from "./shared";
import { DealBoard } from "./deal-board";
import { DealList } from "./deal-list";
import { DealReport } from "./deal-report";
import { DealDetailModal, DealFormModal } from "./deal-modals";

type ViewKey = "board" | "list" | "report";

export default function DealsPage() {
  const { user } = useUser();
  const deals = useCollection("deals");
  const activities = useCollection("deal_activities");
  const profiles = useCollection("profiles");

  const [view, setView] = useState<ViewKey>("board");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deal | null>(null);

  if (!user || deals.loading || activities.loading || profiles.loading) {
    return <PageSkeleton />;
  }

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const today = todayStr();
  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "cyan";

  const owners = Array.from(
    new Set([...profiles.items.map((p) => p.name), ...deals.items.map((d) => d.owner_name)])
  ).filter(Boolean);

  const q = query.trim().toLowerCase();
  const filtered = deals.items.filter((d) => {
    if (ownerFilter !== "all" && d.owner_name !== ownerFilter) return false;
    if (q && !d.name.toLowerCase().includes(q) && !d.company.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const openDeals = deals.items.filter((d) => isOpenStage(d.stage));
  const wonDeals = deals.items.filter((d) => d.stage === "won");
  const lostCount = deals.items.filter((d) => d.stage === "lost").length;
  const pipelineTotal = sumAmount(openDeals);
  const weighted = Math.round(weightedAmount(openDeals));
  const wonAmount = sumAmount(wonDeals);
  const winRate =
    wonDeals.length + lostCount > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostCount)) * 100)
      : null;

  const detailDeal = detailId ? (deals.items.find((d) => d.id === detailId) ?? null) : null;
  const detailActivities = detailDeal
    ? activities.items
        .filter((a) => a.deal_id === detailDeal.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];

  // ---------- 操作 ----------
  const changeStage = async (deal: Deal, to: DealStage) => {
    if (deal.stage === to) return;
    const patch: Partial<Deal> = { stage: to, updated_at: new Date().toISOString() };
    if (to === "won") patch.probability = 100;
    if (to === "lost") patch.probability = 0;
    await deals.update(deal.id, patch);
    await activities.add({
      deal_id: deal.id,
      type: "stage_change",
      note: `${DEAL_STAGES[deal.stage].label} → ${DEAL_STAGES[to].label} に変更`,
      author_name: user.name,
    });
  };

  const addActivity = async (dealId: string, type: ActivityType, note: string) => {
    await activities.add({ deal_id: dealId, type, note, author_name: user.name });
    await deals.update(dealId, { updated_at: new Date().toISOString() });
  };

  const removeDeal = async (deal: Deal) => {
    if (
      !confirm(`案件「${deal.name}」を削除しますか？\n関連する活動履歴もすべて削除されます。`)
    ) {
      return;
    }
    for (const a of activities.items.filter((x) => x.deal_id === deal.id)) {
      await activities.remove(a.id);
    }
    await deals.remove(deal.id);
    setDetailId(null);
  };

  const saveDeal = async (values: DealFormValues) => {
    const now = new Date().toISOString();
    if (editTarget) {
      await deals.update(editTarget.id, { ...values, updated_at: now });
    } else {
      const row = await deals.add({ ...values, updated_at: now });
      await activities.add({
        deal_id: row.id,
        type: "note",
        note: "案件を新規登録しました",
        author_name: user.name,
      });
    }
    setFormOpen(false);
    setEditTarget(null);
  };

  return (
    <div>
      <PageHeader
        title="案件管理"
        description="パイプラインの進捗をチーム全体で可視化"
        icon={<Briefcase className="h-5 w-5" />}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            新規案件
          </Button>
        }
      />

      {/* ---------- サマリー ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="パイプライン総額"
          value={formatYenShort(pipelineTotal)}
          sub={`進行中 ${openDeals.length}件`}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="加重パイプライン"
          value={formatYenShort(weighted)}
          sub="金額 × 確度で算出"
          icon={<Target className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="受注額"
          value={formatYenShort(wonAmount)}
          sub={`${wonDeals.length}件を受注`}
          icon={<Trophy className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="受注率"
          value={winRate !== null ? `${winRate}%` : "—"}
          sub={`受注 ${wonDeals.length}件 / 失注 ${lostCount}件`}
          icon={<Percent className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      {/* ---------- ビュー切替 + フィルタ ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs<ViewKey>
          tabs={[
            { key: "board", label: "ボード", count: filtered.length },
            { key: "list", label: "リスト", count: filtered.length },
            { key: "report", label: "レポート" },
          ]}
          active={view}
          onChange={setView}
        />
        {view !== "report" && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="案件名・会社名で検索…"
              className="w-full sm:w-64"
            />
            <Select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="w-full sm:w-44"
              aria-label="担当者で絞り込み"
            >
              <option value="all">すべての担当者</option>
              {owners.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* ---------- メインコンテンツ ---------- */}
      <div className="mt-4">
        {view === "board" && (
          <DealBoard
            deals={filtered}
            today={today}
            colorOf={colorOf}
            onCardClick={(d) => setDetailId(d.id)}
            onStageChange={changeStage}
          />
        )}
        {view === "list" && (
          <DealList
            deals={filtered}
            today={today}
            colorOf={colorOf}
            onRowClick={(d) => setDetailId(d.id)}
          />
        )}
        {view === "report" && <DealReport deals={deals.items} colorOf={colorOf} />}
      </div>

      {/* ---------- モーダル ---------- */}
      {detailDeal && (
        <DealDetailModal
          key={detailDeal.id}
          deal={detailDeal}
          activities={detailActivities}
          today={today}
          colorOf={colorOf}
          onClose={() => setDetailId(null)}
          onEdit={(d) => {
            setEditTarget(d);
            setFormOpen(true);
          }}
          onDelete={removeDeal}
          onStageChange={changeStage}
          onAddActivity={addActivity}
        />
      )}

      {formOpen && (
        <DealFormModal
          key={editTarget?.id ?? "new"}
          open
          initial={editTarget}
          members={owners}
          defaultOwner={user.name}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          onSubmit={saveDeal}
        />
      )}
    </div>
  );
}
