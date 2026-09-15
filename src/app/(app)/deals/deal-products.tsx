"use client";

// 案件に載せた商材（明細）。
// 入口は DDS で、そこに AI などをクロスセルで足していく前提なので、
// 1案件に複数の商材が乗る。商材はプルダウンから選び、金額は明細ごとに持つ。
// 案件の金額は明細の合計を正とする（lib/products.ts の dealAmount）。

import { useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { linesOfDeal, linesTotal, productColor } from "@/lib/products";
import { cn, formatYen } from "@/lib/utils";
import type { DealProduct, Product } from "@/lib/types";
import { Badge, Button, Input, Select } from "@/components/ui";

export function DealProductsPanel({
  dealId,
  dealAmountFallback,
  products,
  lines,
  canEdit,
  onAdd,
  onRemove,
}: {
  dealId: string;
  /** 明細が1件も無いときに表示する、案件そのものの金額 */
  dealAmountFallback: number;
  products: Product[];
  lines: DealProduct[];
  canEdit: boolean;
  onAdd: (productId: string, amount: number) => Promise<void>;
  onRemove: (lineId: string) => Promise<void>;
}) {
  const own = linesOfDeal(lines, dealId);
  const total = linesTotal(own);
  const used = new Set(own.map((l) => l.product_id));
  const selectable = products.filter((p) => p.is_active);

  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const picked = selectable.find((p) => p.id === productId) ?? null;

  const add = async () => {
    if (!picked || saving) return;
    setSaving(true);
    try {
      // 金額を入れていなければ商材の標準単価を使う
      await onAdd(picked.id, Number(amount) || picked.unit_price);
      setProductId("");
      setAmount("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Package className="h-3.5 w-3.5" />
          商材
        </p>
        <p className="text-xs text-slate-400">
          {total === null ? (
            <>案件金額 {formatYen(dealAmountFallback)}（商材未設定）</>
          ) : (
            <>
              合計 <b className="text-slate-600 tabular-nums dark:text-slate-300">{formatYen(total)}</b>
              {own.length >= 2 && <span className="ml-1.5 text-cyan-600 dark:text-cyan-400">クロスセル</span>}
            </>
          )}
        </p>
      </div>

      {own.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          商材が登録されていません。
          {canEdit && "下のプルダウンから選んで追加してください。"}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {own.map((line) => {
            const master = products.find((p) => p.id === line.product_id);
            return (
              <li
                key={line.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <Badge className={cn(productColor(master?.color ?? "slate"), "shrink-0 font-bold")}>
                  {line.product_name}
                </Badge>
                {line.memo && (
                  <span className="min-w-0 truncate text-xs text-slate-400">{line.memo}</span>
                )}
                <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">
                  {formatYen(line.amount)}
                </span>
                {canEdit && (
                  <button
                    onClick={() => onRemove(line.id)}
                    aria-label={`${line.product_name}を外す`}
                    className="shrink-0 cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            aria-label="追加する商材"
            className="w-full sm:w-40"
          >
            <option value="">商材を選ぶ…</option>
            {selectable.map((p) => (
              <option key={p.id} value={p.id} disabled={used.has(p.id)}>
                {p.name}
                {used.has(p.id) ? "（登録済み）" : ""}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={picked && picked.unit_price > 0 ? String(picked.unit_price) : "金額"}
            aria-label="金額"
            className="w-full sm:w-32"
          />
          <Button size="sm" onClick={add} disabled={!picked || saving}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
          {selectable.length === 0 && (
            <span className="text-xs text-slate-400">
              商材マスタが空です。設定 &gt; 商材マスタ から追加してください
            </span>
          )}
        </div>
      )}
    </div>
  );
}
