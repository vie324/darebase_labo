"use client";

// =============================================================
// 社内掲示板 — お知らせ・質問・共有・雑談をチームでストック
// ピン留め固定 / カテゴリ・全文検索 / いいね / コメントスレッド
// =============================================================

import { useMemo, useState } from "react";
import { HelpCircle, MessageCircle, Newspaper, Pin, Plus, Sparkles } from "lucide-react";
import {
  Button,
  EmptyState,
  PageHeader,
  PageSkeleton,
  SearchInput,
  StatCard,
  Tabs,
} from "@/components/ui";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { POST_CATEGORIES } from "@/lib/constants";
import type { BoardPost, PostCategory, PostComment } from "@/lib/types";
import { PostCard } from "./post-card";
import { DetailModal, FormModal, type PostFormValues } from "./board-modals";
import { byCreatedDesc, isThisWeek, loadLikedIds, saveLikedIds } from "./helpers";

type TabKey = PostCategory | "all";

export default function BoardPage() {
  const { items, loading, add, update, remove } = useCollection("posts");
  const { items: profiles } = useCollection("profiles");
  const { user } = useUser();

  const [tab, setTab] = useState<TabKey>("all");
  const [q, setQ] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BoardPost | null>(null);
  // いいね済みIDは初期化時に読み込む。初回描画は loading 中の
  // PageSkeleton なので SSR とのハイドレーション不一致は起きない。
  const [likedIds, setLikedIds] = useState<Set<string>>(() =>
    typeof window === "undefined" ? new Set() : loadLikedIds()
  );

  // ---------- 派生データ ----------
  const authorColor = useMemo(() => {
    const map = new Map(profiles.map((p) => [p.name, p.color]));
    return (name: string) => map.get(name) ?? "indigo";
  }, [profiles]);

  const counts = useMemo(() => {
    const c = {} as Record<PostCategory, number>;
    (Object.keys(POST_CATEGORIES) as PostCategory[]).forEach((k) => (c[k] = 0));
    items.forEach((p) => (c[p.category] += 1));
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return items.filter((p) => {
      if (tab !== "all" && p.category !== tab) return false;
      if (!kw) return true;
      return (
        p.title.toLowerCase().includes(kw) || p.content.toLowerCase().includes(kw)
      );
    });
  }, [items, tab, q]);

  const pinnedItems = useMemo(
    () => filtered.filter((p) => p.pinned).sort(byCreatedDesc),
    [filtered]
  );
  const normalItems = useMemo(
    () => filtered.filter((p) => !p.pinned).sort(byCreatedDesc),
    [filtered]
  );

  if (loading) return <PageSkeleton />;

  const detail = detailId ? (items.find((p) => p.id === detailId) ?? null) : null;
  const weeklyPosts = items.filter((p) => isThisWeek(p.created_at)).length;
  const unanswered = items.filter(
    (p) => p.category === "question" && p.comments.length === 0
  ).length;

  // ---------- 操作 ----------
  const toggleLike = (p: BoardPost) => {
    const wasLiked = likedIds.has(p.id);
    const next = new Set(likedIds);
    if (wasLiked) next.delete(p.id);
    else next.add(p.id);
    setLikedIds(next);
    saveLikedIds(next);
    void update(p.id, { likes: Math.max(0, p.likes + (wasLiked ? -1 : 1)) });
  };

  const startCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const startEdit = (p: BoardPost) => {
    setEditing(p);
    setDetailId(null);
    setFormOpen(true);
  };

  const handleDelete = async (p: BoardPost) => {
    if (!confirm(`「${p.title}」を削除しますか？この操作は取り消せません。`)) return;
    await remove(p.id);
    setDetailId(null);
  };

  const handleSubmit = async (v: PostFormValues) => {
    const base = {
      title: v.title.trim(),
      category: v.category,
      content: v.content,
      pinned: v.pinned,
    };
    if (editing) {
      await update(editing.id, base);
    } else {
      await add({ ...base, author_name: user?.name ?? "名無し", likes: 0, comments: [] });
    }
  };

  const handleAddComment = async (content: string) => {
    if (!detail) return;
    const comment: PostComment = {
      author_name: user?.name ?? "名無し",
      content,
      created_at: new Date().toISOString(),
    };
    await update(detail.id, { comments: [...detail.comments, comment] });
  };

  const tabDefs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "すべて", count: items.length },
    ...(Object.keys(POST_CATEGORIES) as PostCategory[]).map((k) => ({
      key: k as TabKey,
      label: POST_CATEGORIES[k].label,
      count: counts[k],
    })),
  ];

  return (
    <div>
      <PageHeader
        title="社内掲示板"
        description="お知らせ・質問・ナレッジ共有をチーム全員に届ける"
        icon={<Newspaper className="h-5 w-5" />}
        actions={
          <Button onClick={startCreate}>
            <Plus className="h-4 w-4" />
            投稿する
          </Button>
        }
      />

      {/* 統計 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="投稿数"
          value={items.length}
          sub="掲示板の総投稿"
          icon={<Newspaper className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="今週の投稿"
          value={weeklyPosts}
          sub="直近の盛り上がり"
          icon={<Sparkles className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="未回答の質問"
          value={unanswered}
          sub="まだコメントがない質問"
          icon={<HelpCircle className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      {/* フィルタ */}
      <Tabs<TabKey> tabs={tabDefs} active={tab} onChange={setTab} className="mb-3" />
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="タイトル・本文で検索…"
        className="mb-5"
      />

      {/* 投稿リスト */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-10 w-10" />}
          title={items.length === 0 ? "まだ投稿がありません" : "該当する投稿がありません"}
          description={
            items.length === 0
              ? "最初の投稿を作成して、チームの掲示板を始めましょう"
              : "検索条件やカテゴリを変えてみてください"
          }
          action={
            items.length === 0 ? (
              <Button onClick={startCreate}>
                <Plus className="h-4 w-4" />
                最初の投稿を作成
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
                {pinnedItems.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    liked={likedIds.has(p.id)}
                    authorColor={authorColor(p.author_name)}
                    onOpen={() => setDetailId(p.id)}
                  />
                ))}
              </div>
            </section>
          )}
          {normalItems.length > 0 && (
            <section>
              {pinnedItems.length > 0 && (
                <p className="mb-2 text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500">
                  新着順
                </p>
              )}
              <div className="space-y-3">
                {normalItems.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    liked={likedIds.has(p.id)}
                    authorColor={authorColor(p.author_name)}
                    onOpen={() => setDetailId(p.id)}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* 投稿詳細 */}
      {detail && (
        <DetailModal
          key={detail.id}
          post={detail}
          liked={likedIds.has(detail.id)}
          canManage={detail.author_name === user?.name}
          authorColor={authorColor}
          currentUser={{ name: user?.name ?? "名無し", color: user?.color ?? "indigo" }}
          onClose={() => setDetailId(null)}
          onToggleLike={() => toggleLike(detail)}
          onEdit={() => startEdit(detail)}
          onDelete={() => void handleDelete(detail)}
          onAddComment={handleAddComment}
        />
      )}

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
