import { cn } from "@/lib/utils";

// =============================================================
// DareBase ロゴ
// ロゴマーク: 上向き三角(△)と下向き三角(▽)を縦に重ねたシアンのシンボル
//   （ワードマークの "DARE" / "BASE" の A を表す三角形に由来）
// ワードマーク: 白地に黒文字＋シアンの三角形。ライト/ダーク両対応。
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
    <svg
      viewBox="0 0 40 48"
      fill="none"
      aria-hidden="true"
      className={cn("text-cyan-400", className)}
    >
      <path
        d="M20 3 L36 22 H4 Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        className={cn(animated && "origin-center animate-logo-pop")}
      />
      <path
        d="M4 26 H36 L20 45 Z"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
        className={cn(animated && "origin-center animate-logo-pop [animation-delay:0.15s]")}
      />
    </svg>
  );
}

/** 三角形（ワードマーク内の A として使用） */
function Triangle({ down = false }: { down?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 22"
      fill="none"
      aria-hidden="true"
      className="inline-block h-[0.82em] w-[0.82em] translate-y-[0.06em] text-cyan-400"
    >
      {down ? (
        <path d="M2 3 H22 L12 20 Z" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      ) : (
        <path d="M12 2 L22 19 H2 Z" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * ワードマーク。
 * - stacked: DARE / BASE の2段組（スプラッシュ・ログイン向け）
 * - inline : マーク + DareBase の横並び（サイドバー向け）
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
        <LogoMark className="h-7 w-auto" />
        <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
          Dare<span className="text-cyan-500 dark:text-cyan-400">Base</span>
        </span>
      </span>
    );
  }

  // stacked wordmark
  return (
    <span
      className={cn(
        "inline-flex flex-col font-extrabold leading-[1.05] tracking-[0.22em] text-slate-900 dark:text-white",
        className
      )}
      aria-label="DareBase"
    >
      <span className="flex items-center">
        D<Triangle />R<span className="pl-[0.22em]">E</span>
      </span>
      <span className="flex items-center">
        B<Triangle down />S<span className="pl-[0.22em]">E</span>
      </span>
    </span>
  );
}
