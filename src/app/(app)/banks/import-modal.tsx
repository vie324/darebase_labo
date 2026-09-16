"use client";

// 紹介元リストの一括登録。入り口は3つあるが、
// 差分判定（新規／更新／スキップ）と確定処理は1本に揃えてある。
//
//   かんたん入力 … 紹介元を1つ選び、窓口名を1行1件で貼り付ける（列の割当なし）
//   貼り付け     … Excel・スプレッドシートからそのまま貼る → 列マッピング
//   ファイル     … CSV / TSV を選ぶ → 列マッピング
//
// 解析・差分判定は @/lib/branch-import と @/lib/branch-quick-add
// （どちらもUI非依存・テスト済み）に委譲する。

import { useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileUp, Upload, Zap } from "lucide-react";
import {
  branchColumnLabels,
  buildImportPlan,
  guessBranchMapping,
  isMappingReady,
  parseBranchCsv,
  type BranchColumnMapping,
  type ImportPlan,
  type ImportRow,
} from "@/lib/branch-import";
import { QUICK_ADD_MAPPING, buildQuickRows } from "@/lib/branch-quick-add";
import { parseDelimited } from "@/lib/csv";
import type { UnitTerms } from "@/lib/business-units";
import { cn } from "@/lib/utils";
import type { Bank, Branch } from "@/lib/types";
import { Badge, Button, Field, Input, Modal, Select, Tabs, Textarea } from "@/components/ui";

type Mode = "quick" | "paste" | "file";
type Step = "input" | "mapping" | "result";

/** 「＋ 新しい紹介元」を選んだときの Select の値 */
const NEW_BANK = "__new__";

