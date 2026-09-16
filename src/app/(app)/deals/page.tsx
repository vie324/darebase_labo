"use client";

// =============================================================
// 案件管理 — 商談カンバン（1階）/ 受注後カンバン（2階）/ リスト / レポート。
//
// 1階は「商談予定 → 後追い C/B/A → 発注書待ち → 受注／失注」。
// 受注（発注書受領）した案件は2階に移り、契約・見積 → リース審査 →
// 設置調整中 → 設置待ち → 開通済み で完工まで追う。
// 列の定義と遷移ルールは lib/constants.ts と lib/pipeline.ts に集約。
// ステージ移動は deal_activities に履歴を自動記録し、updated_at を更新する。
// =============================================================

import { useState } from "react";
import { Briefcase, Percent, Plus, Target, TrendingUp, Trophy } from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useBusinessUnit } from "@/lib/use-business-unit";
import { filterByUnit } from "@/lib/business-units";
import { dealHasProduct } from "@/lib/products";
import { UnitSwitch } from "@/components/ui/unit-switch";
import { UnitMissing } from "@/components/ui/unit-missing";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { DEAL_STAGES, FULFILLMENT_GROUPS } from "@/lib/constants";
import {
  columnByKey,
  columnKeyOf,
  fulfillmentGroupOf,
  fulfillmentLabel,
  fulfillmentTransition,
  pipelineTransition,
} from "@/lib/pipeline";
import { formatYenShort, todayStr } from "@/lib/utils";
import type { ActivityType, Deal } from "@/lib/types";
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
import { FulfillmentBoard } from "./fulfillment-board";
import { DealList } from "./deal-list";
import { DealReport } from "./deal-report";
import { DealDetailModal, DealFormModal, type NewDealLine } from "./deal-modals";
import { DealProductsPanel } from "./deal-products";
import { DensityToggle } from "@/components/ui/density-toggle";

type ViewKey = "board" | "fulfillment" | "list" | "report";

