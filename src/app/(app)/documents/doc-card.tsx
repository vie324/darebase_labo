"use client";

// 資料1件の表示（グリッドカード / リスト行）

import type { MouseEvent } from "react";
import { Download } from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import type { SalesDocument } from "@/lib/types";
import { DOC_CATEGORIES } from "@/lib/constants";
import { Avatar, Badge, Card } from "@/components/ui";
import { downloadName, fileTypeStyle, formatSize } from "./shared";

/** file_url ありなら <a download>、なしなら「サンプル」表示 */
export function DownloadAction({
  doc,
  onDownloaded,
  size = "sm",
}: {
  doc: SalesDocument;
  onDownloaded: (doc: SalesDocument) => void;
  size?: "sm" | "md";
}) {
  if (!doc.file_url) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-lg bg-slate-100 font-medium text-slate-400 dark:bg-slate-800 dark:text-slate-500",
          size === "md" ? "px-3 py-2 text-xs" : "px-2 py-1 text-[11px]"
        )}
      >
        サンプル（実ファイルなし）
      </span>
    );
  }
  return (
    <a
      href={doc.file_url}
      download={downloadName(doc)}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onDownloaded(doc);
      }}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-50 font-semibold text-indigo-600 transition-colors hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25",
        size === "md" ? "px-3 py-2 text-xs" : "px-2.5 py-1.5 text-[11px]"
      )}
    >
      <Download className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      DL
    </a>
  );
}

/** グリッド表示用カード */
export function DocGridCard({
  doc,
  colorOf,
  onOpen,
  onDownloaded,
}: {
  doc: SalesDocument;
  colorOf: (name: string) => string;
  onOpen: () => void;
  onDownloaded: (doc: SalesDocument) => void;
}) {
  const style = fileTypeStyle(doc.file_type);
  const Icon = style.icon;
  const cat = DOC_CATEGORIES[doc.category];

  return (
    <Card hover onClick={onOpen} className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", style.tile)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge className={cat.color}>{cat.label}</Badge>
          <span className={cn("text-[10px] font-bold tracking-wider", style.text)}>
            {style.label} ・ {formatSize(doc.size_kb)}
          </span>
        </div>
      </div>

      <h3 className="mt-3 line-clamp-2 leading-snug font-bold">{doc.name}</h3>
      {doc.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          {doc.description}
        </p>
      )}

      {doc.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {doc.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              #{t}
            </span>
          ))}
          {doc.tags.length > 3 && (
            <span className="px-1 text-[10px] text-slate-400 dark:text-slate-500">
              +{doc.tags.length - 3}
            </span>
          )}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar name={doc.uploaded_by} color={colorOf(doc.uploaded_by)} size="xs" />
          <div className="min-w-0 text-[11px] leading-tight">
            <p className="truncate font-medium text-slate-600 dark:text-slate-300">
              {doc.uploaded_by}
            </p>
            <p className="text-slate-400 dark:text-slate-500">{timeAgo(doc.created_at)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
            <Download className="h-3 w-3" />
            {doc.downloads}
          </span>
          <DownloadAction doc={doc} onDownloaded={onDownloaded} />
        </div>
      </div>
    </Card>
  );
}

/** リスト表示用の行 */
export function DocListRow({
  doc,
  colorOf,
  onOpen,
  onDownloaded,
}: {
  doc: SalesDocument;
  colorOf: (name: string) => string;
  onOpen: () => void;
  onDownloaded: (doc: SalesDocument) => void;
}) {
  const style = fileTypeStyle(doc.file_type);
  const Icon = style.icon;
  const cat = DOC_CATEGORIES[doc.category];

  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 sm:gap-4 dark:hover:bg-slate-800/50"
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.tile)}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold">{doc.name}</p>
          <Badge className={cn(cat.color, "hidden sm:inline-flex")}>{cat.label}</Badge>
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400 dark:text-slate-500">
          <span className={cn("font-bold tracking-wider", style.text)}>{style.label}</span>
          <span>{formatSize(doc.size_kb)}</span>
          <span className="hidden items-center gap-1 sm:flex">
            <Avatar name={doc.uploaded_by} color={colorOf(doc.uploaded_by)} size="xs" className="h-4 w-4 text-[8px]" />
            {doc.uploaded_by}
          </span>
          <span>{timeAgo(doc.created_at)}</span>
        </p>
      </div>

      <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-slate-400 sm:flex dark:text-slate-500">
        <Download className="h-3.5 w-3.5" />
        {doc.downloads}
      </span>
      <span className="shrink-0">
        <DownloadAction doc={doc} onDownloaded={onDownloaded} />
      </span>
    </div>
  );
}
