"use client";

// 銀行・支店リストのCSV取込。
// 「列マッピング → ドライラン（差分プレビュー）→ 確定」の2段階。
// 解析・差分判定は @/lib/branch-import（純粋ロジック・テスト済み）に委譲する。

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Upload } from "lucide-react";
import {
  BRANCH_COLUMN_LABELS,
  buildImportPlan,
  guessBranchMapping,
  isMappingReady,
  parseBranchCsv,
  type BranchColumnMapping,
  type ImportPlan,
  type ImportRow,
} from "@/lib/branch-import";
import { parseDelimited } from "@/lib/csv";
import { cn } from "@/lib/utils";
import type { Bank, Branch } from "@/lib/types";
import { Badge, Button, Modal, Select } from "@/components/ui";

type Step = "upload" | "mapping" | "result";

export function BranchImportModal({
  banks,
  branches,
  onClose,
  onConfirm,
}: {
  banks: Bank[];
  branches: Branch[];
  onClose: () => void;
  onConfirm: (plan: ImportPlan) => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<BranchColumnMapping | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<ImportPlan | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const headerRow = allRows[0] ?? [];
  const dataRows = useMemo(
    () => (hasHeader ? allRows.slice(1) : allRows),
    [allRows, hasHeader]
  );

  const plan = useMemo<ImportPlan | null>(() => {
    if (!mapping || !isMappingReady(mapping)) return null;
    return buildImportPlan(dataRows, mapping, banks, branches, hasHeader ? 1 : 0);
  }, [mapping, dataRows, banks, branches, hasHeader]);

  const readText = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    // BOM は TextDecoder が自動で除去する。
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      // 日本語環境の Excel から出力した CSV は Shift_JIS のことが多い
      return new TextDecoder("shift_jis").decode(buffer);
    }
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const text = await readText(file);
      const parsed = parseBranchCsv(text);
      if (parsed.rows.length === 0 && parsed.header.length === 0) {
        setError("読み取れる行がありませんでした。CSV / TSV 形式か確認してください。");
        return;
      }
      setFileName(file.name);
      setAllRows(parseDelimited(text));
      setHasHeader(parsed.hasHeader);
      setMapping(parsed.mapping);
      setStep("mapping");
    } catch {
      setError("ファイルを読み込めませんでした。");
    }
  };

  const toggleHeader = (next: boolean) => {
    setHasHeader(next);
    setMapping(next && allRows[0] ? guessBranchMapping(allRows[0]) : mapping);
  };

  const confirm = async () => {
    if (!plan || importing) return;
    setImporting(true);
    try {
      await onConfirm(plan);
      setApplied(plan);
      setStep("result");
    } finally {
      setImporting(false);
    }
  };

  const columnOptions = headerRow.map((h, i) => ({
    value: i,
    label: hasHeader ? `${i + 1}. ${h || "(空欄)"}` : `${i + 1}列目（例: ${h || "—"}）`,
  }));

  return (
    <Modal open onClose={onClose} title="銀行・支店リストの取込" wide>
      {/* ---------- ステップ1: ファイル選択 ---------- */}
      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            銀行・支店リストの CSV / TSV を選択してください。
            列の意味は次の画面で割り当てられます。取込前に差分（新規・更新・スキップ）を
            確認してから確定します。
          </p>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 py-12 transition-colors hover:border-cyan-400 hover:bg-cyan-50/40 dark:border-slate-700 dark:hover:bg-slate-800/50"
          >
            <FileUp className="h-8 w-8 text-slate-400" />
            <span className="text-sm font-semibold">CSV / TSV ファイルを選択</span>
            <span className="text-xs text-slate-400">
              例: 銀行名 / 銀行コード / 支店名 / 支店コード / 都道府県 / 住所 / 担当者
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            onChange={onPickFile}
            className="hidden"
          />
          {error && (
            <p className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          )}
          <div className="rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            重複判定は<strong>銀行コード + 支店コード</strong>で行います。
            コードが空の場合は<strong>銀行名 + 支店名</strong>で突き合わせ、
            一致した支店は上書き更新、無ければ新規登録します。
          </div>
        </div>
      )}

      {/* ---------- ステップ2: 列マッピング + ドライラン ---------- */}
      {step === "mapping" && mapping && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {fileName}
              <span className="ml-2 text-xs text-slate-400">{dataRows.length}行</span>
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <input
                type="checkbox"
                checked={hasHeader}
                onChange={(e) => toggleHeader(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-cyan-500"
              />
              1行目は見出し
            </label>
          </div>

          {/* 列マッピング */}
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">列の割り当て</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {BRANCH_COLUMN_LABELS.map(({ key, label, required }) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {label}
                    {required && <span className="ml-1 text-rose-500">*</span>}
                  </span>
                  <Select
                    value={String(mapping[key])}
                    onChange={(e) =>
                      setMapping({ ...mapping, [key]: Number(e.target.value) })
                    }
                    className="h-10 py-1.5 text-sm"
                  >
                    <option value="-1">（取り込まない）</option>
                    {columnOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </label>
              ))}
            </div>
            {!isMappingReady(mapping) && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
                銀行名と支店名の列を割り当ててください。
              </p>
            )}
          </div>

          {/* ドライラン結果 */}
          {plan && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                取込プレビュー（この時点ではまだ保存されていません）
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <SummaryTile label="新規登録" value={plan.createCount} tone="emerald" />
                <SummaryTile label="更新" value={plan.updateCount} tone="sky" />
                <SummaryTile label="スキップ" value={plan.skipCount} tone="slate" />
                <SummaryTile label="エラー" value={plan.errorCount} tone="rose" />
              </div>
              {plan.newBanks.length > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  新しく作成される銀行: {plan.newBanks.map((b) => b.name).join(" / ")}
                </p>
              )}
              <PreviewTable rows={plan.rows} />
            </div>
          )}

          <div className="flex justify-between gap-2">
            <Button variant="secondary" onClick={() => setStep("upload")}>
              ファイルを選び直す
            </Button>
            <Button
              onClick={confirm}
              disabled={!plan || importing || plan.createCount + plan.updateCount === 0}
            >
              <Upload className="h-4 w-4" />
              {importing
                ? "取込中…"
                : plan
                  ? `${plan.createCount + plan.updateCount}件を取り込む`
                  : "取り込む"}
            </Button>
          </div>
        </div>
      )}

      {/* ---------- ステップ3: 結果 ---------- */}
      {step === "result" && applied && (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <div>
            <p className="text-lg font-bold">取込が完了しました</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              新規 {applied.createCount}件 ・ 更新 {applied.updateCount}件
              {applied.skipCount > 0 && ` ・ スキップ ${applied.skipCount}件`}
              {applied.errorCount > 0 && ` ・ エラー ${applied.errorCount}件`}
            </p>
          </div>
          <Button onClick={onClose}>閉じる</Button>
        </div>
      )}
    </Modal>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "sky" | "slate" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    sky: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  };
  return (
    <div className={cn("rounded-xl px-3 py-2.5 text-center", tones[tone])}>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[11px] font-semibold">{label}</p>
    </div>
  );
}