export function BranchImportModal({
  banks,
  branches,
  terms,
  onClose,
  onConfirm,
}: {
  banks: Bank[];
  branches: Branch[];
  terms: UnitTerms;
  onClose: () => void;
  onConfirm: (plan: ImportPlan) => Promise<void>;
}) {
  // 紹介元が1件も無いうちは列マッピングより「かんたん入力」のほうが早い
  const [mode, setMode] = useState<Mode>("quick");
  const [step, setStep] = useState<Step>("input");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [applied, setApplied] = useState<ImportPlan | null>(null);

  // ---- かんたん入力 ----
  const [quickBankId, setQuickBankId] = useState<string>(banks[0]?.id ?? NEW_BANK);
  const [newBank, setNewBank] = useState({ name: "", code: "" });
  const [quickText, setQuickText] = useState("");

  // ---- 貼り付け / ファイル ----
  const [sourceLabel, setSourceLabel] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<BranchColumnMapping | null>(null);
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

  // 列の呼び名と貼り付け例は事業部で変わる
  const columns = useMemo(() => branchColumnLabels(terms), [terms]);
  const pastePlaceholder = useMemo(() => {
    const ex = terms.examples;
    const head = [`${terms.parent}名`, `${terms.parent}コード`, `${terms.child}名`, `${terms.child}コード`];
    const row = [ex.parent, ex.parentCode, ex.child, ex.childCode];
    return `${head.join("\t")}\n${row.join("\t")}`;
  }, [terms]);

  // 選択中の紹介元（既存 or 新規入力）
  const quickBank = useMemo(() => {
    if (quickBankId === NEW_BANK) {
      return { name: newBank.name.trim(), code: newBank.code.trim() };
    }
    const bank = banks.find((b) => b.id === quickBankId);
    return { name: bank?.name ?? "", code: bank?.code ?? "" };
  }, [quickBankId, newBank, banks]);

  const quickPlan = useMemo<ImportPlan | null>(() => {
    if (quickBank.name === "") return null;
    const rows = buildQuickRows(quickText, quickBank);
    if (rows.length === 0) return null;
    return buildImportPlan(rows, QUICK_ADD_MAPPING, banks, branches, 0);
  }, [quickText, quickBank, banks, branches]);

  /** 確定ボタンが対象にするプラン */
  const activePlan = mode === "quick" ? quickPlan : plan;

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

  /** 表形式のテキストを読み込んで列マッピングへ進む（貼り付け・ファイル共通） */
  const loadTable = (text: string, label: string): boolean => {
    const parsed = parseBranchCsv(text);
    if (parsed.rows.length === 0 && parsed.header.length === 0) {
      setError(
        `読み取れる行がありませんでした。1行1${terms.countUnit}の表になっているか確認してください。`
      );
      return false;
    }
    setSourceLabel(label);
    setAllRows(parseDelimited(text));
    setHasHeader(parsed.hasHeader);
    setMapping(parsed.mapping);
    setStep("mapping");
    return true;
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setError("");
    try {
      loadTable(await readText(file), file.name);
    } catch {
      setError("ファイルを読み込めませんでした。");
    } finally {
      // 同じファイルを選び直せるようにする
      input.value = "";
    }
  };

  const onLoadPaste = () => {
    setError("");
    if (pasteText.trim() === "") {
      setError("貼り付けた内容がありません。");
      return;
    }
    loadTable(pasteText, "貼り付けたデータ");
  };

  const toggleHeader = (next: boolean) => {
    setHasHeader(next);
    setMapping(next && allRows[0] ? guessBranchMapping(allRows[0]) : mapping);
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setStep("input");
    setError("");
  };

  const confirm = async () => {
    if (!activePlan || importing) return;
    setImporting(true);
    try {
      await onConfirm(activePlan);
      setApplied(activePlan);
      setStep("result");
    } finally {
      setImporting(false);
    }
  };

  const columnOptions = headerRow.map((h, i) => ({
    value: i,
    label: hasHeader ? `${i + 1}. ${h || "(空欄)"}` : `${i + 1}列目（例: ${h || "—"}）`,
  }));

  const applyCount = activePlan ? activePlan.createCount + activePlan.updateCount : 0;

  // 操作行は step と mode で変わる。下端に貼り付けたいので footer にまとめる。
  const footer =
    step === "input" && mode === "quick" ? (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          キャンセル
        </Button>
        <Button type="submit" disabled={!quickPlan || importing || applyCount === 0}>
          <Zap className="h-4 w-4" />
          {importing ? "登録中…" : applyCount > 0 ? `${applyCount}件を登録` : "登録"}
        </Button>
      </div>
    ) : step === "input" && mode === "paste" ? (
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          キャンセル
        </Button>
        <Button type="submit" disabled={pasteText.trim() === ""}>
          <ClipboardPaste className="h-4 w-4" />
          読み込む
        </Button>
      </div>
    ) : step === "mapping" && mapping ? (
      <div className="flex justify-between gap-2">
        <Button type="button" variant="secondary" onClick={() => setStep("input")}>
          {mode === "paste" ? "貼り付け直す" : "ファイルを選び直す"}
        </Button>
        <Button type="submit" disabled={!plan || importing || applyCount === 0}>
          <Upload className="h-4 w-4" />
          {importing ? "取込中…" : applyCount > 0 ? `${applyCount}件を取り込む` : "取り込む"}
        </Button>
      </div>
    ) : step === "result" && applied ? (
      <div className="flex justify-end">
        <Button type="button" onClick={onClose}>
          閉じる
        </Button>
      </div>
    ) : undefined;

  // Enter（スマホの「完了」）でも、いま出ている操作行のボタンと同じことをする
  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (step === "mapping") void confirm();
    else if (mode === "quick") void confirm();
    else if (mode === "paste") onLoadPaste();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${terms.parent}・${terms.child}を登録`}
      wide
      footer={footer}
      onSubmit={onFormSubmit}
    >
      {/* ---------- 入り口の切り替え ---------- */}
      {step !== "result" && (
        <Tabs
          tabs={[
            { key: "quick" as const, label: "かんたん入力" },
            { key: "paste" as const, label: "貼り付け" },
            { key: "file" as const, label: "ファイル" },
          ]}
          active={mode}
          onChange={switchMode}
          className="mb-4"
        />
      )}

      {/* ---------- かんたん入力 ---------- */}
      {step === "input" && mode === "quick" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {terms.parent}を選んで、{terms.child}名を1行に1つずつ入れてください。
            {terms.childCode}・都道府県・住所は、タブ・カンマ区切りで続けて書けば一緒に登録されます。
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={terms.parent} required>
              <Select value={quickBankId} onChange={(e) => setQuickBankId(e.target.value)}>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                    {b.code ? `（${b.code}）` : ""}
                  </option>
                ))}
                <option value={NEW_BANK}>＋ 新しい{terms.parent}を登録する</option>
              </Select>
            </Field>
            {quickBankId === NEW_BANK && (
              <>
                <Field label={`${terms.parent}名`} required>
                  <Input
                    value={newBank.name}
                    onChange={(e) => setNewBank({ ...newBank, name: e.target.value })}
                    placeholder={`例: ${terms.examples.parent}`}
                    autoFocus
                  />
                </Field>
                <Field label={terms.parentCode}>
                  <Input
                    value={newBank.code}
                    onChange={(e) => setNewBank({ ...newBank, code: e.target.value })}
                    placeholder={`例: ${terms.examples.parentCode}`}
                  />
                </Field>
              </>
            )}
          </div>

          <Field label={terms.child} required>
            <Textarea
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              placeholder={terms.examples.childLines}
              className="min-h-44 font-mono text-xs"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              {`「1.」のような行頭の連番、「${terms.examples.childWithCode}」のような括弧書きのコードは自動で外します。`}
              空行と「#」で始まる行は読み飛ばします。
            </span>
          </Field>

          {quickBank.name === "" ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {terms.parent}名を入れてください。
            </p>
          ) : (
            quickPlan && <PlanPreview plan={quickPlan} terms={terms} />
          )}

        </div>
      )}

      {/* ---------- 貼り付け ---------- */}
      {step === "input" && mode === "paste" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Excel・スプレッドシートの範囲をコピーして、そのまま貼り付けてください。
            列の意味は次の画面で割り当てられます。
          </p>
          <Textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={pastePlaceholder}
            className="min-h-48 font-mono text-xs"
            autoFocus
          />
          {error && (
            <p className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          )}
        </div>
      )}

      {/* ---------- ファイル ---------- */}
      {step === "input" && mode === "file" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {terms.parent}・{terms.child}リストの CSV / TSV を選択してください。
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
              例: {columns.map((c) => c.label).join(" / ")}
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
            重複判定は
            <strong>
              {terms.parent}コード + {terms.child}コード
            </strong>
            で行います。 コードが空の場合は
            <strong>
              {terms.parent}名 + {terms.child}名
            </strong>
            で突き合わせ、 一致した{terms.child}は上書き更新、無ければ新規登録します。
          </div>
        </div>
      )}

      {/* ---------- 列マッピング + ドライラン（貼り付け・ファイル共通） ---------- */}
      {step === "mapping" && mapping && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {sourceLabel}
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
              {columns.map(({ key, label, required }) => (
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
                {terms.parent}名と{terms.child}名の列を割り当ててください。
              </p>
            )}
          </div>

          {plan && <PlanPreview plan={plan} terms={terms} />}

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

/** 差分プレビュー（かんたん入力・列マッピングの両方から使う） */
function PlanPreview({ plan, terms }: { plan: ImportPlan; terms: UnitTerms }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
        登録プレビュー（この時点ではまだ保存されていません）
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="新規登録" value={plan.createCount} tone="emerald" />
        <SummaryTile label="更新" value={plan.updateCount} tone="sky" />
        <SummaryTile label="スキップ" value={plan.skipCount} tone="slate" />
        <SummaryTile label="エラー" value={plan.errorCount} tone="rose" />
      </div>
      {plan.newBanks.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          新しく作成される{terms.parent}: {plan.newBanks.map((b) => b.name).join(" / ")}
        </p>
      )}
      <PreviewTable rows={plan.rows} terms={terms} />
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

function PreviewTable({ rows, terms }: { rows: ImportRow[]; terms: UnitTerms }) {
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
              <th className="px-3 py-2 font-bold">{terms.parent}</th>
              <th className="px-3 py-2 font-bold">{terms.child}</th>
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
