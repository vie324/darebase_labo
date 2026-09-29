"use client";

// 販売協力になった案件を、2次代理店として登録する導線。
//
// アライアンス営業では、商談の結果が「販売協力」＝その会社が紹介する側に回る
// ことがあり、原則としてその会社は2次代理店になる。案件の詳細に案内を出し、
// 会社名・紹介元の1次代理店・担当者を引き継いだ登録フォームを開く。
// 判定と初期値は lib/partnership.ts。

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Handshake, Link2, Plus } from "lucide-react";
import { sameNameBranch, type PartnerBranchValues } from "@/lib/partnership";
import type { UnitTerms } from "@/lib/business-units";
import type { Bank, Branch, Profile } from "@/lib/types";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";

/** 案件の詳細に出す案内。登録済みなら登録先を出す */
export function PartnershipPanel({
  registered,
  parentName,
  terms,
  canRegister,
  onRegister,
}: {
  /** この案件から登録した2次代理店（未登録は null） */
  registered: Branch | null;
  /** 登録先の1次代理店名 */
  parentName: string;
  terms: UnitTerms;
  /** 窓口を登録できる権限があるか（本部社員のみ。代理店ユーザーは不可） */
  canRegister: boolean;
  onRegister: () => void;
}) {
  if (registered) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-teal-500" />
        <p className="min-w-0 flex-1 text-sm text-teal-800 dark:text-teal-200">
          {terms.child}「<b>{registered.name}</b>」として登録済み
          {parentName && <span className="text-teal-600 dark:text-teal-300">（{terms.parent}: {parentName}）</span>}
        </p>
        <Link
          href="/banks"
          className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline dark:text-teal-300"
        >
          紹介元マスタで見る
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/60 p-4 dark:border-teal-500/20 dark:bg-teal-500/10">
      <p className="flex items-center gap-2 text-sm font-bold text-teal-800 dark:text-teal-200">
        <Handshake className="h-4 w-4 shrink-0" />
        販売協力の会社は、原則{terms.child}になります
      </p>
      <p className="mt-1 text-xs leading-relaxed text-teal-700/80 dark:text-teal-300/80">
        {terms.child}として登録すると、この会社からの紹介をアポイント・稼働ダッシュボードで追えるようになります。
      </p>
      {canRegister ? (
        <Button size="sm" className="mt-3" onClick={onRegister}>
          <Plus className="h-4 w-4" />
          {terms.child}として登録
        </Button>
      ) : (
        <p className="mt-2 text-xs text-teal-700/80 dark:text-teal-300/80">
          登録は本部のメンバーが行えます
        </p>
      )}
    </div>
  );
}

/**
 * 2次代理店の登録フォーム。
 * 同じ1次代理店の下に同じ名前の窓口があれば、新しく作らずにそちらへ紐づける
 * （紹介元マスタで先に登録してあったケース。二重登録を防ぐ）。
 */
export function PartnerBranchModal({
  initial,
  banks,
  branches,
  members,
  terms,
  onClose,
  onCreate,
  onLink,
}: {
  initial: PartnerBranchValues;
  /** この事業部の紹介元（1次代理店） */
  banks: Bank[];
  /** この事業部の窓口（重複チェック用） */
  branches: Branch[];
  members: Profile[];
  terms: UnitTerms;
  onClose: () => void;
  onCreate: (values: PartnerBranchValues) => Promise<void>;
  /** 既存の窓口をこの案件から生まれたものとして紐づける */
  onLink: (branch: Branch) => Promise<void>;
}) {
  // 紹介元がもう選べない（取引停止など）ときは、見えない値で登録しないよう空欄から選んでもらう
  const [values, setValues] = useState<PartnerBranchValues>(() => ({
    ...initial,
    bank_id: banks.some((b) => b.id === initial.bank_id) ? initial.bank_id : "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = <K extends keyof PartnerBranchValues>(key: K, v: PartnerBranchValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const existing = values.bank_id ? sameNameBranch(branches, values.bank_id, values.name) : null;
  // 別の案件から登録済みの窓口は横取りしない
  const linkable = existing !== null && !existing.source_deal_id;
  const ready = values.bank_id !== "" && values.name.trim() !== "" && (!existing || linkable);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      if (existing) await onLink(existing);
      else await onCreate({ ...values, name: values.name.trim(), code: values.code.trim() });
    } catch {
      setError("登録できませんでした。時間をおいて再度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`${terms.child}として登録`}
      onSubmit={submit}
      footer={
        <div className="space-y-2">
          {error && <p className="text-sm font-medium text-rose-500 dark:text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!ready || saving}>
              {existing ? <Link2 className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {existing ? `既存の${terms.child}に紐づける` : "登録する"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label={terms.parent} required>
          <Select value={values.bank_id} onChange={(e) => set("bank_id", e.target.value)} required>
            <option value="">選択してください</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <span className="mt-1 block text-[11px] text-slate-400">
            原則、この案件を紹介してくれた{terms.parent}の下に登録します
          </span>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`${terms.child}名`} required>
            <Input
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={`例: ${terms.examples.child}`}
              required
            />
          </Field>
          <Field label={terms.childCode}>
            <Input
              value={values.code}
              onChange={(e) => set("code", e.target.value)}
              placeholder={`例: ${terms.examples.childCode}`}
              inputMode={terms.numericCode ? "numeric" : undefined}
              disabled={existing !== null}
            />
          </Field>
        </div>
        <Field label="担当営業">
          <Select
            value={values.assigned_to}
            onChange={(e) => set("assigned_to", e.target.value)}
            disabled={existing !== null}
          >
            <option value="">未割当</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="備考">
          <Textarea
            value={values.note}
            onChange={(e) => set("note", e.target.value)}
            rows={2}
            disabled={existing !== null}
          />
        </Field>

        {existing &&
          (linkable ? (
            <p className="rounded-xl bg-amber-50 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              「{existing.name}」はすでにこの{terms.parent}の{terms.child}として登録されています。
              新しく作らずに、この案件から生まれた{terms.child}として紐づけます。
            </p>
          ) : (
            <p className="rounded-xl bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              「{existing.name}」は別の案件から{terms.child}として登録済みです。紹介元マスタで確認してください。
            </p>
          ))}
      </div>
    </Modal>
  );
}
