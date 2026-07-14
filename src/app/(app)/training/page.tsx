"use client";

// =============================================================
// 勉強会 — 営業代理業の商材・ツール勉強会のログ管理
// カテゴリ/発表者/全文フィルタ・一覧/ツール別ビュー・議事録の詳細閲覧
// =============================================================

import { useState } from "react";
import {
  CalendarClock,
  CalendarDays,
  GraduationCap,
  Package,
  Plus,
  Users,
} from "lucide-react";
import {
  Button,
  EmptyState,
  PageHeader,
  PageSkeleton,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { formatDate, todayStr } from "@/lib/utils";
import type { TrainingLog } from "@/lib/types";
import { TrainingCard } from "./training-card";
import { DetailModal, FormModal, type TrainingFormValues } from "./training-modals";
import { byHeldAtDesc, categoryChip, isThisMonth, parseTags } from "./helpers";

type ViewKey = "list" | "by-tool";

export default function TrainingPage() {
  const { items, loading, add, update, remove } = useCollection("trainings");
  const { items: profiles } = useCollection("profiles");
  const { user } = useUser();

  const [view, setView] = useState<ViewKey>("list");
  const [cat, setCat] = useState<string>(""); // "" = すべて
  const [presenter, setPresenter] = useState<string>(""); // "" = 全員
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TrainingLog | null>(null);

  if (loading) return <PageSkeleton />;

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const colorOf = (name: string) =>
    profiles.find((p) => p.name === name)?.color ?? "cyan";

  // カテゴリ（件数付き / 件数降順→名前順）
  const catCount = new Map<string, number>();
  items.forEach((t) => catCount.set(t.category, (catCount.get(t.category) ?? 0) + 1));
  const categories = Array.from(catCount.keys()).sort(
    (a, b) => (catCount.get(b)! - catCount.get(a)!) || a.localeCompare(b, "ja")
  );

  // 発表者（フィルタ用）
  const presenters = Array.from(new Set(items.map((t) => t.presenter))).sort((a, b) =>
    a.localeCompare(b, "ja")
  );

  // ツール一覧・候補
  const tools = Array.from(new Set(items.map((t) => t.tool_name)));

  // 統計
  const total = items.length;
  const toolCount = tools.length;
  const heldThisMonth = items.filter((t) => isThisMonth(t.held_at)).length;
  const latestHeld = items.reduce((acc, t) => (t.held_at > acc ? t.held_at : acc), "");
  const monthLabel = `${new Date().getMonth() + 1}月`;

  // フィルタ
  const kw = q.trim().toLowerCase();
  const filtered = items.filter((t) => {
    if (cat !== "" && t.category !== cat) return false;
    if (presenter !== "" && t.presenter !== presenter) return false;
    if (!kw) return true;
    return (
      t.tool_name.toLowerCase().includes(kw) ||
      t.title.toLowerCase().includes(kw) ||
      t.summary.toLowerCase().includes(kw) ||
      t.content.toLowerCase().includes(kw)
    );
  });
  const sorted = [...filtered].sort(byHeldAtDesc);

  // ツール別グルーピング（最新開催が新しいツール順）
  const groups = new Map<string, TrainingLog[]>();
  sorted.forEach((t) => {
    const arr = groups.get(t.tool_name);
    if (arr) arr.push(t);
    else groups.set(t.tool_name, [t]);
  });
  const toolGroups = Array.from(groups.entries()).sort((a, b) =>
    b[1][0].held_at.localeCompare(a[1][0].held_at)
  );

  const detail = detailId ? (items.find((t) => t.id === detailId) ?? null) : null;

  // ---------- 操作 ----------
  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (t: TrainingLog) => {
    setDetailId(null);
    setEditing(t);
    setFormOpen(true);
  };

  const handleDelete = async (t: TrainingLog) => {
    if (!confirm(`勉強会ログ「${t.title}」を削除しますか？この操作は取り消せません。`)) return;
    await remove(t.id);
    setDetailId(null);
  };

  const handleSubmit = async (v: TrainingFormValues) => {
    const base = {
      title: v.title.trim(),
      tool_name: v.tool_name.trim(),
      category: v.category.trim(),
      held_at: v.held_at,
      presenter: v.presenter.trim(),
      summary: v.summary.trim(),
      content: v.content,
      video_url: v.video_url.trim(),
      material_url: v.material_url.trim(),
      tags: parseTags(v.tags),
    };
    if (editing) await update(editing.id, base);
    else await add(base);
  };

  const catTabs = [
    { key: "", label: "すべて", count: total },
    ...categories.map((c) => ({ key: c, label: c, count: catCount.get(c) ?? 0 })),
  ];

  return (
    <div>
      <PageHeader
        title="勉強会"
        description="商材・ツール勉強会のログをチームの学習資産に"
        icon={<GraduationCap className="h-5 w-5" />}
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            勉強会を記録
          </Button>
        }
      />

      {/* 統計 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="開催回数"
          value={total}
          sub="これまでの勉強会ログ"
          icon={<GraduationCap className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="対象ツール数"
          value={toolCount}
          sub="学んだ商材・ツール"
          icon={<Package className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="今月の開催"
          value={heldThisMonth}
          sub={`${monthLabel}の勉強会`}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="直近の開催日"
          value={latestHeld ? formatDate(latestHeld) : "—"}
          sub={latestHeld ? "最後に学んだ日" : "まだ記録がありません"}
          icon={<CalendarDays className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      {/* カテゴリ Tabs */}
      <Tabs<string>
        tabs={catTabs}
        active={cat}
        onChange={setCat}
        className="mb-3 max-w-full"
      />

      {/* 検索・発表者・ビュー切替 */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="ツール名・タイトル・内容で検索…"
          className="w-full sm:w-80"
        />
        <div className="relative w-full sm:w-52">
          <Users className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Select
            value={presenter}
            onChange={(e) => setPresenter(e.target.value)}
            aria-label="発表者で絞り込み"
            className="pl-10"
          >
            <option value="">発表者：全員</option>
            {presenters.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </div>
        <div className="ml-auto">
          <Tabs<ViewKey>
            tabs={[
              { key: "list", label: "一覧" },
              { key: "by-tool", label: "ツール別" },
            ]}
            active={view}
            onChange={setView}
          />
        </div>
      </div>

      {/* メイン */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<GraduationCap className="h-12 w-12" />}
          title={total === 0 ? "まだ勉強会の記録がありません" : "条件に一致する記録がありません"}
          description={
            total === 0
              ? "最初の勉強会を記録して、チームの学習履歴を残しましょう"
              : "検索キーワードやカテゴリ・発表者を変更してみてください"
          }
          action={
            total === 0 ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                勉強会を記録
              </Button>
            ) : undefined
          }
        />
      ) : view === "list" ? (
        <div className="grid animate-fade-up gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((t) => (
            <TrainingCard
              key={t.id}
              training={t}
              presenterColor={colorOf(t.presenter)}
              onOpen={() => setDetailId(t.id)}
            />
          ))}
        </div>
      ) : (
        <div className="animate-fade-up space-y-8">
          {toolGroups.map(([toolName, list]) => (
            <section key={toolName}>
              <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-sm font-bold text-cyan-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
                  <Package className="h-4 w-4" />
                  {toolName}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  {list.length}回
                </span>
                <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">
                  最終開催 {formatDate(list[0].held_at)}
                </span>
                <span
                  className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-medium ${categoryChip(
                    list[0].category
                  )}`}
                >
                  {list[0].category}
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {list.map((t) => (
                  <TrainingCard
                    key={t.id}
                    training={t}
                    presenterColor={colorOf(t.presenter)}
                    onOpen={() => setDetailId(t.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 詳細 */}
      <DetailModal
        training={detail}
        presenterColor={detail ? colorOf(detail.presenter) : "cyan"}
        onClose={() => setDetailId(null)}
        onEdit={() => detail && openEdit(detail)}
        onDelete={() => detail && void handleDelete(detail)}
      />

      {/* 作成 / 編集 */}
      <FormModal
        open={formOpen}
        editing={editing}
        categoryOptions={categories}
        toolOptions={tools}
        presenterOptions={presenters}
        defaults={{ held_at: todayStr(), presenter: user?.name ?? "" }}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
