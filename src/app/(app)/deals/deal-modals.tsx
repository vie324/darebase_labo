"use client";

// 案件詳細モーダル（活動履歴タイムライン付き）と新規/編集フォームモーダル

import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertTriangle,
  Flag,
  History,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { ACTIVITY_TYPES, DEAL_STAGES } from "@/lib/constants";
import { cn, formatDate, formatYen, formatYenShort, timeAgo } from "@/lib/utils";
import type { ActivityType, Deal, DealActivity, DealStage } from "@/lib/types";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  ProgressBar,
  Select,
  Textarea,
} from "@/components/ui";
import {
  STAGE_KEYS,
  emptyFormValues,
  isOpenStage,
  probabilityClass,
  toFormValues,
  type DealFormValues,
} from "./shared";

/** 手動で記録できる活動種別（stage_change は自動記録のみ） */
const MANUAL_ACTIVITY_TYPES = (Object.keys(ACTIVITY_TYPES) as ActivityType[]).filter(
  (t) => t !== "stage_change"
);

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">{label}</p>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

// =============================================================
// 案件詳細モーダル
// =============================================================
export function DealDetailModal({
  deal,
  activities,
  today,
  colorOf,
  onClose,
  onEdit,
  onDelete,
  onStageChange,
  onAddActivity,
}: {
  deal: Deal | null;
  activities: DealActivity[];
  today: string;
  colorOf: (name: string) => string;
  onClose: () => void;
  onEdit: (deal: Deal) => void;
  onDelete: (deal: Deal) => void;
  onStageChange: (deal: Deal, to: DealStage) => void;
  onAddActivity: (dealId: string, type: ActivityType, note: string) => Promise<void>;
}) {
  // 親側で key={deal.id} を付けて描画するため、案件が変わると状態はリセットされる
  const [actType, setActType] = useState<ActivityType>("call");
  const [actNote, setActNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!deal) return null;

  const overdue = isOpenStage(deal.stage) && deal.expected_close < today;

  const submitActivity = async (e: FormEvent) => {
    e.preventDefault();
    if (!actNote.trim() || saving) return;
    setSaving(true);
    try {
      await onAddActivity(deal.id, actType, actNote.trim());
      setActNote("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={deal.name} wide>
      <div className="space-y-5">
        {/* ステージ変更 */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            ステージ（クリックで変更）
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {STAGE_KEYS.map((s) => (
              <button
                key={s}
                onClick={() => onStageChange(deal, s)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                  s === deal.stage
                    ? cn(
                        DEAL_STAGES[s].color,
                        "ring-2 ring-indigo-400/60 dark:ring-indigo-500/50"
                      )
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-800/60 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                )}
              >
                {DEAL_STAGES[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* 基本情報 */}
        <div className="grid gap-4 rounded-2xl bg-slate-50/80 p-4 sm:grid-cols-2 lg:grid-cols-3 dark:bg-slate-800/40">
          <Info label="会社名">{deal.company}</Info>
          <Info label="先方担当者">{deal.contact_name || "—"}</Info>
          <Info label="金額">
            <span className="text-base font-bold tabular-nums">{formatYen(deal.amount)}</span>
          </Info>
          <Info label="確度">
            <span className="flex items-center gap-2">
              <ProgressBar
                value={deal.probability}
                className="h-1.5 w-20"
                barClassName={DEAL_STAGES[deal.stage].bar}
              />
              <Badge className={probabilityClass(deal.probability)}>{deal.probability}%</Badge>
            </span>
          </Info>
          <Info label="完了予定">
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "font-semibold text-rose-500"
              )}
            >
              {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
              {formatDate(deal.expected_close)}
              {overdue && <span className="text-[11px]">期限超過</span>}
            </span>
          </Info>
          <Info label="担当者">
            <span className="flex items-center gap-2">
              <Avatar name={deal.owner_name} color={colorOf(deal.owner_name)} size="xs" />
              {deal.owner_name}
            </span>
          </Info>
          <Info label="登録日">{formatDate(deal.created_at)}</Info>
          <Info label="最終更新">{timeAgo(deal.updated_at)}</Info>
        </div>

        {/* 次のアクション */}
        {deal.next_action && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
            <Flag className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-indigo-400 dark:text-indigo-300">
                次のアクション
              </p>
              <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-200">
                {deal.next_action}
              </p>
            </div>
          </div>
        )}

        {/* メモ */}
        {deal.memo && (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">メモ</p>
            <p className="rounded-xl bg-slate-50 p-3.5 text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              {deal.memo}
            </p>
          </div>
        )}

        {/* 活動履歴 */}
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <History className="h-4 w-4 text-slate-400" />
            活動履歴
            <span className="rounded-full bg-slate-100 px-2 text-xs leading-5 font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {activities.length}
            </span>
          </h3>

          <form onSubmit={submitActivity} className="mb-4 flex flex-col gap-2 sm:flex-row">
            <Select
              value={actType}
              onChange={(e) => setActType(e.target.value as ActivityType)}
              className="sm:w-36"
              aria-label="活動種別"
            >
              {MANUAL_ACTIVITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPES[t].icon} {ACTIVITY_TYPES[t].label}
                </option>
              ))}
            </Select>
            <Input
              value={actNote}
              onChange={(e) => setActNote(e.target.value)}
              placeholder="活動内容をメモ…"
              className="flex-1"
            />
            <Button type="submit" disabled={!actNote.trim() || saving}>
              <Send className="h-4 w-4" />
              記録
            </Button>
          </form>

          {activities.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
              まだ活動履歴がありません
            </p>
          ) : (
            <ol className="scrollbar-thin max-h-72 overflow-y-auto pr-1">
              {activities.map((a, i) => (
                <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {i < activities.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-8 bottom-0 left-3.5 w-px bg-slate-200 dark:bg-slate-800"
                    />
                  )}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs dark:bg-slate-800">
                    {ACTIVITY_TYPES[a.type].icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {a.author_name}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">
                        {ACTIVITY_TYPES[a.type].label}
                      </span>
                      <span className="ml-auto shrink-0 text-slate-400 dark:text-slate-500">
                        {timeAgo(a.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{a.note}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="danger" size="sm" onClick={() => onDelete(deal)}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              閉じる
            </Button>
            <Button size="sm" onClick={() => onEdit(deal)}>
              <Pencil className="h-4 w-4" />
              編集
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// =============================================================
// 新規 / 編集フォームモーダル
// =============================================================
export function DealFormModal({
  open,
  initial,
  members,
  defaultOwner,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: Deal | null;
  members: string[];
  defaultOwner: string;
  onClose: () => void;
  onSubmit: (values: DealFormValues) => Promise<void>;
}) {
  // 親側で open のときだけマウントされるため、初期値は useState の初期化子で確定する
  const [values, setValues] = useState<DealFormValues>(() =>
    initial ? toFormValues(initial) : emptyFormValues(defaultOwner)
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof DealFormValues>(key: K, v: DealFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const ownerOptions = Array.from(
    new Set([...members, defaultOwner, values.owner_name].filter(Boolean))
  );

  const valid =
    values.name.trim() !== "" && values.company.trim() !== "" && values.expected_close !== "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        company: values.company.trim(),
        contact_name: values.contact_name.trim(),
        next_action: values.next_action.trim(),
        memo: values.memo.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? "案件を編集" : "新規案件"} wide>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="案件名" required className="sm:col-span-2">
            <Input
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="例: 基幹システム導入支援"
              autoFocus
              required
            />
          </Field>
          <Field label="会社名" required>
            <Input
              value={values.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="例: 株式会社サンプル"
              required
            />
          </Field>
          <Field label="先方担当者">
            <Input
              value={values.contact_name}
              onChange={(e) => set("contact_name", e.target.value)}
              placeholder="例: 山田 太郎"
            />
          </Field>
          <Field label="ステージ">
            <Select
              value={values.stage}
              onChange={(e) => set("stage", e.target.value as DealStage)}
            >
              {STAGE_KEYS.map((s) => (
                <option key={s} value={s}>
                  {DEAL_STAGES[s].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="担当者">
            <Select
              value={values.owner_name}
              onChange={(e) => set("owner_name", e.target.value)}
            >
              {ownerOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="金額（円）" required>
            <Input
              type="number"
              min={0}
              step={10000}
              value={values.amount}
              onChange={(e) => set("amount", Math.max(0, Number(e.target.value) || 0))}
            />
            <p className="mt-1 text-right text-xs font-semibold text-indigo-500 dark:text-indigo-400">
              {formatYenShort(values.amount)}
            </p>
          </Field>
          <Field label="完了予定日" required>
            <Input
              type="date"
              value={values.expected_close}
              onChange={(e) => set("expected_close", e.target.value)}
              required
            />
          </Field>
          <Field label={`確度 ${values.probability}%`} className="sm:col-span-2">
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={values.probability}
                onChange={(e) => set("probability", Number(e.target.value))}
                className="h-2 flex-1 cursor-pointer accent-indigo-600"
                aria-label="確度"
              />
              <Badge className={probabilityClass(values.probability)}>
                {values.probability}%
              </Badge>
            </div>
          </Field>
          <Field label="次のアクション" className="sm:col-span-2">
            <Input
              value={values.next_action}
              onChange={(e) => set("next_action", e.target.value)}
              placeholder="例: 見積書を作成して送付"
            />
          </Field>
          <Field label="メモ" className="sm:col-span-2">
            <Textarea
              value={values.memo}
              onChange={(e) => set("memo", e.target.value)}
              rows={3}
              placeholder="競合状況・先方の関心事など（任意）"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {initial ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {initial ? "保存する" : "登録する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