export default function DealsPage() {
  const { user } = useUser();
  // 代理店ユーザーが登録した案件は自社（organization）に紐づける。
  // これが無いと RLS のスコープ外になり保存できない（本部ユーザーは null）。
  const { organizationId, can, loading: accessLoading } = useAccess();
  const deals = useCollection("deals");
  const activities = useCollection("deal_activities");
  const profiles = useCollection("profiles");
  // 失注分析で要因を拾うために商談ログを読む
  const meetingLogs = useCollection("meeting_logs");
  // 案件に載せた商材（1案件に複数載る）
  const dealProducts = useCollection("deal_products");
  const products = useCollection("products");
  // 事業部で商談を出し分ける
  const { slug, unitId, defaultUnitId, missing, setSlug, createUnit } = useBusinessUnit();

  const [view, setView] = useState<ViewKey>("board");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("all");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Deal | null>(null);

  if (
    !user ||
    accessLoading ||
    deals.loading ||
    activities.loading ||
    profiles.loading ||
    meetingLogs.loading ||
    dealProducts.loading ||
    products.loading
  ) {
    return <PageSkeleton />;
  }

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const today = todayStr();
  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "cyan";

  // 事業部で絞る。business_unit_id が空の既存案件は銀行営業として扱う
  const unitDeals = filterByUnit(deals.items, unitId, defaultUnitId);
  /** 新しく作る案件に入れる事業部。行がまだ無ければ既定の事業部に寄せる */
  const defaultBusinessUnitId = unitId ?? defaultUnitId;

  const owners = Array.from(
    new Set([...profiles.items.map((p) => p.name), ...unitDeals.map((d) => d.owner_name)])
  ).filter(Boolean);

  const q = query.trim().toLowerCase();
  const filtered = unitDeals.filter((d) => {
    if (ownerFilter !== "all" && d.owner_name !== ownerFilter) return false;
    if (productFilter !== "all" && !dealHasProduct(dealProducts.items, d.id, productFilter)) {
      return false;
    }
    if (q && !d.name.toLowerCase().includes(q) && !d.company.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });

  const openDeals = unitDeals.filter((d) => isOpenStage(d.stage));
  const wonDeals = unitDeals.filter((d) => d.stage === "won");
  const lostCount = unitDeals.filter((d) => d.stage === "lost").length;
  const pipelineTotal = sumAmount(openDeals);
  const weighted = Math.round(weightedAmount(openDeals));
  const wonAmount = sumAmount(wonDeals);
  const winRate =
    wonDeals.length + lostCount > 0
      ? Math.round((wonDeals.length / (wonDeals.length + lostCount)) * 100)
      : null;

  // 受注後（2階）の案件と、まだ開通していない件数
  const fulfillmentDeals = unitDeals.filter((d) => d.stage === "won");
  const activatedKey = FULFILLMENT_GROUPS[FULFILLMENT_GROUPS.length - 1].key;
  const inProgressCount = fulfillmentDeals.filter(
    (d) => fulfillmentGroupOf(d.fulfillment_status) !== activatedKey
  ).length;

  const activeProducts = products.items
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ja"));

  const detailDeal = detailId ? (deals.items.find((d) => d.id === detailId) ?? null) : null;
  const detailActivities = detailDeal
    ? activities.items
        .filter((a) => a.deal_id === detailDeal.id)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];

  // ---------- 操作 ----------

  /** 商談カンバン（1階）の列移動。確度ランクと確度(%)もまとめて更新される */
  const changeColumn = async (deal: Deal, toColumnKey: string) => {
    const from = columnByKey(columnKeyOf(deal));
    const to = columnByKey(toColumnKey);
    if (!to || from?.key === to.key) return;
    await deals.update(deal.id, pipelineTransition(deal, toColumnKey, today));
    await activities.add({
      deal_id: deal.id,
      type: "stage_change",
      note: `${from?.label ?? DEAL_STAGES[deal.stage].label} → ${to.label} に変更`,
      author_name: user.name,
    });
  };

  /** 受注後カンバン（2階）の列移動。その列の先頭フェーズに設定する */
  const changeFulfillmentGroup = async (deal: Deal, toGroupKey: string) => {
    const patch = fulfillmentTransition(toGroupKey, today);
    if (!patch.fulfillment_status) return;
    await deals.update(deal.id, patch);
    await activities.add({
      deal_id: deal.id,
      type: "stage_change",
      note: `受注後フェーズを「${fulfillmentLabel(patch.fulfillment_status)}」に変更`,
      author_name: user.name,
    });
  };

  /** 受注後の詳細フェーズ（11段）を直接指定する */
  const changeFulfillmentStage = async (deal: Deal, toStageKey: string) => {
    if (deal.fulfillment_status === toStageKey) return;
    await deals.update(deal.id, {
      fulfillment_status: toStageKey,
      fulfillment_updated_at: today,
      updated_at: new Date().toISOString(),
    });
    await activities.add({
      deal_id: deal.id,
      type: "stage_change",
      note: `受注後フェーズを「${fulfillmentLabel(toStageKey)}」に変更`,
      author_name: user.name,
    });
  };

  /**
   * 案件に商材を1つ載せる。
   * 案件の金額は明細の合計を正とするので、追加のたびに deals.amount も揃えておく
   * （明細を読まない既存の集計・CSV出力とも数字がずれないようにするため）。
   */
  const addDealProduct = async (deal: Deal, productId: string, amount: number) => {
    const master = activeProducts.find((p) => p.id === productId);
    if (!master) return;
    await dealProducts.add({
      deal_id: deal.id,
      product_id: master.id,
      // マスタを改名しても当時の名前が残るようスナップショットする
      product_name: master.name,
      amount,
      quantity: 1,
      memo: "",
    });
    const nextTotal =
      dealProducts.items
        .filter((l) => l.deal_id === deal.id)
        .reduce((sum, l) => sum + l.amount, 0) + amount;
    await deals.update(deal.id, { amount: nextTotal, updated_at: new Date().toISOString() });
  };

  const removeDealProduct = async (deal: Deal, lineId: string) => {
    await dealProducts.remove(lineId);
    const rest = dealProducts.items.filter((l) => l.deal_id === deal.id && l.id !== lineId);
    // 明細が全部無くなったら案件の金額は触らない（元の金額をそのまま残す）
    if (rest.length > 0) {
      await deals.update(deal.id, {
        amount: rest.reduce((sum, l) => sum + l.amount, 0),
        updated_at: new Date().toISOString(),
      });
    }
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

  const saveDeal = async (values: DealFormValues, lines: NewDealLine[] = []) => {
    const now = new Date().toISOString();
    if (editTarget) {
      await deals.update(editTarget.id, { ...values, updated_at: now });
    } else {
      // いま開いている事業部の案件として登録する。
      // これを入れ忘れると business_unit_id が空のまま入り、既定の事業部
      // （＝銀行営業）の案件として扱われてしまう。
      const row = await deals.add({
        ...values,
        business_unit_id: defaultBusinessUnitId,
        updated_at: now,
        organization_id: organizationId,
        owner_id: user.id,
      });
      // 登録フォームで選んだ商材を明細として入れる
      for (const line of lines) {
        await dealProducts.add({
          deal_id: row.id,
          product_id: line.product_id,
          product_name: line.product_name,
          amount: line.amount,
          quantity: 1,
          memo: "",
        });
      }
      const productNote =
        lines.length > 0 ? `（${lines.map((l) => l.product_name).join(" / ")}）` : "";
      await activities.add({
        deal_id: row.id,
        type: "note",
        note: `案件を新規登録しました${productNote}`,
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

      {/* 事業部の切り替え。銀行営業とアライアンス営業の商談を混ぜない */}
      <UnitSwitch slug={slug} onChange={setSlug} className="mb-5 w-full sm:w-auto" />

      {missing ? (
        // 事業部の行が無いまま一覧を出すと、絞り込みが効かず両事業部の案件が混ざる
        <UnitMissing slug={slug} canCreate={can("master_add")} onCreate={createUnit} />
      ) : (
        <>
      {/* ---------- サマリー ---------- */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
          sub={`${wonDeals.length}件を受注 / 完工待ち ${inProgressCount}件`}
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
            { key: "board", label: "商談", count: filtered.length },
            { key: "fulfillment", label: "受注後", count: fulfillmentDeals.length },
            { key: "list", label: "リスト", count: filtered.length },
            { key: "report", label: "レポート" },
          ]}
          active={view}
          onChange={setView}
        />
        {view !== "report" && (
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {view === "list" && <DensityToggle className="hidden lg:inline-flex" />}
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="案件名・会社名で検索…"
              className="w-full sm:w-64"
            />
            <Select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="w-full sm:w-40"
              aria-label="商材で絞り込み"
            >
              <option value="all">すべての商材</option>
              {activeProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
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
            onColumnChange={changeColumn}
          />
        )}
        {view === "fulfillment" && (
          <FulfillmentBoard
            deals={filtered.filter((d) => d.stage === "won")}
            today={today}
            colorOf={colorOf}
            onCardClick={(d) => setDetailId(d.id)}
            onGroupChange={changeFulfillmentGroup}
            onStageChange={changeFulfillmentStage}
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
        {view === "report" && (
          <DealReport deals={unitDeals} logs={meetingLogs.items} colorOf={colorOf} />
        )}
      </div>
        </>
      )}

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
            // 詳細を閉じてから編集を開く（開いたままだと同じ key の
            // モーダルが2つ並び、React が重複 key を警告する）
            setDetailId(null);
            setEditTarget(d);
            setFormOpen(true);
          }}
          onDelete={removeDeal}
          onColumnChange={changeColumn}
          onAddActivity={addActivity}
          productsPanel={
            <DealProductsPanel
              dealId={detailDeal.id}
              dealAmountFallback={detailDeal.amount}
              products={activeProducts}
              lines={dealProducts.items}
              canEdit
              onAdd={(productId, amount) => addDealProduct(detailDeal, productId, amount)}
              onRemove={(lineId) => removeDealProduct(detailDeal, lineId)}
            />
          }
        />
      )}

      {formOpen && (
        <DealFormModal
          key={editTarget?.id ?? "new"}
          open
          initial={editTarget}
          members={owners}
          defaultOwner={user.name}
          products={activeProducts}
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
