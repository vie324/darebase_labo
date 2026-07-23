"use client";

// マスタ（取引先 / 手数料率 / LINEグループ）のフォームモーダル

import { useState, type FormEvent } from "react";
import type { CommissionRate, LineGroup, Partner, PartnerKind } from "@/lib/types";
import { PARTNER_KINDS } from "@/lib/constants";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";

// ---------- 取引先 ----------

export interface PartnerFormValues {
  name: string;
  kind: PartnerKind;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  payment_rule: string;
  default_due_days: number;
  memo: string;
  is_active: boolean;
}

export function PartnerFormModal({
  initial,
  defaultKind = "agency",
  onClose,
  onSubmit,
}: {
  initial: Partner | null;
  defaultKind?: PartnerKind;
  onClose: () => void;
  onSubmit: (values: PartnerFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<PartnerFormValues>(() =>
    initial
      ? {
          name: initial.name,
          kind: initial.kind,
          contact_name: initial.contact_name,
          email: initial.email,
          phone: initial.phone,
          address: initial.address,
          payment_rule: initial.payment_rule,
          default_due_days: initial.default_due_days,
          memo: initial.memo,
          is_active: initial.is_active,
        }
      : {
          name: "",
          kind: defaultKind,
          contact_name: "",
          email: "",
          phone: "",
          address: "",
          payment_rule: "月末締め翌月末払い",
          default_due_days: 30,
          memo: "",
          is_active: true,
        }
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof PartnerFormValues>(key: K, v: PartnerFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const valid = values.name.trim() !== "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        name: values.name.trim(),
        contact_name: values.contact_name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        address: values.address.trim(),
        payment_rule: values.payment_rule.trim(),
        memo: values.memo.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial ? "取引先を編集" : "取引先を登録"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="会社名" required>
            <Input
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="例: 株式会社ウエストセールス"
              required
            />
          </Field>
          <Field label="区分" required>
            <Select
              value={values.kind}
              onChange={(e) => set("kind", e.target.value as PartnerKind)}
            >
              {(Object.keys(PARTNER_KINDS) as PartnerKind[]).map((k) => (
                <option key={k} value={k}>
                  {PARTNER_KINDS[k].label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="担当者名">
            <Input value={values.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
          </Field>
          <Field label="メールアドレス">
            <Input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="電話番号">
            <Input value={values.phone} onChange={(e) => set("phone", e.target.value)} />
          </Field>
          <Field label="住所">
            <Input value={values.address} onChange={(e) => set("address", e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="支払条件（表示用）">
            <Input
              value={values.payment_rule}
              onChange={(e) => set("payment_rule", e.target.value)}
              placeholder="例: 月末締め翌月末払い"
            />
          </Field>
          <Field label="支払サイト（日数）">
            <Input
              type="number"
              min={0}
              value={values.default_due_days}
              onChange={(e) => set("default_due_days", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            />
            <p className="mt-1.5 text-xs text-slate-400">請求書の支払期日の自動計算に使用します</p>
          </Field>
        </div>
        <Field label="メモ">
          <Textarea value={values.memo} onChange={(e) => set("memo", e.target.value)} rows={2} />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={(e) => set("is_active", e.target.checked)}
            className="h-4 w-4 accent-cyan-500"
          />
          取引中（オフにすると選択肢に表示されなくなります）
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {saving ? "保存中…" : "保存する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- 手数料率 ----------

export interface RateFormValues {
  agency_id: string;
  maker_id: string;
  product_name: string;
  rate_type: "percent" | "fixed";
  rate_percent: number;
  fixed_fee: number;
  effective_from: string;
  effective_to: string;
  memo: string;
}

export function RateFormModal({
  initial,
  partners,
  onClose,
  onSubmit,
}: {
  initial: CommissionRate | null;
  partners: Partner[];
  onClose: () => void;
  onSubmit: (values: RateFormValues) => Promise<void>;
}) {
  const agencies = partners.filter((p) => p.kind === "agency");
  const makers = partners.filter((p) => p.kind === "maker");
  const [values, setValues] = useState<RateFormValues>(() =>
    initial
      ? {
          agency_id: initial.agency_id,
          maker_id: initial.maker_id,
          product_name: initial.product_name,
          rate_type: initial.rate_type,
          rate_percent: initial.rate_percent,
          fixed_fee: initial.fixed_fee,
          effective_from: initial.effective_from,
          effective_to: initial.effective_to,
          memo: initial.memo,
        }
      : {
          agency_id: agencies[0]?.id ?? "",
          maker_id: makers[0]?.id ?? "",
          product_name: "",
          rate_type: "percent",
          rate_percent: 50,
          fixed_fee: 0,
          effective_from: "",
          effective_to: "",
          memo: "",
        }
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof RateFormValues>(key: K, v: RateFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const valid =
    values.agency_id !== "" &&
    values.maker_id !== "" &&
    (values.rate_type === "percent"
      ? values.rate_percent >= 0 && values.rate_percent <= 100
      : values.fixed_fee >= 0);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({ ...values, product_name: values.product_name.trim(), memo: values.memo.trim() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial ? "手数料率を編集" : "手数料率を登録"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="代理店" required>
            <Select value={values.agency_id} onChange={(e) => set("agency_id", e.target.value)}>
              {agencies.length === 0 && <option value="">代理店が未登録です</option>}
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="メーカー" required>
            <Select value={values.maker_id} onChange={(e) => set("maker_id", e.target.value)}>
              {makers.length === 0 && <option value="">メーカーが未登録です</option>}
              {makers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="商材名（空欄 = このメーカーの全商材に適用）">
          <Input
            value={values.product_name}
            onChange={(e) => set("product_name", e.target.value)}
            placeholder="例: セールスクラウド Enterprise"
          />
          <p className="mt-1.5 text-xs text-slate-400">
            商材名を指定した率は、全商材向けの率より優先して適用されます
          </p>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="種別" required>
            <Select
              value={values.rate_type}
              onChange={(e) => set("rate_type", e.target.value as "percent" | "fixed")}
            >
              <option value="percent">率（%）</option>
              <option value="fixed">固定額（円/行）</option>
            </Select>
          </Field>
          {values.rate_type === "percent" ? (
            <Field label="代理店率（%）" required>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={values.rate_percent}
                onChange={(e) => set("rate_percent", Number(e.target.value) || 0)}
                required
              />
            </Field>
          ) : (
            <Field label="固定額（円）" required>
              <Input
                type="number"
                min={0}
                value={values.fixed_fee === 0 ? "" : values.fixed_fee}
                onChange={(e) => set("fixed_fee", Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                required
              />
            </Field>
          )}
          <div className="hidden sm:block" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="適用開始日（任意）">
            <Input
              type="date"
              value={values.effective_from}
              onChange={(e) => set("effective_from", e.target.value)}
            />
          </Field>
          <Field label="適用終了日（任意）">
            <Input
              type="date"
              value={values.effective_to}
              onChange={(e) => set("effective_to", e.target.value)}
            />
          </Field>
        </div>
        <Field label="メモ">
          <Textarea value={values.memo} onChange={(e) => set("memo", e.target.value)} rows={2} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {saving ? "保存中…" : "保存する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ---------- LINEグループ ----------

export interface LineGroupFormValues {
  group_id: string;
  group_name: string;
  partner_id: string;
  memo: string;
}

export function LineGroupFormModal({
  initial,
  partners,
  onClose,
  onSubmit,
}: {
  initial: LineGroup | null;
  partners: Partner[];
  onClose: () => void;
  onSubmit: (values: LineGroupFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<LineGroupFormValues>(() =>
    initial
      ? {
          group_id: initial.group_id,
          group_name: initial.group_name,
          partner_id: initial.partner_id ?? "",
          memo: initial.memo,
        }
      : { group_id: "", group_name: "", partner_id: "", memo: "" }
  );
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof LineGroupFormValues>(key: K, v: LineGroupFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const valid = values.group_id.trim() !== "";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSubmit({
        ...values,
        group_id: values.group_id.trim(),
        group_name: values.group_name.trim(),
        memo: values.memo.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial ? "LINEグループを編集" : "LINEグループを手動追加"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="グループID" required>
          <Input
            value={values.group_id}
            onChange={(e) => set("group_id", e.target.value)}
            placeholder="C から始まるLINEのグループID"
            disabled={initial !== null}
            required
          />
          {!initial && (
            <p className="mt-1.5 text-xs text-slate-400">
              通常は公式アカウントがグループに招待されると自動登録されます（Webhook join イベント）
            </p>
          )}
        </Field>
        <Field label="グループ名">
          <Input
            value={values.group_name}
            onChange={(e) => set("group_name", e.target.value)}
            placeholder="例: ◯◯様×DARE BASE 請求書連携"
          />
        </Field>
        <Field label="紐付け先の取引先">
          <Select value={values.partner_id} onChange={(e) => set("partner_id", e.target.value)}>
            <option value="">未紐付け</option>
            {partners
              .filter((p) => p.is_active)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
          <p className="mt-1.5 text-xs text-slate-400">
            紐付けると、このグループから受信した請求書が自動でこの取引先に登録されます
          </p>
        </Field>
        <Field label="メモ">
          <Textarea value={values.memo} onChange={(e) => set("memo", e.target.value)} rows={2} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!valid || saving}>
            {saving ? "保存中…" : "保存する"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
