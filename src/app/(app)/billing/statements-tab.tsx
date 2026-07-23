"use client";

// 明細計算タブ — メーカー明細の取込 → 代理店別自動計算 → 承認 → 請求書生成

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { ArrowRight, FileSpreadsheet, Plus, Upload } from "lucide-react";
import { formatYen, timeAgo, todayStr } from "@/lib/utils";
import type { Collection } from "@/lib/use-collection";
import type {
  CommissionRate,
  Invoice,
  MakerStatement,
  Partner,
  StatementLine,
} from "@/lib/types";
import { STATEMENT_STATUSES } from "@/lib/constants";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Skeleton, Textarea } from "@/components/ui";
import {
  guessMapping,
  looksLikeHeader,
  parseDelimited,
  toImportedLines,
  type ColumnMapping,
} from "./statement-import";
import { StatementDetail } from "./statement-detail";
import { partnerName } from "./shared";

export function StatementsTab({
  statements,
  lines,
  invoices,
  partners,
  rates,
  currentUserName,
  loading,
  notify,
}: {
  statements: Collection<MakerStatement>;
  lines: Collection<StatementLine>;
  invoices: Collection<Invoice>;
  partners: Partner[];
  rates: CommissionRate[];
  currentUserName: string;
  loading: boolean;
  notify: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const sorted = useMemo(
    () =>
      statements.items
        .slice()
        .sort((a, b) => (a.statement_month < b.statement_month ? 1 : -1)),
    [statements.items]
  );

  const selected = sorted.find((s) => s.id === selectedId) ?? null;

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (selected) {
    return (
      <StatementDetail
        statement={selected}
        statements={statements}
        lines={lines}
        invoices={invoices}
        partners={partners}
        rates={rates}
        currentUserName={currentUserName}
        notify={notify}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          メーカーから届く明細を取り込み、率マスタで代理店別の支払額を自動計算 → 承認 → 支払明細（請求書）を一括生成します。
        </p>
        <Button size="sm" onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4" />
          明細を取り込む
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<FileSpreadsheet className="h-10 w-10" />}
          title="取り込んだ明細はまだありません"
          description="CSV/TSVの貼り付け・アップロードでメーカー明細を取り込めます"
          action={
            <Button size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              明細を取り込む
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((st) => {
            const meta = STATEMENT_STATUSES[st.status];
            const lineCount = lines.items.filter((l) => l.statement_id === st.id).length;
            return (
              <Card key={st.id} hover className="p-5" onClick={() => setSelectedId(st.id)}>
                <div className="flex items-center gap-2">
                  <Badge className={meta.color}>{meta.label}</Badge>
                  <span className="text-xs text-slate-400">{timeAgo(st.created_at)}</span>
                </div>
                <h3 className="mt-2 leading-snug font-bold">{st.title}</h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {partnerName(partners, st.maker_id) || "メーカー未設定"} ・ 対象月 {st.statement_month || "—"}
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-xs text-slate-400">{lineCount}行</p>
                  <p className="text-lg font-bold tracking-tight">{formatYen(st.total_amount)}</p>
                </div>
                <p className="mt-2 flex items-center justify-end gap-1 text-xs font-medium text-cyan-600 dark:text-cyan-400">
                  開く <ArrowRight className="h-3.5 w-3.5" />
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {importOpen && (
        <ImportModal
          partners={partners}
          onClose={() => setImportOpen(false)}
          onImport={async ({ makerId, month, title, imported }) => {
            const agencies = partners.filter((p) => p.kind === "agency");
            const st = await statements.add({
              maker_id: makerId || null,
              title,
              statement_month: month,
              status: "draft",
              total_amount: imported.reduce((s, l) => s + l.amount, 0),
              source: "csv",
              approved_by: "",
              approved_at: "",
              memo: "",
            });
            for (const line of imported) {
              // 代理店名の完全一致（前後空白は無視）で自動割当。なければ未割当(null)
              const agency = agencies.find((a) => a.name.trim() === line.agency_name.trim());
              await lines.add({
                statement_id: st.id,
                agency_id: agency?.id ?? null,
                product_name: line.product_name,
                customer_name: line.customer_name,
                amount: line.amount,
                rate_percent: null,
                agency_amount: 0,
                company_amount: 0,
                rate_source: "",
                memo: agency || !line.agency_name ? "" : `明細上の代理店名: ${line.agency_name}`,
              });
            }
            setImportOpen(false);
            setSelectedId(st.id);
            notify(`${imported.length}行を取り込みました。「計算実行」で代理店別金額を計算できます`, "success");
          }}
        />
      )}
    </div>
  );
}

// =============================================================
// 取込モーダル（貼り付け / CSVファイル → 列マッピング → 取込）
// =============================================================
function ImportModal({
  partners,
  onClose,
  onImport,
}: {
  partners: Partner[];
  onClose: () => void;
  onImport: (args: {
    makerId: string;
    month: string;
    title: string;
    imported: ReturnType<typeof toImportedLines>;
  }) => Promise<void>;
}) {
  const makers = partners.filter((p) => p.kind === "maker" && p.is_active);
  const [makerId, setMakerId] = useState("");
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [skipHeader, setSkipHeader] = useState(true);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => parseDelimited(rawText), [rawText]);
  const effectiveMapping = mapping ?? (rows.length > 0 ? guessMapping(rows[0]) : null);
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const dataRows = skipHeader && rows.length > 1 ? rows.slice(1) : rows;
  const imported = useMemo(
    () => (effectiveMapping ? toImportedLines(dataRows, effectiveMapping) : []),
    [dataRows, effectiveMapping]
  );

  const handleText = (text: string) => {
    setRawText(text);
    const parsed = parseDelimited(text);
    if (parsed.length > 0) {
      const guessed = guessMapping(parsed[0]);
      setMapping(guessed);
      setSkipHeader(looksLikeHeader(parsed[0], guessed.amount));
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => handleText(String(reader.result ?? ""));
    reader.readAsText(file);
    e.target.value = "";
  };

  const defaultTitle = () => {
    const makerLabel = makers.find((m) => m.id === makerId)?.name ?? "";
    return `${month}分 手数料明細${makerLabel ? `（${makerLabel}）` : ""}`;
  };

  const valid = month !== "" && imported.length > 0;

  const setMapCol = (key: keyof ColumnMapping, idx: number) =>
    setMapping((prev) => ({ ...(prev ?? { product: -1, customer: -1, amount: -1, agency: -1 }), [key]: idx }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onImport({
        makerId,
        month,
        title: title.trim() || defaultTitle(),
        imported,
      });
    } finally {
      setSaving(false);
    }
  };

  const mapFields: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
    { key: "amount", label: "金額", required: true },
    { key: "product", label: "商材名" },
    { key: "customer", label: "顧客名" },
    { key: "agency", label: "代理店名" },
  ];

  return (
    <Modal open onClose={onClose} title="メーカー明細を取り込む" wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="メーカー">
            <Select value={makerId} onChange={(e) => setMakerId(e.target.value)}>
              <option value="">選択しない</option>
              {makers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="対象月" required>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
          </Field>
          <Field label="タイトル">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle()} />
          </Field>
        </div>

        <Field label="明細データ（CSV / TSV を貼り付け、またはファイル選択）" required>
          <Textarea
            value={rawText}
            onChange={(e) => handleText(e.target.value)}
            rows={6}
            placeholder={"商材名,顧客名,金額,代理店名\nセールスクラウド Standard,株式会社サンプル,300000,株式会社ウエストセールス"}
            className="font-mono text-xs"
          />
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-cyan-600 hover:underline dark:text-cyan-400">
            <Upload className="h-3.5 w-3.5" />
            CSVファイルを選択
            <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
          </label>
        </Field>

        {rows.length > 0 && (
          <div className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold tracking-wider text-slate-400">列の割り当て</p>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={skipHeader}
                  onChange={(e) => setSkipHeader(e.target.checked)}
                  className="h-3.5 w-3.5 accent-cyan-500"
                />
                1行目はヘッダとして除外
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              {mapFields.map(({ key, label, required }) => (
                <Field key={key} label={`${label}${required ? " *" : ""}`}>
                  <Select
                    value={String(effectiveMapping?.[key] ?? -1)}
                    onChange={(e) => setMapCol(key, Number(e.target.value))}
                  >
                    <option value={-1}>（なし）</option>
                    {Array.from({ length: columnCount }, (_, i) => (
                      <option key={i} value={i}>
                        {i + 1}列目{rows[0]?.[i] ? `: ${rows[0][i].slice(0, 10)}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              プレビュー: <span className="font-semibold">{imported.length}行</span> を取込
              {imported.length > 0 && (
                <span className="ml-2">
                  合計 {formatYen(imported.reduce((s, l) => s + l.amount, 0))}
                </span>
              )}
              {dataRows.length > imported.length && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  ※ 金額を読み取れない{dataRows.length - imported.length}行はスキップされます
                </span>
              )}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            <Plus className="h-4 w-4" />
            {saving ? "取込中…" : `${imported.length}行を取り込む`}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
