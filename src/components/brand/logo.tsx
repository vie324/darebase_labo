/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

// =============================================================
// DARE BASE LABO ロゴ
//
// 実ロゴは public/ の透過SVGを参照する（差し替え可能）:
//   - public/darebase-mark.svg       … シンボルマーク（△▽・シアン）
//   - public/darebase-logo.svg       … ワードマーク（ライト用・濃色文字）
//   - public/darebase-logo-dark.svg  … ワードマーク（ダーク用・白文字）
// 公式のロゴ画像（透過PNG/SVG）がある場合は、これらのファイルを
// 上書きするだけでアプリ全体に反映される。
// =============================================================

/** シンボルマーク（△▽）。favicon・小スペース・アニメーション用。 */
export function LogoMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <img
      src="/darebase-mark.svg"
      alt=""
      aria-hidden="true"
      className={cn(animated && "origin-center animate-logo-pop", className)}
    />
  );
}

/**
 * ワードマーク。ライト/ダークで文字色の異なる透過SVGを出し分ける。
 * - stacked: DARE / BASE + LABO の縦組み（スプラッシュ・ログイン向け）
 * - inline : マーク + DARE BASE LABO の横並び（サイドバー向け）
 */
export function Logo({
  variant = "stacked",
  className,
}: {
  variant?: "stacked" | "inline";
  className?: string;
}) {
  if (variant === "inline") {
    return (
      <span className={cn("inline-flex items-center gap-2.5", className)}>
        <LogoMark className="h-7 w-auto" />
        <span className="inline-flex items-baseline gap-1.5">
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            DARE <span className="text-cyan-500 dark:text-cyan-400">BASE</span>
          </span>
          <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
            LABO
          </span>
        </span>
      </span>
    );
  }

  // stacked wordmark（ライト/ダークで画像を出し分け）
  return (
    <span className={cn("inline-block", className)}>
      <img
        src="/darebase-logo.svg"
        alt="DARE BASE LABO"
        className="block h-full w-auto dark:hidden"
      />
      <img
        src="/darebase-logo-dark.svg"
        alt=""
        aria-hidden="true"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}
