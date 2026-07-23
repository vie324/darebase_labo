"use client";

// マスタタブ — 取引先 / 手数料率 / LINEグループ紐付けの管理

import { useMemo, useState } from "react";
import { Building2, MessageCircle, Pencil, Percent, Plus, Trash2 } from "lucide-react";
import { cn, formatDate, formatYen } from "@/lib/utils";
import type { Collection } from "@/lib/use-collection";
import type { CommissionRate, LineGroup, Partner, PartnerKind } from "@/lib/types";
import { LINE_GROUP_STATUSES, PARTNER_KINDS } from "@/lib/constants";
import { Badge, Button, Card, EmptyState, Select, Tabs } from "@/components/ui";
import { LineGroupFormModal, PartnerFormModal, RateFormModal } from "./master-modals";
import { partnerName } from "./shared";

type Section = "partners" | "rates" | "line";

export function MastersTab({
  partners,
  rates,
  lineGroups,
  isDemo,
  notify,
}: {
  partners: Collection<Partner>;
  rates: Collection<CommissionRate>;
  lineGroups: Collection<LineGroup>;
  isDemo: boolean;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [section, setSection] = useState<Section>("partners");

  return (
    <div className="space-y-4">
      <Tabs
        tabs={[
          { key: "partners", label: "取引先", count: partners.items.length },
          { key: "rates", label: "手数料率", count: rates.items.length },
          { key: "line", label: "LINEグループ", count: lineGroups.items.length },
        ]}
        active={section}
        onChange={setSection}
      />
      {section === "partners" && <PartnersSection partners={partners} notify={notify} />}
      {section === "rates" && (
        <RatesSection rates={rates} partners={partners.items} notify={notify} />
      )}
      {section === "line" && (
        <LineGroupsSection lineGroups={lineGroups} partners={partners.items} isDemo={isDemo} notify={notify} />
      )}
    </div>
  );
}

// =============================================================
// 取引先
// =============================================================
function PartnersSection({
  partners,
  notify,
}: {
  partners: Collection<Partner>;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [kindFilter, setKindFilter] = useState<"all" | PartnerKind>("all");
  const [editing, setEditing] = useState<Partner | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = partners.items
    .filter((p) => kindFilter === "all" || p.kind === kindFilter)
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name, "ja"));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5">
          {(["all", "maker", "agency", "client"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors",
                kindFilter === k
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
              )}
            >
              {k === "all" ? "すべて" : PARTNER_KINDS[k].label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          取引先を登録
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-10 w-10" />}
          title="取引先が登録されていません"
          description="メーカー・代理店・顧客を登録すると請求書や明細計算で使えます"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className={cn("p-4", !p.is_active && "opacity-60")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge className={PARTNER_KINDS[p.kind].color}>{PARTNER_KINDS[p.kind].label}</Badge>
                    {!p.is_active && <Badge>取引停止</Badge>}
                  </div>
                  <p className="mt-1.5 truncate font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    {[p.contact_name, p.phone].filter(Boolean).join(" ・ ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {p.payment_rule || `支払サイト ${p.default_due_days}日`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => setEditing(p)}
                    aria-label="編集"
                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`「${p.name}」を削除しますか？関連する率マスタも使えなくなります。`)) return;
                      await partners.remove(p.id);
                      notify("取引先を削除しました", "info");
                    }}
                    aria-label="削除"
                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PartnerFormModal
          initial={editing}
          defaultKind={kindFilter === "all" ? "agency" : kindFilter}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            if (editing) {
              await partners.update(editing.id, values);
              notify("取引先を更新しました", "success");
            } else {
              await partners.add(values);
              notify("取引先を登録しました", "success");
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// 手数料率
// =============================================================
function RatesSection({
  rates,
  partners,
  notify,
}: {
  rates: Collection<CommissionRate>;
  partners: Partner[];
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [editing, setEditing] = useState<CommissionRate | null>(null);
  const [creating, setCreating] = useState(false);

  // 代理店ごとにグループ化
  const grouped = useMemo(() => {
    const map = new Map<string, CommissionRate[]>();
    for (const r of rates.items) {
      if (!map.has(r.agency_id)) map.set(r.agency_id, []);
      map.get(r.agency_id)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) =>
      partnerName(partners, a[0]).localeCompare(partnerName(partners, b[0]), "ja")
    );
  }, [rates.items, partners]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          代理店×メーカー（×商材）ごとの分配率。明細計算の「計算実行」で自動適用されます。
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          率を登録
        </Button>
      </div>

      {grouped.length === 0 ? (
        <EmptyState
          icon={<Percent className="h-10 w-10" />}
          title="手数料率が登録されていません"
          description="代理店とメーカーの組み合わせごとに率を登録してください"
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([agencyId, list]) => (
            <div key={agencyId} className="card overflow-hidden">
              <p className="border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-sm font-bold dark:border-slate-800 dark:bg-slate-800/40">
                {partnerName(partners, agencyId) || "（削除された代理店）"}
              </p>
              <table className="w-full text-sm">
                <tbody>
                  {list
                    .slice()
                    .sort((a, b) => partnerName(partners, a.maker_id).localeCompare(partnerName(partners, b.maker_id), "ja"))
                    .map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-50 last:border-0 dark:border-slate-800/60"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{partnerName(partners, r.maker_id) || "（削除されたメーカー）"}</p>
                          <p className="text-xs text-slate-400">
                            {r.product_name || "全商材（デフォルト）"}
                            {(r.effective_from || r.effective_to) && (
                              <span className="ml-2">
                                適用: {r.effective_from ? formatDate(r.effective_from) : ""}〜
                                {r.effective_to ? formatDate(r.effective_to) : ""}
                              </span>
                            )}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold whitespace-nowrap tracking-tight">
                          {r.rate_type === "percent" ? `${r.rate_percent}%` : `${formatYen(r.fixed_fee)}/行`}
                        </td>
                        <td className="w-20 px-2 py-2.5 text-right whitespace-nowrap">
                          <button
                            onClick={() => setEditing(r)}
                            aria-label="編集"
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm("この率を削除しますか？")) return;
                              await rates.remove(r.id);
                              notify("率を削除しました", "info");
                            }}
                            aria-label="削除"
                            className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <RateFormModal
          initial={editing}
          partners={partners}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            if (editing) {
              await rates.update(editing.id, values);
              notify("率を更新しました", "success");
            } else {
              await rates.add(values);
              notify("率を登録しました", "success");
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// LINEグループ
// =============================================================
function LineGroupsSection({
  lineGroups,
  partners,
  isDemo,
  notify,
}: {
  lineGroups: Collection<LineGroup>;
  partners: Partner[];
  isDemo: boolean;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [editing, setEditing] = useState<LineGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const sorted = lineGroups.items
    .slice()
    .sort((a, b) => {
      // 未紐付けを先頭に
      const ao = a.status === "unmapped" ? 0 : a.status === "active" ? 1 : 2;
      const bo = b.status === "unmapped" ? 0 : b.status === "active" ? 1 : 2;
      return ao - bo || (a.created_at < b.created_at ? 1 : -1);
    });

  const mapPartner = async (g: LineGroup, partnerId: string) => {
    await lineGroups.update(g.id, {
      partner_id: partnerId || null,
      status: partnerId ? "active" : "unmapped",
    });
    notify(
      partnerId
        ? `「${g.group_name || g.group_id}」を${partnerName(partners, partnerId)}に紐付けました`
        : "紐付けを解除しました",
      "success"
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          公式アカウントが参加している三者グループ（担当者＋クライアント＋公式アカウント）と取引先の紐付け。
          紐付けたグループからの請求書は自動でその取引先に登録されます。
        </p>
        <Button size="sm" variant="secondary" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          手動追加
        </Button>
      </div>

      {isDemo && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
          デモモードです。実運用では、公式アカウントをグループに招待すると Webhook 経由でここに自動登録されます。
        </p>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={<MessageCircle className="h-10 w-10" />}
          title="LINEグループがありません"
          description="公式アカウントをグループに招待すると自動で登録されます"
        />
      ) : (
        <div className="space-y-2">
          {sorted.map((g) => {
            const meta = LINE_GROUP_STATUSES[g.status];
            return (
              <Card key={g.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={meta.color}>{meta.label}</Badge>
                    <p className="truncate font-semibold">{g.group_name || "（名称未設定）"}</p>
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{g.group_id}</p>
                  {g.memo && <p className="mt-0.5 text-xs text-slate-400">{g.memo}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={g.partner_id ?? ""}
                    onChange={(e) => mapPartner(g, e.target.value)}
                    disabled={g.status === "left"}
                    className="h-9 w-52 py-1 text-xs"
                  >
                    <option value="">未紐付け</option>
                    {partners
                      .filter((p) => p.is_active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </Select>
                  <button
                    onClick={() => setEditing(g)}
                    aria-label="編集"
                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm("このグループ登録を削除しますか？")) return;
                      await lineGroups.remove(g.id);
                      notify("グループ登録を削除しました", "info");
                    }}
                    aria-label="削除"
                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <LineGroupFormModal
          initial={editing}
          partners={partners}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={async (values) => {
            if (editing) {
              await lineGroups.update(editing.id, {
                group_name: values.group_name,
                partner_id: values.partner_id || null,
                memo: values.memo,
                status: values.partner_id ? "active" : "unmapped",
              });
              notify("グループを更新しました", "success");
            } else {
              await lineGroups.add({
                group_id: values.group_id,
                group_name: values.group_name,
                partner_id: values.partner_id || null,
                status: values.partner_id ? "active" : "unmapped",
                joined_at: new Date().toISOString(),
                memo: values.memo,
              });
              notify("グループを追加しました", "success");
            }
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
