"use client";

// 案件に載せた商材（明細）。
// 入口は DDS で、そこに AI などをクロスセルで足していく前提なので、
// 1案件に複数の商材が乗る。商材はプルダウンから選び、金額は明細ごとに持つ。
// 案件の金額は明細の合計を正とする（lib/products.ts の dealAmount）。
//
// アライアンス営業（showMoney）では、案件管理表の「プラン・プラン数・機器台数」をここで入れる。
// 売上・自社利益・代理店報酬は商材マスタの単価 × 数量（lib/alliance.ts の lineMoney）。
// 単価の無い商材（直販・その他）は売上と自社利益を手で入れ、代理店報酬は 売上 − 自社利益
// （事業計画『月次実績』の成約明細と同じ式）。

import { useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { linesOfDeal, linesTotal, productColor } from "@/lib/products";
import { countUnitOf, lineMoney, type LineMoney } from "@/lib/alliance";
import { cn, formatYen } from "@/lib/utils";
import type { DealProduct, Product } from "@/lib/types";
import { Badge, Button, Input, Select } from "@/components/ui";

/** 明細を1行足すときの値 */
export interface NewLineInput extends LineMoney {
  product_id: string;
  quantity: number;
}

/** 選んだ商材・数量・手入力の金額から、明細のお金を決める */
export function lineInputOf(
  product: Product,
  quantity: number,
  manual: { amount: number | null; profit: number | null },
  showMoney: boolean
): NewLineInput {
  const q = Math.max(1, Math.round(quantity) || 1);
  if (product.unit_price > 0) {
    const std = lineMoney(product, q);
    // 金額だけ手で直した場合も、自社利益・代理店報酬はマスタの単価のまま
    return { product_id: product.id, quantity: q, ...std, amount: manual.amount ?? std.amount };
  }
  // 都度見積（単価なし）。アライアンスでは 売上 − 自社利益 が代理店報酬になる
  const amount = manual.amount ?? 0;
  const profit = showMoney ? Math.min(amount, manual.profit ?? amount) : 0;
  return {
    product_id: product.id,
    quantity: q,
    amount,
    profit,
    agency_fee: showMoney ? Math.max(0, amount - profit) : 0,
  };
}

export function DealProductsPanel({
  dealId,
  dealAmountFallback,
  products,
  lines,
  canEdit,
  emptyText,
  showMoney = false,
  direct = false,
  onAdd,
  onRemove,
}: {
  dealId: string;
  /** 明細が1件も無いときに表示する、案件そのものの金額 */
  dealAmountFallback: number;
  products: Product[];
  lines: DealProduct[];
  canEdit: boolean;
  /** 商材が1件も無いときの案内。未指定なら既定の文言 */
  emptyText?: string;
  /** 自社利益・代理店報酬・数量を出す（アライアンス営業） */
  showMoney?: boolean;
  /** 直販（1次代理店なし）。代理店報酬は自社利益に寄せて表示する */
  direct?: boolean;
  onAdd: (line: NewLineInput) => Promise<void>;
  onRemove: (lineId: string) => Promise<void>;
}) {
  const own = linesOfDeal(lines, dealId);
  const total = linesTotal(own);
  const used = new Set(own.map((l) => l.product_id));
  const selectable = products.filter((p) => p.is_active);

  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [profit, setProfit] = useState("");
  const [saving, setSaving] = useState(false);

  const picked = selectable.find((p) => p.id === productId) ?? null;
  const manualPrice = picked !== null && picked.unit_price === 0;
  const qty = Math.max(1, Number(quantity) || 1);
  const preview = picked
    ? lineInputOf(
        picked,
        qty,
        {
          amount: amount === "" ? null : Number(amount) || 0,
          profit: profit === "" ? null : Number(profit) || 0,
        },
        showMoney
      )
    : null;

  const add = async () => {
    if (!picked || !preview || saving) return;
    setSaving(true);
    try {
      await onAdd(preview);
      setProductId("");
      setQuantity("1");
      setAmount("");
      setProfit("");
    } finally {
      setSaving(false);
    }
  };

  const sumProfit = own.reduce((s, l) => s + (l.profit ?? 0), 0);
  const sumFee = own.reduce((s, l) => s + (l.agency_fee ?? 0), 0);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Package className="h-3.5 w-3.5" />
          {showMoney ? "プラン・機器（商材）" : "商材"}
        </p>
        <p className="text-xs text-slate-400">
          {total === null ? (
            <>案件金額 {formatYen(dealAmountFallback)}（商材未設定）</>
          ) : (
            <>
              合計 <b className="text-slate-600 tabular-nums dark:text-slate-300">{formatYen(total)}</b>
              {!showMoney && own.length >= 2 && (
                <span className="ml-1.5 text-cyan-600 dark:text-cyan-400">クロスセル</span>
              )}
            </>
          )}
        </p>
      </div>

      {own.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          {emptyText ??
            `商材が登録されていません。${canEdit ? "下のプルダウンから選んで追加してください。" : ""}`}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {own.map((line) => {
            const master = products.find((p) => p.id === line.product_id);
            const device = countUnitOf(master) === "device";
            return (
              <li
                key={line.id}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <Badge className={cn(productColor(master?.color ?? "slate"), "shrink-0 font-bold")}>
                  {line.product_name}
                </Badge>
                {(showMoney || line.quantity > 1) && (
                  <span className="shrink-0 text-xs font-semibold text-slate-500 tabular-nums dark:text-slate-400">
                    ×{line.quantity}
                    {device ? "台" : ""}
                  </span>
                )}
                {line.memo && (
                  <span className="min-w-0 truncate text-xs text-slate-400">{line.memo}</span>
                )}
                <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums">
                  {formatYen(line.amount)}
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => onRemove(line.id)}
                    aria-label={`${line.product_name}を外す`}
                    className="shrink-0 cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {showMoney && (
                  <span className="basis-full text-right text-[11px] text-slate-400 tabular-nums">
                    自社利益 {formatYen(line.profit ?? 0)} ・ 代理店報酬 {formatYen(line.agency_fee ?? 0)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {showMoney && own.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-center text-xs dark:bg-slate-800/50">
          <div>
            <p className="text-[11px] text-slate-400">売上</p>
            <p className="font-bold tabular-nums">{formatYen(total ?? 0)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">自社利益{direct ? "（直販）" : ""}</p>
            <p className="font-bold tabular-nums">{formatYen(direct ? sumProfit + sumFee : sumProfit)}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">★代理店報酬</p>
            <p className="font-bold text-amber-600 tabular-nums dark:text-amber-400">
              {formatYen(direct ? 0 : sumFee)}
            </p>
          </div>
          {direct && (
            <p className="col-span-3 text-[11px] text-slate-400">
              1次代理店のない直販なので、代理店報酬は払わず自社利益に入れて数えます
            </p>
          )}
        </div>
      )}

      {canEdit && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setAmount("");
              setProfit("");
            }}
            aria-label="追加する商材"
            className="w-full sm:w-40"
          >
            <option value="">{showMoney ? "プラン・機器を選ぶ…" : "商材を選ぶ…"}</option>
            {selectable.map((p) => (
              <option key={p.id} value={p.id} disabled={used.has(p.id)}>
                {p.name}
                {used.has(p.id) ? "（登録済み）" : ""}
              </option>
            ))}
          </Select>
          {showMoney && (
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label={picked && countUnitOf(picked) === "device" ? "機器台数" : "プラン数"}
              placeholder="数量"
              className="w-full sm:w-20"
            />
          )}
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={
              picked && picked.unit_price > 0
                ? String(picked.unit_price * (showMoney ? qty : 1))
                : showMoney
                  ? "売上"
                  : "金額"
            }
            aria-label={showMoney ? "売上" : "金額"}
            className="w-full sm:w-32"
          />
          {showMoney && manualPrice && (
            <Input
              type="number"
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              placeholder="自社利益"
              aria-label="自社利益"
              className="w-full sm:w-32"
            />
          )}
          <Button type="button" size="sm" onClick={add} disabled={!picked || saving}>
            <Plus className="h-4 w-4" />
            追加
          </Button>
          {showMoney && preview && (
            <span className="basis-full text-[11px] text-slate-400 tabular-nums">
              売上 {formatYen(preview.amount)} ・ 自社利益 {formatYen(preview.profit)} ・ 代理店報酬{" "}
              {formatYen(preview.agency_fee)}
              {manualPrice && "（単価手入力：代理店報酬 ＝ 売上 − 自社利益。売上＝自社利益なら報酬ゼロ）"}
            </span>
          )}
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
