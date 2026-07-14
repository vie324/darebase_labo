"use client";

// =============================================================
// 名刺管理 — カードグリッド / 会社別の2ビュー。
// 検索・タグフィルタ・並び替え・CSVエクスポート・名刺画像付き登録に対応。
// =============================================================

import { useState } from "react";
import { Building2, Contact as ContactIcon, Download, Plus, Tags, UserPlus } from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { AVATAR_COLORS } from "@/lib/constants";
import { cn, todayStr } from "@/lib/utils";
import type { Contact } from "@/lib/types";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  PageSkeleton,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import { companyColor, contactsToCsv, downloadCsv } from "./shared";
import { ContactCard } from "./contact-card";
import { ContactDetailModal, ContactFormModal } from "./contact-modals";

type ViewKey = "cards" | "company";
type SortKey = "recent" | "kana" | "company";

const GRID_CLASS = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export default function ContactsPage() {
  const { user } = useUser();
  const contacts = useCollection("contacts");
  const profiles = useCollection("profiles");

  const [view, setView] = useState<ViewKey>("cards");
  const [query, setQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Contact | null>(null);

  if (!user || contacts.loading || profiles.loading) {
    return <PageSkeleton />;
  }

  // ---------- 派生データ（loading 後のみ計算するのでハイドレーション安全） ----------
  const colorOf = (name: string) =>
    profiles.items.find((p) => p.name === name)?.color ?? "indigo";
  const members = profiles.items.map((p) => p.name);

  // 統計
  const total = contacts.items.length;
  const companyCount = new Set(contacts.items.map((c) => c.company)).size;
  const monthKey = todayStr().slice(0, 7); // YYYY-MM
  const addedThisMonth = contacts.items.filter(
    (c) => c.created_at.slice(0, 7) === monthKey
  ).length;

  // タグ一覧（全 contacts から動的生成、件数付き）
  const tagCounts = new Map<string, number>();
  for (const c of contacts.items) {
    for (const t of c.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const allTags = Array.from(tagCounts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")
  );

  // 検索 + タグフィルタ
  const q = query.trim().toLowerCase();
  const filtered = contacts.items.filter((c) => {
    if (selectedTags.length > 0 && !selectedTags.every((t) => c.tags.includes(t))) {
      return false;
    }
    if (q) {
      const haystack = [c.name, c.name_kana, c.company, c.email].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // 並び替え
  const sorted = [...filtered].sort((a, b) => {
    if (sortKey === "kana") {
      return (a.name_kana || a.name).localeCompare(b.name_kana || b.name, "ja");
    }
    if (sortKey === "company") {
      return (
        a.company.localeCompare(b.company, "ja") ||
        (a.name_kana || a.name).localeCompare(b.name_kana || b.name, "ja")
      );
    }
    // recent: 交換日の新しい順 → 登録日の新しい順
    return (
      (b.exchanged_at || "").localeCompare(a.exchanged_at || "") ||
      b.created_at.localeCompare(a.created_at)
    );
  });

  // 会社別グルーピング（人数が多い順 → 会社名順）
  const byCompany = new Map<string, Contact[]>();
  for (const c of sorted) {
    const key = c.company || "（会社名未登録）";
    if (!byCompany.has(key)) byCompany.set(key, []);
    byCompany.get(key)!.push(c);
  }
  const companyGroups = Array.from(byCompany.entries()).sort(
    (a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "ja")
  );

  const detailContact = detailId
    ? (contacts.items.find((c) => c.id === detailId) ?? null)
    : null;

  // ---------- 操作 ----------
  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };

  const openEdit = (c: Contact) => {
    setEditTarget(c);
    setFormOpen(true);
  };

  const removeContact = async (c: Contact) => {
    if (!confirm(`名刺「${c.name}（${c.company}）」を削除しますか？`)) return;
    await contacts.remove(c.id);
    setDetailId(null);
  };

  const saveContact = async (values: Omit<Contact, "id" | "created_at">) => {
    if (editTarget) {
      await contacts.update(editTarget.id, values);
    } else {
      await contacts.add(values);
    }
    setFormOpen(false);
    setEditTarget(null);
  };

  const exportCsv = () => {
    if (contacts.items.length === 0) return;
    const stamp = todayStr().replaceAll("-", "");
    downloadCsv(`darebase_contacts_${stamp}.csv`, contactsToCsv(contacts.items));
  };

  return (
    <div>
      <PageHeader
        title="名刺管理"
        description="交換した名刺をチームの資産として一元管理"
        icon={<ContactIcon className="h-5 w-5" />}
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              disabled={contacts.items.length === 0}
            >
              <Download className="h-4 w-4" />
              CSVエクスポート
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              名刺を登録
            </Button>
          </>
        }
      />

      {/* ---------- サマリー ---------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="総名刺数"
          value={`${total}枚`}
          sub={`表示中 ${sorted.length}枚`}
          icon={<ContactIcon className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="会社数"
          value={`${companyCount}社`}
          sub="取引先ネットワーク"
          icon={<Building2 className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="今月の追加"
          value={`${addedThisMonth}枚`}
          sub={addedThisMonth > 0 ? "今月も人脈が拡大中" : "今月はまだ登録がありません"}
          icon={<UserPlus className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      {/* ---------- ビュー切替 + 検索・並び替え ---------- */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs<ViewKey>
          tabs={[
            { key: "cards", label: "カード", count: sorted.length },
            { key: "company", label: "会社別", count: companyGroups.length },
          ]}
          active={view}
          onChange={setView}
        />
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="氏名・かな・会社名・メールで検索…"
            className="w-full sm:w-72"
          />
          <Select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="w-full sm:w-44"
            aria-label="並び替え"
          >
            <option value="recent">交換日が新しい順</option>
            <option value="kana">五十音順</option>
            <option value="company">会社名順</option>
          </Select>
        </div>
      </div>

      {/* ---------- タグフィルタ ---------- */}
      {allTags.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Tags className="h-4 w-4 text-slate-400" aria-hidden />
          {allTags.map(([tag, count]) => {
            const active = selectedTags.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={cn(
                  "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  active
                    ? "border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm dark:border-indigo-500/40 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-indigo-500/30 dark:hover:text-indigo-300"
                )}
              >
                #{tag}
                <span className={cn("ml-1", active ? "text-indigo-400" : "text-slate-300 dark:text-slate-600")}>
                  {count}
                </span>
              </button>
            );
          })}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="cursor-pointer px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:text-rose-500 dark:text-slate-500 dark:hover:text-rose-400"
            >
              クリア
            </button>
          )}
        </div>
      )}

      {/* ---------- メインコンテンツ ---------- */}
      <div className="mt-5">
        {sorted.length === 0 ? (
          <EmptyState
            icon={<ContactIcon className="h-12 w-12" />}
            title={total === 0 ? "まだ名刺が登録されていません" : "条件に一致する名刺がありません"}
            description={
              total === 0
                ? "最初の名刺を登録して、チームの人脈データベースを作りましょう"
                : "検索条件やタグフィルタを変更してみてください"
            }
            action={
              total === 0 ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" />
                  名刺を登録
                </Button>
              ) : undefined
            }
          />
        ) : view === "cards" ? (
          <div className={cn(GRID_CLASS, "animate-fade-up")}>
            {sorted.map((c) => (
              <ContactCard key={c.id} contact={c} onClick={() => setDetailId(c.id)} />
            ))}
          </div>
        ) : (
          <div className="animate-fade-up space-y-6">
            {companyGroups.map(([company, list]) => (
              <section key={company}>
                <div className="mb-3 flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl text-white shadow-sm",
                      AVATAR_COLORS[companyColor(company)] ?? "bg-indigo-500"
                    )}
                  >
                    <Building2 className="h-4 w-4" />
                  </span>
                  <h2 className="font-bold">{company}</h2>
                  <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {list.length}名
                  </Badge>
                </div>
                <div className={GRID_CLASS}>
                  {list.map((c) => (
                    <ContactCard
                      key={c.id}
                      contact={c}
                      onClick={() => setDetailId(c.id)}
                      showCompany={false}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ---------- モーダル ---------- */}
      {detailContact && (
        <ContactDetailModal
          key={detailContact.id}
          contact={detailContact}
          colorOf={colorOf}
          onClose={() => setDetailId(null)}
          onEdit={openEdit}
          onDelete={removeContact}
        />
      )}

      {formOpen && (
        <ContactFormModal
          key={editTarget?.id ?? "new"}
          initial={editTarget}
          members={members}
          defaultOwner={user.name}
          onClose={() => {
            setFormOpen(false);
            setEditTarget(null);
          }}
          onSubmit={saveContact}
        />
      )}
    </div>
  );
}
