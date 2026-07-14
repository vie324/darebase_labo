// 営業資料モジュール共通のヘルパー・定義

import type { LucideIcon } from "lucide-react";
import {
  File,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";
import type { DocCategory, SalesDocument } from "@/lib/types";

// ---------- ファイルタイプ別のアイコンと色 ----------
export interface FileTypeStyle {
  icon: LucideIcon;
  /** アイコンタイル用（背景+文字色） */
  tile: string;
  /** 文字色のみ（リスト表示など） */
  text: string;
  label: string;
}

const OTHER_STYLE: FileTypeStyle = {
  icon: File,
  tile: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  text: "text-slate-500 dark:text-slate-400",
  label: "FILE",
};

const FILE_TYPE_STYLES: Record<string, FileTypeStyle> = {
  pdf: {
    icon: FileText,
    tile: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400",
    text: "text-rose-600 dark:text-rose-400",
    label: "PDF",
  },
  pptx: {
    icon: Presentation,
    tile: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
    text: "text-orange-600 dark:text-orange-400",
    label: "PPTX",
  },
  ppt: {
    icon: Presentation,
    tile: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
    text: "text-orange-600 dark:text-orange-400",
    label: "PPT",
  },
  xlsx: {
    icon: FileSpreadsheet,
    tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "XLSX",
  },
  xls: {
    icon: FileSpreadsheet,
    tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "XLS",
  },
  csv: {
    icon: FileSpreadsheet,
    tile: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "CSV",
  },
  docx: {
    icon: FileText,
    tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    label: "DOCX",
  },
  doc: {
    icon: FileText,
    tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
    text: "text-blue-600 dark:text-blue-400",
    label: "DOC",
  },
  png: {
    icon: FileImage,
    tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
    label: "PNG",
  },
  jpg: {
    icon: FileImage,
    tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
    label: "JPG",
  },
  jpeg: {
    icon: FileImage,
    tile: "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400",
    text: "text-violet-600 dark:text-violet-400",
    label: "JPEG",
  },
  zip: {
    icon: FileArchive,
    tile: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    text: "text-slate-500 dark:text-slate-400",
    label: "ZIP",
  },
  mp4: {
    icon: FileVideo,
    tile: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    text: "text-slate-500 dark:text-slate-400",
    label: "MP4",
  },
  mp3: {
    icon: FileAudio,
    tile: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    text: "text-slate-500 dark:text-slate-400",
    label: "MP3",
  },
};

export function fileTypeStyle(fileType: string): FileTypeStyle {
  const key = fileType.trim().toLowerCase();
  const found = FILE_TYPE_STYLES[key];
  if (found) return found;
  return key ? { ...OTHER_STYLE, label: key.toUpperCase().slice(0, 6) } : OTHER_STYLE;
}

// ---------- サイズ表示 ----------
/** KB 数を "820 KB" / "4.2 MB" / "1.1 GB" に整形 */
export function formatSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1).replace(/\.0$/, "")} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1).replace(/\.0$/, "")} MB`;
  return `${Math.max(1, Math.round(kb))} KB`;
}

// ---------- ファイル名 ----------
/** "提案書_v3.pptx" → 拡張子 "pptx"（なければ ""） */
export function extOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i <= 0 || i === filename.length - 1) return "";
  return filename.slice(i + 1).toLowerCase();
}

/** "提案書_v3.pptx" → "提案書_v3" */
export function baseName(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(0, i) : filename;
}

/** ダウンロード時のファイル名（表示名 + 拡張子） */
export function downloadName(doc: SalesDocument): string {
  if (!doc.file_type) return doc.name;
  const ext = `.${doc.file_type.toLowerCase()}`;
  return doc.name.toLowerCase().endsWith(ext) ? doc.name : doc.name + ext;
}

// ---------- タグ ----------
export function parseTags(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,、，]/)
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean)
    )
  );
}

// ---------- フォーム値 ----------
export interface DocFormValues {
  name: string;
  category: DocCategory;
  description: string;
  tags: string[];
  file_url: string;
  file_type: string;
  size_kb: number;
}
