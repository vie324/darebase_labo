"use client";

// 勉強会ログの一覧カード

import type { ReactNode } from "react";
import { CalendarDays, ExternalLink, FileText, Package, Video } from "lucide-react";
import { Avatar, Badge, Card } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { TrainingLog } from "@/lib/types";
import { categoryChip, excerpt } from "./helpers";

/** 録画・資料への外部リンク（アイコンボタン / 新規タブ） */
function LinkPill({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`${label}を新しいタブで開く`}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
    >
      {icon}
      {label}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

export function TrainingCard({
  training,
  presenterColor,
  onOpen,
}: {
  training: TrainingLog;
  presenterColor: string;
  onOpen: () => void;
}) {
  const hasSummary = training.summary.trim() !== "";
  return (
    <Card hover onClick={onOpen} className="group flex flex-col p-5">
      {/* 上段: ツール名バッジ + カテゴリ + 外部リンク */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-sm font-bold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
          <Package className="h-4 w-4" />
          {training.tool_name}
        </span>
        <Badge className={categoryChip(training.category)}>{training.category}</Badge>
        <div className="ml-auto flex items-center gap-1.5">
          {training.video_url && (
            <LinkPill
              href={training.video_url}
              icon={<Video className="h-3.5 w-3.5" />}
              label="録画"
            />
          )}
          {training.material_url && (
            <LinkPill
              href={training.material_url}
              icon={<FileText className="h-3.5 w-3.5" />}
              label="資料"
            />
          )}
        </div>
      </div>

      {/* タイトル */}
      <h3 className="mt-3 text-base leading-snug font-bold transition-colors group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
        {training.title}
      </h3>

      {/* サマリ */}
      <p className="mt-1 line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {hasSummary ? training.summary : excerpt(training.content)}
      </p>

      {/* タグ */}
      {training.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {training.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* フッター: 発表者 + 開催日 */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Avatar name={training.presenter} color={presenterColor} size="xs" />
          <span className="font-medium">{training.presenter}</span>
        </div>
        <span className="flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          <CalendarDays className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
          {formatDate(training.held_at)}
        </span>
      </div>
    </Card>
  );
}
