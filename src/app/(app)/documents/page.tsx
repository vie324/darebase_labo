"use client";

// =============================================================
// 営業資料 — 提案書・料金表などのファイルライブラリ。
// グリッド/リスト切替・検索・カテゴリ・並び替え・アップロードに対応。
// =============================================================

import { useState } from "react";
import {
  Download,
  FileUp,
  Files,
  FolderOpen,
  HardDrive,
  LayoutGrid,
  List,
  Trophy,
  Upload,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { cn, todayStr } from "@/lib/utils";
import type { DocCategory, SalesDocument } from "@/lib/types";
import { DOC_CATEGORIES } from "@/lib/constants";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
  ProgressBar,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import { fileTypeStyle, formatSize, type DocFormValues } from "./shared";
import { DocGridCard, DocListRow } from "./doc-card";
import { DocDetailModal, DocFormModal } from "./doc-modals";

type ViewKey = "grid" | "list";
type SortKey = "recent" | "name" | "downloads";
type CategoryKey = DocCategory | "all";

const CATEGORY_KEYS = Object.keys(DOC_CATEGORIES) as DocCategory[];
const RANK_STYLES = [
  "bg-amber-400 text-white", // 1位
  "bg-slate-400 text-white", // 2位
  "bg-orange-400/80 text-white", // 3位
];

export default function DocumentsPage() {
  const { user } = useUser();
  const docs = useCollection("documents");
  const profiles = useCollection("profiles");

  const [view, setView] = useState<ViewKey>("grid");
  const [category, setCategory] = useState<CategoryKey>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SalesDocument | null>(null);

  if (!user || docs.loading || profiles.loading) {
    return <PageSkeleton />;
  }

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "indigo";

  // 統計
  const total = docs.items.length;
  const totalKb = docs.items.reduce((sum, d) => sum + d.size_kb, 0);
  const totalDownloads = docs.items.reduce((sum, d) => sum + d.downloads, 0);
  const monthKey = todayStr().slice(0, 7); // YYYY-MM
  const uploadedThisMonth = docs.items.filter(
    (d) => d.created_at.slice(0, 7) === monthKey
  ).length;

  // 人気資料 TOP3
  const topDocs = [...docs.items]
    .filter((d) => d.downloads > 0)
    .sort((a, b) => b.downloads - a.downloads || b.created_at.localeCompare(a.created_at))
    .slice(0, 3);
  const maxDownloads = topDocs[0]?.downloads ?? 0;

  // カテゴリ件数
  const countOf = (key: DocCategory) =>
    docs.items.filter((d) => d.category === key).length;

  // 検索 + カテゴリフィルタ
  const q = query.trim().toLowerCase();
  const filtered = docs.items.filter((d) => {
    if (category !== "all" && d.category !== category) return false;
    if (q) {
      const haystack = [d.name, d.description, ...d.tags].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 並び替え
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name, "ja");
    if (sortKey === "downloads") {
      return b.downloads - a.downloads || b.created_at.localeCompare(a.created_at);
    }
    return b.created_at.localeCompare(a.created_at); // recent
  });

  const detailDoc = detailId ? (docs.items.find((d) => d.id === detailId) ?? null) : null;

  // ---------- 操作 ----------
  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (d: SalesDocument) => {
    setDetailId(null);
    setEditTarget(d);
    setFormOpen(true);
  };

  const removeDoc = async (d: SalesDocument) => {
    if (!confirm(`資料「${d.name}」を削除しますか？`)) return;
    await docs.remove(d.id);
    setDetailId(null);
  };

  const saveDoc = async (values: DocFormValues) => {
    if (editTarget) {
      await docs.update(editTarget.id, values);
    } else {
      await docs.add({ ...values, uploaded_by: user.name, downloads: 0 });
    }
    setFormOpen(false);
    setEditTarget(null);
  };

  /** <a download> クリック時に DL 数を +1 */
  const countDownload = (d: SalesDocument) => {
    void docs.update(d.id, { downloads: d.downloads + 1 });
  };

  return (
    <div>
      <PageHeader
        title="営業資料"
        description="提案書・料金表・事例集をチームで共有するライブラリ"
        icon={<FolderOpen className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={openCreate}>
            <FileUp className="h-4 w-4" />
            資料をアップロード
          </Button>
        }
      />

      {/* ---------- サマリー ---------- */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="資料数"
          value={`${total}件`}
          sub={`表示中 ${sorted.length}件`}
          icon={<Files className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="総容量"
          value={formatSize(totalKb)}
          sub="ライブラリ全体"
          icon={<HardDrive className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="今月アップロード"
          value={`${uploadedThisMonth}件`}
          sub={uploadedThisMonth > 0 ? "資料が育っています" : "今月はまだありません"}
          icon={<Upload className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="総ダウンロード"
          value={`${totalDownloads}回`}
          sub="チームの活用度"
          icon={<Download className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      {/* ---------- 人気資料 TOP3 ---------- */}
      {topDocs.length > 0 && (
        <Card className="mt-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-bold">よく使われている資料 TOP3</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {topDocs.map((d, i) => {
              const style = fileTypeStyle(d.file_type);
              const Icon = style.icon;
              return (
                <button
                  key={d.id}
                  onClick={() => setDetailId(d.id)}
                  className="cursor-pointer rounded-xl border border-slate-100 p-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:border-slate-800 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/5"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm",
                        RANK_STYLES[i]
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", style.tile)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{d.name}</p>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2">
                    <ProgressBar
                      value={d.downloads}
                      max={maxDownloads}
                      className="h-1.5 flex-1"
                    />
                    <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {d.downloads} DL
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* ---------- カテゴリ + 検索・並び替え・表示切替 ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs<CategoryKey>
          tabs={[
            { key: "all", label: "すべて", count: total },
            ...CATEGORY_KEYS.map((k) => ({
              key: k as CategoryKey,
              label: DOC_CATEGORIES[k].label,
              count: countOf(k),
            })),
          ]}
          active={category}
          onChange={setCategory}
          className="max-w-full"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="資料名・説明・タグで検索…"
          className="w-full sm:w-80"
        />
        <Select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="w-full sm:w-44"
          aria-label="並び替え"
        >
          <option value="recent">新着順</option>
          <option value="name">名前順</option>
          <option value="downloads">ダウンロード数順</option>
        </Select>
        <div className="ml-auto flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/60">
          {(
            [
              { key: "grid", icon: LayoutGrid, label: "グリッド表示" },
              { key: "list", icon: List, label: "リスト表示" },
            ] as const
          ).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setView(key)}
              aria-label={label}
              aria-pressed={view === key}
              className={cn(
                "cursor-pointer rounded-lg p-2 transition-all",
                view === key
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-400"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* ---------- メインコンテンツ ---------- */}
      <div className="mt-5">
        {sorted.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="h-12 w-12" />}
            title={total === 0 ? "まだ資料がありません" : "条件に一致する資料がありません"}
            description={
              total === 0
                ? "最初の資料をアップロードして、チームの武器を揃えましょう"
                : "検索キーワードやカテゴリを変更してみてください"
            }
            action={
              total === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  <FileUp className="h-4 w-4" />
                  資料をアップロード
                </Button>
              ) : undefined
            }
          />
        ) : view === "grid" ? (
          <div className="grid animate-fade-up gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((d) => (
              <DocGridCard
                key={d.id}
                doc={d}
                colorOf={colorOf}
                onOpen={() => setDetailId(d.id)}
                onDownloaded={countDownload}
              />
            ))}
          </div>
        ) : (
          <Card className="animate-fade-up divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {sorted.map((d) => (
              <DocListRow
                key={d.id}
                doc={d}
                colorOf={colorOf}
                onOpen={() => setDetailId(d.id)}
                onDownloaded={countDownload}
              />
            ))}
          </Card>
        )}
      </div>

      {/* デモ資料の注意書き */}
      {docs.isDemo && sorted.some((d) => !d.file_url) && (
        <p className="mt-4 text-center text-xs text-slate-400 dark:text-slate-500">
          <Badge className="mr-1.5 bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
            サンプル
          </Badge>
          表示のデモ資料は実ファイルを持たないためダウンロードできません。
        </p>
      )}

      {/* ---------- モーダル ---------- */}
      {detailDoc && (
        <DocDetailModal
          key={detailDoc.id}
          doc={detailDoc}
          colorOf={colorOf}
          onClose={() => setDetailId(null)}
          onEdit={openEdit}
          onDelete={removeDoc}
          onDownloaded={countDownload}
        />
      )}

      {formOpen && (
        <DocFormModal
          key={editTarget?.id ?? "new"}
          initial={editTarget}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          onSubmit={saveDoc}
        />
      )}
    </div>
  );
}
