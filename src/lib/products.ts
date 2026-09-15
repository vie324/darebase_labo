// =============================================================
// 商材 — マスタと、案件ごとの商材明細
//
// 入口は DDS だが、AI ほかのクロスセルを載せていく前提。
// 商材は随時増えるので、コードに固定せず画面から追加できるマスタにする。
//
// 1案件に複数の商材が乗るため、案件と商材は明細（deal_products）で結ぶ。
// 案件の金額は明細の合計を正とする（明細が無い案件は従来どおり deals.amount）。
// 銀行営業の既存案件は明細を持たないので、そのまま動く。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import を持たない（型のみ）。
// =============================================================

import type { DealProduct, Product } from "./types";

/** 商材の初期値。運用開始時にここから足していく（画面で追加・改名できる） */
export const SEED_PRODUCTS: { name: string; slug: string; color: string }[] = [
  { name: "DDS", slug: "dds", color: "cyan" },
  { name: "AI", slug: "ai", color: "violet" },
];

/** 商材バッジの配色。マスタで選ばせるため、キーは固定の一覧にする */
export const PRODUCT_COLORS: Record<string, string> = {
  cyan: "bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
};

export const PRODUCT_COLOR_KEYS = Object.keys(PRODUCT_COLORS);

export function productColor(color: string): string {
  return PRODUCT_COLORS[color] ?? PRODUCT_COLORS.slate;
}

/** 案件に紐づく商材明細だけを取り出し、並び順を安定させる */
export function linesOfDeal(lines: DealProduct[], dealId: string): DealProduct[] {
  return lines
    .filter((l) => l.deal_id === dealId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** 明細の合計金額。明細が無ければ null（案件の amount をそのまま使う合図） */
export function linesTotal(lines: DealProduct[]): number | null {
  if (lines.length === 0) return null;
  return lines.reduce((sum, l) => sum + l.amount, 0);
}

/**
 * 案件の金額。明細があればその合計、無ければ案件そのものの金額。
 * 集計の入口をここ1本に絞り、明細のある案件と無い案件を同じに扱えるようにする。
 */
export function dealAmount(
  deal: { id: string; amount: number },
  lines: DealProduct[]
): number {
  return linesTotal(linesOfDeal(lines, deal.id)) ?? deal.amount;
}

/** 案件に載っている商材名の一覧（表示用） */
export function productNamesOf(lines: DealProduct[], dealId: string): string[] {
  return linesOfDeal(lines, dealId).map((l) => l.product_name);
}

/** その案件が指定の商材を含むか（商材フィルタ用） */
export function dealHasProduct(
  lines: DealProduct[],
  dealId: string,
  productId: string
): boolean {
  return lines.some((l) => l.deal_id === dealId && l.product_id === productId);
}

export interface ProductStat {
  product: Product;
  /** その商材が載っている案件数 */
  dealCount: number;
  /** 受注済み案件に載っている件数 */
  wonCount: number;
  /** 受注済み案件での金額合計 */
  wonAmount: number;
  /** 進行中案件での金額合計 */
  openAmount: number;
}

/** 商材別の売上サマリー。クロスセルがどれだけ乗っているかを見る */
export function buildProductStats(
  products: Product[],
  deals: { id: string; stage: string }[],
  lines: DealProduct[]
): ProductStat[] {
  const stageOf = new Map(deals.map((d) => [d.id, d.stage]));
  return products
    .map((product) => {
      const own = lines.filter((l) => l.product_id === product.id);
      let wonCount = 0;
      let wonAmount = 0;
      let openAmount = 0;
      const dealIds = new Set<string>();
      for (const line of own) {
        const stage = stageOf.get(line.deal_id);
        if (stage === undefined) continue; // 案件が消えている明細は数えない
        dealIds.add(line.deal_id);
        if (stage === "won") {
          wonCount += 1;
          wonAmount += line.amount;
        } else if (stage !== "lost") {
          openAmount += line.amount;
        }
      }
      return { product, dealCount: dealIds.size, wonCount, wonAmount, openAmount };
    })
    .sort((a, b) => b.wonAmount - a.wonAmount || b.dealCount - a.dealCount);
}

/**
 * クロスセル率。2商材以上が載っている案件の割合（%）。
 * 「入口はDDS、そこにAIを乗せられているか」を1つの数字で見るための指標。
 */
export function crossSellRate(
  dealIds: string[],
  lines: DealProduct[]
): { multi: number; total: number; rate: number | null } {
  const counts = new Map<string, Set<string>>();
  for (const line of lines) {
    if (!counts.has(line.deal_id)) counts.set(line.deal_id, new Set());
    counts.get(line.deal_id)!.add(line.product_id);
  }
  // 明細が1件も無い案件は「商材未設定」なので母数に入れない
  const withLines = dealIds.filter((id) => (counts.get(id)?.size ?? 0) > 0);
  const multi = withLines.filter((id) => (counts.get(id)?.size ?? 0) >= 2).length;
  return {
    multi,
    total: withLines.length,
    rate: withLines.length > 0 ? Math.round((multi / withLines.length) * 100) : null,
  };
}
