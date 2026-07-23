"use client";

// =============================================================
// 手組みSVGチャート（依存ライブラリなし・ダークモード対応）
//
// 色は Tailwind クラスで指定し、系列色は dataviz バリデータで検証済み:
//   折れ線ペア   light: cyan-600 × violet-600 / dark: cyan-600 × violet-500
//   ダイバージング light/dark: cyan-600 × amber-600
// =============================================================

import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const W = 720;
const H = 240;
const PAD = { top: 14, right: 14, bottom: 26, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** 上限を 1/2/2.5/5×10^k の「きりのいい値」に切り上げる */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = Math.pow(10, exp);
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (v <= m * base) return m * base;
  }
  return 10 * base;
}

export interface LineSeries {
  name: string;
  values: number[];
  /** 線色（text-* クラス。stroke は currentColor） */
  colorClass: string;
  /** 凡例ドット・マーカー用の背景色クラス */
  dotClass: string;
}

// =============================================================
// 折れ線チャート（月次トレンド用・複数系列）
// =============================================================
export function LineChart({
  labels,
  series,
  formatValue,
  tooltip,
}: {
  labels: string[];
  series: LineSeries[];
  formatValue: (n: number) => string;
  /** 各データ点の <title>（ネイティブツールチップ）を組み立てる */
  tooltip?: (labelIndex: number, s: LineSeries) => string;
}) {
  const all = series.flatMap((s) => s.values);
  const rawMax = Math.max(0, ...all);
  const rawMin = Math.min(0, ...all);
  const yMax = niceCeil(rawMax);
  // 粗利がマイナスの月にも対応（通常は0）
  const yMin = rawMin < 0 ? -niceCeil(-rawMin) : 0;
  const range = yMax - yMin || 1;

  const x = (i: number) =>
    PAD.left + (labels.length <= 1 ? PLOT_W / 2 : (i / (labels.length - 1)) * PLOT_W);
  const y = (v: number) => PAD.top + ((yMax - v) / range) * PLOT_H;

  const gridValues = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + range * t);
  // ラベルが多い場合は間引く（衝突防止）
  const labelStep = labels.length > 8 ? 2 : 1;

  return (
    <div>
      {/* 凡例（2系列以上のため常設） */}
      <div className="mb-2 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={cn("h-2.5 w-2.5 rounded-full", s.dotClass)} />
            {s.name}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {/* グリッド + y軸ラベル */}
        {gridValues.map((v) => (
          <Fragment key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              className={cn(
                v === 0 ? "stroke-slate-300 dark:stroke-slate-600" : "stroke-slate-100 dark:stroke-slate-800"
              )}
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(v) + 3.5}
              textAnchor="end"
              className="fill-slate-400 text-[10px] dark:fill-slate-500"
            >
              {formatValue(v)}
            </text>
          </Fragment>
        ))}
        {/* x軸ラベル */}
        {labels.map((label, i) =>
          i % labelStep === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-slate-400 text-[10px] dark:fill-slate-500"
            >
              {label}
            </text>
          ) : null
        )}
        {/* 系列 */}
        {series.map((s) => (
          <g key={s.name} className={s.colorClass}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={3} fill="currentColor">
                <title>{tooltip ? tooltip(i, s) : `${labels[i]} ${s.name}: ${formatValue(v)}`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

// =============================================================
// ダイバージングバー（キャッシュフロー予測: 入金↑ / 支払↓）
// =============================================================
export function DivergingBarChart({
  labels,
  up,
  down,
  formatValue,
  highlightFirst = false,
}: {
  labels: string[];
  up: { name: string; values: number[]; barClass: string; dotClass: string };
  down: { name: string; values: number[]; barClass: string; dotClass: string };
  formatValue: (n: number) => string;
  /** 先頭バケット（期限超過など）を強調表示する */
  highlightFirst?: boolean;
}) {
  const maxVal = niceCeil(Math.max(1, ...up.values, ...down.values));
  const zeroY = PAD.top + PLOT_H / 2;
  const halfH = PLOT_H / 2 - 2;
  const n = labels.length || 1;
  const slot = PLOT_W / n;
  const barW = Math.min(44, slot * 0.55);

  const hUp = (v: number) => (v / maxVal) * halfH;
  const x = (i: number) => PAD.left + slot * i + slot / 2;

  const gridT = [0.5, 1];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className={cn("h-2.5 w-2.5 rounded-full", up.dotClass)} />
          {up.name}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <span className={cn("h-2.5 w-2.5 rounded-full", down.dotClass)} />
          {down.name}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img">
        {/* グリッド（上下対称）+ yラベル */}
        {gridT.map((t) => (
          <Fragment key={t}>
            {[1, -1].map((sign) => (
              <Fragment key={sign}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={zeroY - sign * t * halfH}
                  y2={zeroY - sign * t * halfH}
                  className="stroke-slate-100 dark:stroke-slate-800"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={zeroY - sign * t * halfH + 3.5}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] dark:fill-slate-500"
                >
                  {formatValue(t * maxVal)}
                </text>
              </Fragment>
            ))}
          </Fragment>
        ))}
        {/* ゼロライン */}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={zeroY}
          y2={zeroY}
          className="stroke-slate-300 dark:stroke-slate-600"
          strokeWidth={1}
        />
        {labels.map((label, i) => {
          const upV = up.values[i] ?? 0;
          const downV = down.values[i] ?? 0;
          const net = upV - downV;
          const title = `${label}\n${up.name}: ${formatValue(upV)}\n${down.name}: ${formatValue(downV)}\n純収支: ${net >= 0 ? "+" : ""}${formatValue(net)}`;
          const highlighted = highlightFirst && i === 0;
          return (
            <g key={i} className={cn(highlighted && "opacity-95")}>
              {/* ホバー領域（列全体） */}
              <rect
                x={PAD.left + slot * i}
                y={PAD.top}
                width={slot}
                height={PLOT_H}
                fill="transparent"
              >
                <title>{title}</title>
              </rect>
              {highlighted && (
                <rect
                  x={PAD.left + slot * i + 2}
                  y={PAD.top}
                  width={slot - 4}
                  height={PLOT_H}
                  rx={6}
                  className="fill-rose-50 dark:fill-rose-500/10"
                />
              )}
              {upV > 0 && (
                <rect
                  x={x(i) - barW / 2}
                  y={zeroY - 1 - hUp(upV)}
                  width={barW}
                  height={hUp(upV)}
                  rx={3}
                  className={up.barClass}
                >
                  <title>{title}</title>
                </rect>
              )}
              {downV > 0 && (
                <rect
                  x={x(i) - barW / 2}
                  y={zeroY + 1}
                  width={barW}
                  height={hUp(downV)}
                  rx={3}
                  className={down.barClass}
                >
                  <title>{title}</title>
                </rect>
              )}
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                className={cn(
                  "text-[10px]",
                  highlighted
                    ? "fill-rose-500 font-semibold dark:fill-rose-400"
                    : "fill-slate-400 dark:fill-slate-500"
                )}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// =============================================================
// ランキングバー（代理店別・メーカー別などの構成比較）
// =============================================================
export function RankBars({
  rows,
  barClass,
  formatValue,
  emptyText = "データがありません",
}: {
  rows: { label: string; value: number; sub?: ReactNode }[];
  /** バーの塗り（単一色 = 長さで大小を読む） */
  barClass: string;
  formatValue: (n: number) => string;
  emptyText?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div key={r.label}>
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-sm font-medium">
              <span className="mr-1.5 text-xs text-slate-400">{i + 1}.</span>
              {r.label}
            </p>
            <p className="text-sm font-bold tracking-tight whitespace-nowrap">
              {formatValue(r.value)}
              {r.sub && <span className="ml-1.5 text-xs font-normal text-slate-400">{r.sub}</span>}
            </p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barClass)}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