const ACTION_META: Record<ImportRow["action"], { label: string; color: string }> = {
  create: {
    label: "新規",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  update: {
    label: "更新",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  },
  skip: {
    label: "スキップ",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
  error: {
    label: "エラー",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
};

function PreviewTable({ rows }: { rows: ImportRow[] }) {
  // 問題のある行を先に見せる（エラー → スキップ → 新規 → 更新）
  const order: Record<ImportRow["action"], number> = { error: 0, skip: 1, create: 2, update: 3 };
  const sorted = [...rows].sort((a, b) => order[a.action] - order[b.action] || a.lineNo - b.lineNo);
  const shown = sorted.slice(0, 50);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">取り込む行がありません</p>;
  }

  return (
    <div className="card overflow-hidden">
      <div className="scrollbar-thin max-h-72 overflow-auto">
        <table className="w-full min-w-[560px] text-left text-xs">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur dark:bg-slate-800/95">
            <tr className="text-slate-500 dark:text-slate-400">
              <th className="px-3 py-2 font-bold">行</th>
              <th className="px-3 py-2 font-bold">判定</th>
              <th className="px-3 py-2 font-bold">銀行</th>
              <th className="px-3 py-2 font-bold">支店</th>
              <th className="px-3 py-2 font-bold">備考</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((r) => (
              <tr key={r.lineNo}>
                <td className="px-3 py-2 text-slate-400 tabular-nums">{r.lineNo}</td>
                <td className="px-3 py-2">
                  <Badge className={ACTION_META[r.action].color}>
                    {ACTION_META[r.action].label}
                  </Badge>
                </td>
                <td className="px-3 py-2">
                  {r.bankName || "—"}
                  {r.bankCode && <span className="ml-1 text-slate-400">{r.bankCode}</span>}
                </td>
                <td className="px-3 py-2">
                  {r.branchName || "—"}
                  {r.branchCode && <span className="ml-1 text-slate-400">{r.branchCode}</span>}
                </td>
                <td className="px-3 py-2 text-slate-400">{r.reason || ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <p className="border-t border-slate-100 px-3 py-2 text-center text-[11px] text-slate-400 dark:border-slate-800">
          先頭 {shown.length} 行を表示しています（全 {rows.length} 行を取り込みます）
        </p>
      )}
    </div>
  );
}
