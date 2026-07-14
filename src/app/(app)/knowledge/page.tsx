"use client";

// =============================================================
// ナレッジ共有 — 営業ノウハウ・事例・商材知識のストック
// ピン留め / カテゴリ・タグ・全文検索 / いいね / 閲覧数ランキング
// =============================================================

import { useMemo, useState } from "react";
import { BookOpen, Eye, FilePlus2, Heart, Pin, Plus, Tag, TrendingUp } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
  SearchInput,
  StatCard,
  Tabs,
} from "@/components/ui";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { KNOWLEDGE_CATEGORIES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Knowledge, KnowledgeCategory } from "@/lib/types";
import { ArticleCard } from "./article-card";
import { DetailModal, FormModal, type KnowledgeFormValues } from "./knowledge-modals";
import { byUpdatedDesc, isThisMonth, loadLikedIds, parseTags, saveLikedIds } from "./helpers";

type TabKey = KnowledgeCategory | "all";

const RANK_STYLES = [
  "bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30",
  "bg-gradient-to-br from-slate-300 to-slate-400 text-white dark:from-slate-500 dark:to-slate-600",
  "bg-gradient-to-br from-orange-300 to-amber-600 text-white",
];

export default function KnowledgePage() {
  const { items, loading, add, update, remove } = useCollection("knowledge");
  const { items: profiles } = useCollection("profiles");
  const { user } = useUser();

  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Knowledge | null>(null);
  // いいね済みIDは初期化時に読み込む。
  // 初回描画は loading 中の PageSkeleton なので SSR とのハイドレーション不一致は起きない。
  const [likedIds, setLikedIds] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : loadLikedIds()
  );

  // ---------- 派生データ ----------
  const authorColor = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.name, p.color]));
    return (name: string) => map.get(name) ?? "indigo";
  }, [profiles]);

  const counts = useMemo(() => {
    const c = {} as Record<KnowledgeCategory, number>;
    (Object.keys(KNOWLEDGE_CATEGORIES) as KnowledgeCategory[]).forEach((k) => (c[k] = 0));
    items.forEach((a) => (c[a.category] += 1));
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((a) => {
      if (tab !== "all" && a.category !== tab) return false;
      if (!kw) return true;
      return (
        a.title.toLowerCase().includes(kw) ||
        a.content.toLowerCase().includes(kw) ||
        a.tags.some((t) => t.toLowerCase().includes(kw))
      );
    });
  }, [items, tab, q]);

  const pinnedItems = useMemo(
    () => filtered.filter((a) => a.pinned).sort(byUpdatedDesc),
    [filtered]
  );
  const normalItems = useMemo(
    () => filtered.filter((a) => !a.pinned).sort(byUpdatedDesc),
    [filtered]
  );

  const topViewed = useMemo(
    () => [...items].sort((a, b) => b.views - a.views).slice(0, 3),
    [items]
  );

  const popularTags = useMemo(() => {
    const m = new Map<string, number>();
    items.forEach((a) => a.tags.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1)));
    return Array.from(m.entries())
      .sort((x, y) => y[1] - x[1])
      .slice(0, 10);
  }, [items]);

  if (loading) return <PageSkeleton />;

  const detail = detailId ? (items.find((a) => a.id === detailId) ?? null) : null;
  const totalLikes = items.reduce((s, a) => s + a.likes, 0);
  const totalViews = items.reduce((s, a) => s + a.views, 0);
  const monthlyPosts = items.filter((a) => isThisMonth(a.created_at)).length;
  const monthLabel = `${new Date().getMonth() + 1}月`;

  // ---------- 操作 ----------
  const openDetail = (a: Knowledge) => {
    setDetailId(a.id);
    void update(a.id, { views: a.views + 1 });
  };

  const toggleLike = (a: Knowledge) => {
    const wasLiked = likedIds.has(a.id);
    const next = new Set(likedIds);
    if (wasLiked) next.delete(a.id);
    else next.add(a.id);
    setLikedIds(next);
    saveLikedIds(next);
    void update(a.id, { likes: Math.max(0, a.likes + (wasLiked ? -1 : 1)) });
  };

  const togglePin = (a: Knowledge) => {
    void update(a.id, { pinned: !a.pinned });
  };

  const startCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const startEdit = (a: Knowledge) => {
    setEditing(a);
    setDetailId(null);
    setFormOpen(true);
  };

  const handleDelete = async (a: Knowledge) => {
    if (!confirm(`「${a.title}」を削除しますか？この操作は取り消せません。`)) return;
    await remove(a.id);
    setDetailId(null);
  };

  const handleSubmit = async (v: KnowledgeFormValues) => {
    const base = {
      title: v.title.trim(),
      category: v.category,
      tags: parseTags(v.tags),
      content: v.content,
      pinned: v.pinned,
      updated_at: new Date().toISOString(),
    };
    if (editing) {
      await update(editing.id, base);
    } else {
      await add({ ...base, author_name: user?.name ?? "名無し", likes: 0, views: 0 });
    }
  };

  const searchByTag = (t: string) => {
    setTab("all");
    setQ(t);
  };

  const tabDefs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "すべて", count: items.length },
    ...(Object.keys(KNOWLEDGE_CATEGORIES) as KnowledgeCategory[]).map((k) => ({
      key: k as TabKey,
      label: KNOWLEDGE_CATEGORIES[k].label,
      count: counts[k],
    })),
  ];

  return (
    <div>
      <PageHeader
        title="ナレッジ共有"
        description="営業ノウハウ・切り返しトーク・事例をチームの資産に"
        icon={<BookOpen className="h-5 w-5" />}
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            記事を投稿
          </Button>
        }
      />

      {/* 統計 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="記事数"
          value={items.length}
          sub="チームの知見ストック"
          icon={<BookOpen className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="今月の投稿"
          value={monthlyPosts}
          sub={`${monthLabel}の新着記事`}
          icon={<FilePlus2 className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="総いいね数"
          value={totalLikes}
          sub="チームからの評価"
          icon={<Heart className="h-5 w-5" />}
          accent="rose"
        />
        <StatCard
          label="総閲覧数"
          value={totalViews.toLocaleString("ja-JP")}
          sub="ナレッジ活用の広がり"
          icon={<Eye className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* メイン: フィルタ + 記事リスト */}
        <div className="min-w-0 lg:col-span-2">
          <Tabs<TabKey> tabs={tabDefs} active={tab} onChange={setTab} className="mb-3" />
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="タイトル・本文・タグで検索…"
            className="mb-4"
          />

          {filtered.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-10 w-10" />}
              title={items.length === 0 ? "まだ記事がありません" : "該当する記事がありません"}
              description={
                items.length === 0
                  ? "最初のナレッジを投稿して、チームの知見を蓄積しましょう"
                  : "検索条件やカテゴリを変えてみてください"
              }
              action={
                items.length === 0 ? (
                  <Button onClick={startCreate}>
                    <Plus className="h-4 w-4" />
                    最初の記事を投稿
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-6">
              {pinnedItems.length > 0 && (
                <section>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-600 dark:text-amber-400">
                    <Pin className="h-3.5 w-3.5" />
                    ピン留め
                  </p>
                  <div className="space-y-3">
                    {pinnedItems.map((a) => (
                      <ArticleCard
                        key={a.id}
                        article={a}
                        liked={likedIds.has(a.id)}
                        authorColor={authorColor(a.author_name)}
                        onOpen={() => openDetail(a)}
                        onTagClick={searchByTag}
                      />
                    ))}
                  </div>
                </section>
              )}
              {normalItems.length > 0 && (
                <section>
                  {pinnedItems.length > 0 && (
                    <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500">
                      更新順
                    </p>
                  )}
                  <div className="space-y-3">
                    {normalItems.map((a) => (
                      <ArticleCard
                        key={a.id}
                        article={a}
                        liked={likedIds.has(a.id)}
                        authorColor={authorColor(a.author_name)}
                        onOpen={() => openDetail(a)}
                        onTagClick={searchByTag}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* サイド: ランキング + 人気タグ */}
        <aside className="space-y-4 self-start lg:sticky lg:top-20">
          <Card className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
              <TrendingUp className="h-4 w-4 text-indigo-500" />
              よく読まれている記事
            </h2>
            {topViewed.length === 0 ? (
              <p className="text-sm text-slate-400 dark:text-slate-500">まだ記事がありません</p>
            ) : (
              <ol className="space-y-1">
                {topViewed.map((a, i) => (
                  <li key={a.id}>
                    <button
                      onClick={() => openDetail(a)}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          RANK_STYLES[i]
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-sm leading-snug font-medium">
                          {a.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                          <Eye className="h-3 w-3" />
                          {a.views} 回閲覧
                          <Heart className="ml-1.5 h-3 w-3" />
                          {a.likes}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {popularTags.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
                <Tag className="h-4 w-4 text-indigo-500" />
                人気のタグ
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {popularTags.map(([t, n]) => (
                  <button
                    key={t}
                    onClick={() => searchByTag(t)}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      q === t
                        ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                        : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                    )}
                  >
                    #{t}
                    <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">{n}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </aside>
      </div>

      {/* 記事詳細 */}
      <DetailModal
        article={detail}
        liked={detail ? likedIds.has(detail.id) : false}
        authorColor={detail ? authorColor(detail.author_name) : "indigo"}
        onClose={() => setDetailId(null)}
        onToggleLike={() => detail && toggleLike(detail)}
        onTogglePin={() => detail && togglePin(detail)}
        onEdit={() => detail && startEdit(detail)}
        onDelete={() => detail && void handleDelete(detail)}
      />

      {/* 作成 / 編集 */}
      <FormModal
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
