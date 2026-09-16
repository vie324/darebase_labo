"use client";

// 紹介元（銀行/1次代理店）と窓口（支店/2次代理店）の登録・編集、
// 窓口への活動記録、担当者の一括振り替え。
//
// 呼び名と入力例は事業部で変わるため、すべて terms から引く。
// ここにベタ書きすると、アライアンスの登録画面が銀行の顔のままになる。

import { useState, type FormEvent } from "react";
import { Trash2, Users } from "lucide-react";
import { BRANCH_ACTIVITY_TYPES, BRANCH_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type {
  Bank,
  Branch,
  BranchActivityType,
  BranchStatus,
  Organization,
  Profile,
} from "@/lib/types";
import type { UnitTerms } from "@/lib/business-units";
import { Button, Field, FieldSet, Input, Modal, Select, Textarea } from "@/components/ui";
import {
  emptyActivityForm,
  emptyBankForm,
  emptyBranchForm,
  toBankForm,
  toBranchForm,
  type BankFormValues,
  type BranchActivityFormValues,
  type BranchFormValues,
} from "./shared";

// =============================================================
// 紹介元（銀行 / 1次代理店）
// =============================================================
export function BankFormModal({
  initial,
  terms,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial: Bank | null;
  terms: UnitTerms;
  onClose: () => void;
  onSubmit: (values: BankFormValues) => Promise<void>;
  onDelete?: (bank: Bank) => void;
}) {
  const [values, setValues] = useState<BankFormValues>(
    initial ? toBankForm(initial) : emptyBankForm()
  );
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.name.trim() || saving) return;
    setSaving(true);
    try {
      await onSubmit({ ...values, name: values.name.trim(), code: values.code.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${terms.parent}を${initial ? "編集" : "登録"}`}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={`${terms.parent}名`} required>
          <Input
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            placeholder={`例: ${terms.examples.parent}`}
            autoFocus
            required
          />
        </Field>
        <Field label={terms.parentCode}>
          <Input
            value={values.code}
            onChange={(e) => setValues({ ...values, code: e.target.value })}
            placeholder={`例: ${terms.examples.parentCode}（まとめて登録するときの重複判定に使用）`}
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(e) => setValues({ ...values, is_active: e.target.checked })}
            className="h-4 w-4 cursor-pointer accent-cyan-500"
          />
          取引中（オフにすると選択肢から外れます）
        </label>
        <div className="flex justify-between gap-2 pt-1">
          {initial && onDelete ? (
            <Button type="button" variant="ghost" onClick={() => onDelete(initial)}>
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!values.name.trim() || saving}>
              保存
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// 紹介の窓口（支店 / 2次代理店）
// =============================================================
export function BranchFormModal({
  initial,
  defaultBankId,
  banks,
  members,
  organizations,
  terms,
  onClose,
  onSubmit,
  onDelete,
}: {
  initial: Branch | null;
  defaultBankId: string;
  banks: Bank[];
  members: Profile[];
  organizations: Organization[];
  terms: UnitTerms;
  onClose: () => void;
  onSubmit: (values: BranchFormValues) => Promise<void>;
  onDelete?: (branch: Branch) => void;
}) {
  const [values, setValues] = useState<BranchFormValues>(
    initial ? toBranchForm(initial) : emptyBranchForm(defaultBankId)
  );
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.name.trim() || !values.bank_id || saving) return;
    setSaving(true);
    try {
      await onSubmit({ ...values, name: values.name.trim(), code: values.code.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${terms.child}を${initial ? "編集" : "登録"}`}
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label={terms.parent} required>
          <Select
            value={values.bank_id}
            onChange={(e) => setValues({ ...values, bank_id: e.target.value })}
            required
          >
            <option value="">選択してください</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${terms.child}名`} required>
            <Input
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
              placeholder={`例: ${terms.examples.child}`}
              required
            />
          </Field>
          <Field label={terms.childCode}>
            <Input
              value={values.code}
              onChange={(e) => setValues({ ...values, code: e.target.value })}
              placeholder={`例: ${terms.examples.childCode}`}
              inputMode={terms.numericCode ? "numeric" : undefined}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="都道府県">
            <Input
              value={values.prefecture}
              onChange={(e) => setValues({ ...values, prefecture: e.target.value })}
              placeholder="例: 東京都"
            />
          </Field>
          <Field label="ステータス">
            <Select
              value={values.status}
              onChange={(e) =>
                setValues({ ...values, status: e.target.value as BranchStatus })
              }
            >
              {(Object.keys(BRANCH_STATUSES) as BranchStatus[]).map((s) => (
                <option key={s} value={s}>
                  {BRANCH_STATUSES[s].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="住所">
          <Input
            value={values.address}
            onChange={(e) => setValues({ ...values, address: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="担当営業">
            <Select
              value={values.assigned_to}
              onChange={(e) => setValues({ ...values, assigned_to: e.target.value })}
            >
              <option value="">未割当</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="担当代理店">
            <Select
              value={values.assigned_org_id}
              onChange={(e) => setValues({ ...values, assigned_org_id: e.target.value })}
            >
              <option value="">未設定</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="備考">
          <Textarea
            value={values.note}
            onChange={(e) => setValues({ ...values, note: e.target.value })}
            rows={2}
            placeholder={terms.examples.childNote}
          />
        </Field>
        <div className="flex justify-between gap-2 pt-1">
          {initial && onDelete ? (
            <Button type="button" variant="ghost" onClick={() => onDelete(initial)}>
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!values.name.trim() || !values.bank_id || saving}>
              保存
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// 活動記録（訪問・電話・勉強会）
// =============================================================
export function BranchActivityModal({
  branch,
  bankName,
  terms,
  onClose,
  onSubmit,
}: {
  branch: Branch;
  bankName: string;
  terms: UnitTerms;
  onClose: () => void;
  onSubmit: (values: BranchActivityFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<BranchActivityFormValues>(emptyActivityForm());
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !values.occurred_at) return;
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`${branch.name} に活動を記録`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-xs text-slate-400">
          {bankName} ・ 記録すると{terms.child}の最終接点日が更新されます
        </p>
        <FieldSet label="活動種別">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(BRANCH_ACTIVITY_TYPES) as BranchActivityType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setValues({ ...values, type: t })}
                className={cn(
                  "cursor-pointer rounded-xl px-3.5 py-2 text-sm font-medium transition-all",
                  values.type === t
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {BRANCH_ACTIVITY_TYPES[t].icon} {BRANCH_ACTIVITY_TYPES[t].label}
              </button>
            ))}
          </div>
        </FieldSet>
        <Field label="実施日" required>
          <Input
            type="date"
            value={values.occurred_at}
            onChange={(e) => setValues({ ...values, occurred_at: e.target.value })}
            required
          />
        </Field>
        <Field label="メモ">
          <Textarea
            value={values.memo}
            onChange={(e) => setValues({ ...values, memo: e.target.value })}
            rows={3}
            placeholder="誰に何を話したか、次のアクション"
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={saving || !values.occurred_at}>
            記録する
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// =============================================================
// 担当者の一括振り替え（放置されている窓口を動ける担当に配り直すための機能）
// =============================================================
export function BulkAssignModal({
  count,
  members,
  organizations,
  terms,
  onClose,
  onSubmit,
}: {
  count: number;
  members: Profile[];
  organizations: Organization[];
  terms: UnitTerms;
  onClose: () => void;
  onSubmit: (assignedTo: string, assignedOrgId: string, changeOrg: boolean) => Promise<void>;
}) {
  const [assignedTo, setAssignedTo] = useState("");
  const [assignedOrgId, setAssignedOrgId] = useState("");
  const [changeOrg, setChangeOrg] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      await onSubmit(assignedTo, assignedOrgId, changeOrg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="担当者を一括変更">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-2.5 rounded-xl bg-cyan-50/70 p-3 text-sm dark:bg-cyan-500/10">
          <Users className="h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
          <p>
            選択中の{" "}
            <strong>
              {count}
              {terms.countUnit}
            </strong>{" "}
            の担当を変更します。
          </p>
        </div>
        <Field label="新しい担当営業">
          <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">未割当にする</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={changeOrg}
            onChange={(e) => setChangeOrg(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-cyan-500"
          />
          担当代理店も変更する
        </label>
        {changeOrg && (
          <Field label="新しい担当代理店">
            <Select value={assignedOrgId} onChange={(e) => setAssignedOrgId(e.target.value)}>
              <option value="">未設定にする</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={saving || count === 0}>
            {count}
            {terms.countUnit}を変更
          </Button>
        </div>
      </form>
    </Modal>
  );
}
