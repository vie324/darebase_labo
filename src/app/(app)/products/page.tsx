"use client";

// =============================================================
// 商材マスタ
//
// 入口は DDS だが、AI ほかのクロスセルを載せていく前提で、商材は随時増える。
// コードに固定せず、この画面から追加・改名・並べ替えできるようにする。
//
// 案件の明細には登録時点の商材名を控えているので、ここで改名しても
// 過去の案件の表示は変わらない（lib/products.ts）。
// =============================================================

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Package, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useAccess } from "@/lib/use-access";
import {
  PRODUCT_COLOR_KEYS,
  buildProductStats,
  crossSellRate,
  productColor,
} from "@/lib/products";
import { cn, formatYen } from "@/lib/utils";
import type { Product } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";

const EMPTY = { name: "", slug: "", color: "cyan", unit_price: "", sort_order: "", memo: "" };

export default function ProductsPage() {
  const { can, loading: accessLoading } = useAccess();
  const products = useCollection("products");
  const deals = useCollection("deals");
  const lines = useCollection("deal_products");
  const { toast } = useToast();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const canEdit = can("master_edit");

  const sorted = useMemo(
    () =>
      [...products.items].sort(
        (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "ja")
      ),
    [products.items]
  );

  if (accessLoading || products.loading || deals.loading || lines.loading) {
    return <PageSkeleton />;
  }

  const stats = buildProductStats(sorted, deals.items, lines.items);
  const cross = crossSellRate(
    deals.items.map((d) => d.id),
    lines.items
  );
  const activeCount = sorted.filter((p) => p.is_active).length;

  // 商材名だけが必須。押せない理由は画面にも出す（§UI: 無反応に見せない）
  const nameFilled = draft.name.trim() !== "";
  const canSave = nameFilled && !saving;

  // ---------- 操作 ----------

  const openNew = () => {
    setEditing(null);
    setDraft({ ...EMPTY, sort_order: String((sorted.at(-1)?.sort_order ?? 0) + 10) });
    setSaving(false);
    setFormOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setDraft({
      name: product.name,
      slug: product.slug,
      color: product.color,
      unit_price: String(product.unit_price),
      sort_order: String(product.sort_order),
      memo: product.memo,
    });
    setSaving(false);
    setFormOpen(true);
  };

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSave) return;
    const body = {
      name: draft.name.trim(),
      slug: draft.slug.trim(),
      color: draft.color,
      unit_price: Number(draft.unit_price) || 0,
      sort_order: Number(draft.sort_order) || 0,
      memo: draft.memo.trim(),
      business_unit_id: null,
      updated_at: new Date().toISOString(),
    };
    setSaving(true);
    try {
      if (editing) {
        await products.update(editing.id, body);
        toast(`${body.name} を更新しました`, "success");
      } else {
        await products.add({ ...body, is_active: true });
        toast(`${body.name} を追加しました`, "success");
      }
      setFormOpen(false);
    } catch {
      // 保存できなかったことを黙って飲み込むと「ボタンが効かない」ように見える。
      // 入力は消さずに開いたままにして、理由を出す。
      toast("保存できませんでした。通信状況と権限を確認してください", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (product: Product) => {
    await products.update(product.id, {
      is_active: !product.is_active,
      updated_at: new Date().toISOString(),
    });
  };

  const remove = async (product: Product) => {
    const used = lines.items.filter((l) => l.product_id === product.id).length;
    if (used > 0) {
      toast(
        `${product.name} は ${used}件の案件で使われています。削除せず「取扱終了」にしてください`,
        "error"
      );
      return;
    }
    if (!confirm(`「${product.name}」を削除しますか？`)) return;
    await products.remove(product.id);
    toast("削除しました", "info");
  };

  return (
    <div>
      <PageHeader
        title="商材マスタ"
        description="案件に載せる商材。増えたらここから追加します"
        icon={<Package className="h-5 w-5" />}
        actions={
          canEdit ? (
            <Button size="sm" onClick={openNew}>
              <Plus className="h-4 w-4" />
              商材を追加
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="取扱中の商材"
          value={`${activeCount}件`}
          sub={sorted.length > activeCount ? `取扱終了 ${sorted.length - activeCount}件` : "すべて取扱中"}
          icon={<Package className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="クロスセル率"
          value={cross.rate !== null ? `${cross.rate}%` : "—"}
          sub={`2商材以上 ${cross.multi}件 / 商材登録済み ${cross.total}件`}
          icon={<Plus className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label="受注額の最大"
          value={stats[0] ? formatYen(stats[0].wonAmount) : "—"}
          sub={stats[0]?.product.name ?? "受注なし"}
          icon={<Package className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="進行中の金額"
          value={formatYen(stats.reduce((sum, s) => sum + s.openAmount, 0))}
          sub="商材明細の合計"
          icon={<Package className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      {sorted.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title="商材が登録されていません"
            description="案件に載せる商材を登録すると、案件ごとに選べるようになります"
            action={
              canEdit ? (
                <Button onClick={openNew}>
                  <Plus className="h-4 w-4" />
                  商材を追加
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 sm:px-6">商材</th>
                  <th className="px-4 py-3 text-right">標準単価</th>
                  <th className="px-4 py-3 text-right">案件数</th>
                  <th className="px-4 py-3 text-right">受注</th>
                  <th className="px-4 py-3 text-right">受注額</th>
                  <th className="px-4 py-3 text-right">進行中</th>
                  <th className="px-5 py-3 text-right sm:px-6">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {stats.map(({ product, dealCount, wonCount, wonAmount, openAmount }) => (
                  <tr
                    key={product.id}
                    className="transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 sm:px-6">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge className={cn(productColor(product.color), "font-bold")}>
                          {product.name}
                        </Badge>
                        {!product.is_active && (
                          <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            取扱終了
                          </Badge>
                        )}
                        {product.memo && (
                          <span className="text-xs text-slate-400">{product.memo}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                      {product.unit_price > 0 ? formatYen(product.unit_price) : "都度見積"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{dealCount}件</td>
                    <td className="px-4 py-3 text-right tabular-nums">{wonCount}件</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap text-emerald-600 tabular-nums dark:text-emerald-400">
                      {wonAmount > 0 ? formatYen(wonAmount) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-slate-500 tabular-nums dark:text-slate-400">
                      {openAmount > 0 ? formatYen(openAmount) : "—"}
                    </td>
                    <td className="px-5 py-3 text-right sm:px-6">
                      {canEdit ? (
                        <span className="flex flex-wrap justify-end gap-1.5">
                          <Button size="sm" variant="ghost" onClick={() => toggleActive(product)}>
                            {product.is_active ? "取扱終了" : "再開"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(product)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(product)}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!canEdit && (
        <Card className="mt-4 flex items-start gap-2.5 p-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          商材の追加・編集はマネージャー以上が行います。案件に載せるのは全員できます。
        </Card>
      )}

      {formOpen && (
        <Modal
          open
          onClose={() => setFormOpen(false)}
          title={editing ? "商材を編集" : "商材を追加"}
          onSubmit={save}
          footer={
            <div className="space-y-2">
              {!nameFilled && (
                <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  商材名を入れると保存できます
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
                  キャンセル
                </Button>
                <Button type="submit" disabled={!canSave}>
                  {saving ? "保存中…" : editing ? "保存する" : "登録する"}
                </Button>
              </div>
            </div>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="商材名" required className="sm:col-span-2">
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="例: DDS"
                autoFocus
                required
              />
            </Field>
            <Field label="識別子">
              <Input
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="例: dds（英字。外部連携の突き合わせ用）"
              />
            </Field>
            <Field label="バッジの色">
              <Select
                value={draft.color}
                onChange={(e) => setDraft({ ...draft, color: e.target.value })}
              >
                {PRODUCT_COLOR_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="標準単価（円）">
              <Input
                type="number"
                value={draft.unit_price}
                onChange={(e) => setDraft({ ...draft, unit_price: e.target.value })}
                placeholder="0 = 都度見積"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                案件に載せるときの初期値になります
              </span>
            </Field>
            <Field label="表示順">
              <Input
                type="number"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: e.target.value })}
                placeholder="10"
              />
            </Field>
            <Field label="メモ" className="sm:col-span-2">
              <Textarea
                value={draft.memo}
                onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
                className="min-h-20"
                placeholder="例: 入口商材。設置を伴う"
              />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
