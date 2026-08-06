"use client";

// アポイントの登録/編集フォームと詳細モーダル。
//
// 入力の速さが最優先（§5-2）。銀行→支店は絞り込み付きの2段セレクト、
// 業種・売上規模・決裁者/担当者はボタン選択、自由入力は企業名とメモだけ。
// スマホ（外出先）から片手で入力できることを前提にした縦積みレイアウト。

import { useMemo, useState, type FormEvent } from "react";
import { Building2, Landmark, Trash2 } from "lucide-react";
import {
  APPOINTMENT_STATUSES,
  CONTACT_ROLES,
  INDUSTRY_OPTIONS,
  REVENUE_SCALE_OPTIONS,
} from "@/lib/constants";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  Appointment,
  AppointmentStatus,
  Bank,
  Branch,
  ContactRole,
  Profile,
} from "@/lib/types";
import { Badge, Button, Field, FieldSet, Input, Modal, Textarea } from "@/components/ui";
import { ChoiceGroup, SearchableSelect } from "./searchable-select";
import {
  emptyAppointmentForm,
  toAppointmentForm,
  type AppointmentFormValues,
} from "./shared";

export function AppointmentFormModal({
  initial,
  banks,
  branches,
  members,
  defaultAssignee,
  onClose,
  onSubmit,
}: {
  initial: Appointment | null;
  banks: Bank[];
  branches: Branch[];
  members: Profile[];
  defaultAssignee: string;
  onClose: () => void;
  onSubmit: (values: AppointmentFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<AppointmentFormValues>(
    initial ? toAppointmentForm(initial) : emptyAppointmentForm(defaultAssignee)
  );
  const [saving, setSaving] = useState(false);

  const bankOptions = useMemo(
    () =>
      banks
        .filter((b) => b.is_active)
        .map((b) => ({ value: b.id, label: b.name, sub: b.code ? `コード ${b.code}` : undefined })),
    [banks]
  );

  const branchOptions = useMemo(
    () =>
      branches
        .filter((b) => b.bank_id === values.bank_id && b.status !== "suspended")
        .map((b) => ({
          value: b.id,
          label: b.name,
          sub: [b.code, b.prefecture, b.assigned_name].filter(Boolean).join(" ・ "),
        })),
    [branches, values.bank_id]
  );

  const ready = values.bank_id !== "" && values.branch_id !== "" && values.company_name.trim() !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    try {
      await onSubmit({ ...values, company_name: values.company_name.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial ? "アポイントを編集" : "アポイントを登録"}>
      <form onSubmit={submit} className="space-y-4">
        {/* 銀行 → 支店 */}
        <FieldSet label="銀行" required>
          <SearchableSelect
            value={values.bank_id}
            options={bankOptions}
            placeholder="銀行を選択"
            emptyText="銀行が登録されていません"
            onChange={(v) => setValues({ ...values, bank_id: v, branch_id: "" })}
          />
        </FieldSet>
        <FieldSet label="支店" required>
          <SearchableSelect
            value={values.branch_id}
            options={branchOptions}
            placeholder={values.bank_id ? "支店を選択" : "先に銀行を選択してください"}
            emptyText="この銀行の支店が登録されていません"
            disabled={!values.bank_id}
            onChange={(v) => setValues({ ...values, branch_id: v })}
          />
        </FieldSet>

        {/* 企業名（自由入力） */}
        <Field label="紹介先企業名" required>
          <Input
            value={values.company_name}
            onChange={(e) => setValues({ ...values, company_name: e.target.value })}
            placeholder="例: 大和精機"
            required
          />
        </Field>

        {/* 日付 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="受電日" required>
            <Input
              type="date"
              value={values.received_at}
              onChange={(e) => setValues({ ...values, received_at: e.target.value })}
              required
            />
          </Field>
          <Field label="商談予定日時">
            <Input
              type="datetime-local"
              value={values.scheduled_local}
              onChange={(e) => setValues({ ...values, scheduled_local: e.target.value })}
            />
          </Field>
        </div>

        {/* ボタン選択 */}
        <FieldSet label="業種">
          <ChoiceGroup
            value={values.industry}
            options={INDUSTRY_OPTIONS.map((v) => ({ value: v, label: v }))}
            onChange={(v) => setValues({ ...values, industry: v })}
          />
        </FieldSet>
        <FieldSet label="売上規模">
          <ChoiceGroup
            value={values.revenue_scale}
            options={REVENUE_SCALE_OPTIONS.map((v) => ({ value: v, label: v }))}
            onChange={(v) => setValues({ ...values, revenue_scale: v })}
          />
        </FieldSet>
        <FieldSet label="面談相手">
          <ChoiceGroup
            value={values.contact_role}
            options={(Object.keys(CONTACT_ROLES) as ContactRole[]).map((k) => ({
              value: k,
              label: CONTACT_ROLES[k].label,
            }))}
            onChange={(v) => setValues({ ...values, contact_role: v as ContactRole | "" })}
          />
        </FieldSet>

        <FieldSet label="担当営業">
          <SearchableSelect
            value={values.assigned_to}
            options={members.map((m) => ({ value: m.id, label: m.name, sub: m.role }))}
            placeholder="担当を選択"
            onChange={(v) => setValues({ ...values, assigned_to: v })}
          />
        </FieldSet>

        <Field label="メモ">
          <Textarea
            value={values.source_note}
            onChange={(e) => setValues({ ...values, source_note: e.target.value })}
            rows={2}
            placeholder="紹介の経緯、先方の課題感など"
          />
        </Field>

        <p className="text-xs text-slate-400">
          登録すると支店の最終接点日が更新され、商談予定日時があればスケジュールにも登録されます。
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!ready || saving}>
            {initial ? "保存" : "登録する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// 詳細
// =============================================================
export function AppointmentDetailModal({
  appointment,
  bankName,
  branchName,
  onClose,
  onEdit,
  onDelete,
  onChangeStatus,
  onCreateDeal,
  hasDeal,
}: {
  appointment: Appointment;
  bankName: string;
  branchName: string;
  onClose: () => void;
  onEdit: (a: Appointment) => void;
  onDelete: (a: Appointment) => void;
  onChangeStatus: (a: Appointment, status: AppointmentStatus) => void;
  onCreateDeal: (a: Appointment) => void;
  hasDeal: boolean;
}) {
  const a = appointment;
  const statuses = (Object.keys(APPOINTMENT_STATUSES) as AppointmentStatus[]).sort(
    (x, y) => APPOINTMENT_STATUSES[x].order - APPOINTMENT_STATUSES[y].order
  );

  return (
    <Modal open onClose={onClose} title={a.company_name || "アポイント"} wide>
      <div className="space-y-5">
        {/* ステータス */}
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
            ステータス（クリックで変更）
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {statuses.map((s) => (
              <button
                key={s}
                onClick={() => onChangeStatus(a, s)}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                  s === a.status
                    ? cn(APPOINTMENT_STATUSES[s].color, "ring-2 ring-cyan-400/60 dark:ring-cyan-500/50")
                    : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-800/60 dark:text-slate-500 dark:hover:bg-slate-800"
                )}
              >
                {APPOINTMENT_STATUSES[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* 基本情報 */}
        <div className="grid gap-4 sm:grid-cols-2">
          <InfoRow icon={<Landmark className="h-4 w-4" />} label="銀行" value={bankName || "—"} />
          <InfoRow icon={<Building2 className="h-4 w-4" />} label="支店" value={branchName || "—"} />
          <InfoRow label="受電日" value={a.received_at ? formatDate(a.received_at) : "—"} />
          <InfoRow
            label="商談予定"
            value={a.scheduled_at ? formatDateTime(a.scheduled_at) : "日程未定"}
          />
          <InfoRow label="業種" value={a.industry || "—"} />
          <InfoRow label="売上規模" value={a.revenue_scale || "—"} />
          <InfoRow
            label="面談相手"
            value={
              a.contact_role ? (
                <Badge className={CONTACT_ROLES[a.contact_role].color}>
                  {CONTACT_ROLES[a.contact_role].label}
                </Badge>
              ) : (
                "—"
              )
            }
          />
          <InfoRow label="担当営業" value={a.assigned_name || "未割当"} />
        </div>

        {a.source_note && (
          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-400">メモ</p>
            <p className="rounded-xl bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-wrap dark:bg-slate-800/50">
              {a.source_note}
            </p>
          </div>
        )}

        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="ghost" onClick={() => onDelete(a)}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onEdit(a)}>
              編集
            </Button>
            <Button onClick={() => onCreateDeal(a)} disabled={hasDeal}>
              {hasDeal ? "案件化済み" : "案件化する"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
        {icon}
        {label}
      </p>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}
