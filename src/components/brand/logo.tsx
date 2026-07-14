/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";

// =============================================================
// DARE BASE LABO ロゴ
//
// ワードマークは公式の実ロゴ（透過PNG）を使用する:
//   - public/darebase-logo.png       … ライト用（濃色文字＋シアン三角）
//   - public/darebase-logo-dark.png  … ダーク用（白文字＋シアン三角）
// シンボルマーク（△▽）はアニメーション・小スペース用に SVG を使う:
//   - public/darebase-mark.svg
// =============================================================

/** シンボルマーク（△▽）。favicon・スプラッシュ等の可変/アニメ用。 */
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

/** 実ロゴのワードマーク（ライト/ダークで出し分け） */
function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-block", className)}>
      <img
        src="/darebase-logo.png"
        alt="DARE BASE LABO"
        className="block h-full w-auto dark:hidden"
      />
      <img
        src="/darebase-logo-dark.png"
        alt=""
        aria-hidden="true"
        className="hidden h-full w-auto dark:block"
      />
    </span>
  );
}

/**
 * ロゴのロックアップ。
 * - stacked: 実ワードマーク（スプラッシュ・ログイン向け）
 * - inline : 実ワードマーク + LABO タグ（サイドバー向け）
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
      <span className={cn("inline-flex items-center gap-2", className)}>
        <Wordmark className="h-8" />
        <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
          LABO
        </span>
      </span>
    );
  }
  return <Wordmark className={className} />;
}
