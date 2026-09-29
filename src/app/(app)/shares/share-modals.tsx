"use client";

// クライアント共有リンクの発行・編集フォームと、送り方（URL / スプレッドシート連携）の案内。

import { useState, type FormEvent } from "react";
import { Check, Copy, ExternalLink, FileSpreadsheet, Link2, ShieldCheck } from "lucide-react";
import type { UnitTerms } from "@/lib/business-units";
import {
  defaultShareTitle,
  EXPIRY_OPTIONS,
  formatExpiry,
  type ShareSourceRow,
} from "@/lib/client-share";
import type { Bank, Branch, ClientShare } from "@/lib/types";
import { Button, Field, Input, Modal, Select, Textarea } from "@/components/ui";

/** 公開される項目（画面の案内用。中身の正は DB の get_client_share） */
export const PUBLIC_FIELDS = "紹介日・企業名・窓口・商談日・ステータス・進捗・商材・担当・更新日";

export interface ShareFormValues {
  bank_id: string;
  branch_id: string;
  title: string;
  /** EXPIRY_OPTIONS の key。編集時の "keep" は期限を変えない */
  expiry: string;
  note: string;
  is_active: boolean;
}

export function ShareFormModal({
  initial,
  banks,
  branches,
  terms,
  previewRows,
  onClose,
  onSubmit,
}: {
  initial: ClientShare | null;
  /** この事業部の紹介元（取引中のもの） */
  banks: Bank[];
  branches: Branch[];
  terms: UnitTerms;
  /** 選んだ紹介元・窓口で公開される行（件数の確認用） */
  previewRows: (bankId: string, branchId: string) => ShareSourceRow[];
  onClose: () => void;
  onSubmit: (values: ShareFormValues) => Promise<void>;
}) {
  const [values, setValues] = useState<ShareFormValues>(() =>
    initial
      ? {
          bank_id: initial.bank_id,
          branch_id: initial.branch_id ?? "",
          title: initial.title,
          expiry: "keep",
          note: initial.note,
          is_active: initial.is_active,
        }
      : { bank_id: "", branch_id: "", title: "", expiry: "1y", note: "", is_active: true }
  );
  // 見出しを手で直したら、紹介元を選び直しても上書きしない
  const [titleTouched, setTitleTouched] = useState(Boolean(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const nameOf = (bankId: string, branchId: string) => {
    const bank = banks.find((b) => b.id === bankId);
    const branch = branches.find((b) => b.id === branchId);
    return bank ? defaultShareTitle(bank.name, branch?.name) : "";
  };

  const pick = (bankId: string, branchId: string) =>
    setValues((prev) => ({
      ...prev,
      bank_id: bankId,
      branch_id: branchId,
      title: titleTouched ? prev.title : nameOf(bankId, branchId),
    }));

  const branchOptions = branches.filter((b) => b.bank_id === values.bank_id);
  const count = values.bank_id ? previewRows(values.bank_id, values.branch_id).length : 0;
  const ready = values.bank_id !== "" && values.title.trim() !== "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSubmit({ ...values, title: values.title.trim(), note: values.note.trim() });
    } catch {
      setError("保存できませんでした。時間をおいて再度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "共有リンクを編集" : "共有リンクを発行"}
      onSubmit={submit}
      footer={
        <div className="space-y-2">
          {error && <p className="text-sm font-medium text-rose-500 dark:text-rose-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!ready || saving}>
              {initial ? "保存する" : "発行する"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`${terms.parent}（共有先）`} required>
            <Select
              value={values.bank_id}
              onChange={(e) => pick(e.target.value, "")}
              disabled={Boolean(initial)}
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
          <Field label={`${terms.child}で絞る（任意）`}>
            <Select
              value={values.branch_id}
              onChange={(e) => pick(values.bank_id, e.target.value)}
              disabled={Boolean(initial) || !values.bank_id}
            >
              <option value="">すべての{terms.child}</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {initial && (
          <p className="-mt-2 text-[11px] text-slate-400">
            共有先を変えるときは、新しいリンクを発行してください（送った相手が変わるため）
          </p>
        )}

        <Field label="ページの見出し" required>
          <Input
            value={values.title}
            onChange={(e) => {
              setTitleTouched(true);
              setValues({ ...values, title: e.target.value });
            }}
            placeholder={`例: ${defaultShareTitle(terms.examples.parent)}`}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="有効期限">
            <Select
              value={values.expiry}
              onChange={(e) => setValues({ ...values, expiry: e.target.value })}
            >
              {initial && (
                <option value="keep">
                  変更しない（
                  {initial.expires_at ? `${formatExpiry(initial.expires_at)}まで` : "無期限"}）
                </option>
              )}
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {initial && o.days !== null ? `今日から${o.label}` : o.label}
                </option>
              ))}
            </Select>
          </Field>
          {initial && (
            <Field label="公開">
              <Select
                value={values.is_active ? "on" : "off"}
                onChange={(e) => setValues({ ...values, is_active: e.target.value === "on" })}
              >
                <option value="on">公開する</option>
                <option value="off">停止する（URL を開いても何も表示されない）</option>
              </Select>
            </Field>
          )}
        </div>

        <Field label="社内メモ（相手には表示されません）">
          <Textarea
            value={values.note}
            onChange={(e) => setValues({ ...values, note: e.target.value })}
            rows={2}
            placeholder="送付先のご担当者、共有した経緯など"
          />
        </Field>

        <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3.5 py-3 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <span>
            公開されるのは <b>{PUBLIC_FIELDS}</b> だけです。金額・メモ・確度・先方担当者などの社内情報は出ません。
            {values.bank_id && (
              <span className="mt-0.5 block font-semibold text-slate-600 dark:text-slate-300">
                いま公開される紹介: {count}件
              </span>
            )}
          </span>
        </div>
      </div>
    </Modal>
  );
}

/** リンクの送り方。発行直後と、一覧の「送り方」から開く */
export function ShareLinkModal({
  share,
  url,
  csvUrl,
  live,
  onClose,
}: {
  share: ClientShare;
  url: string;
  csvUrl: string;
  /** Supabase 接続時（CSV の自動取得が使える）か */
  live: boolean;
  onClose: () => void;
}) {
  const formula = `=IMPORTDATA("${csvUrl}")`;
  return (
    <Modal
      open
      onClose={onClose}
      title="共有リンクの送り方"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <p className="text-sm font-semibold">{share.title}</p>

        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <Link2 className="h-3.5 w-3.5 text-cyan-500" />
            1. リンクを送る（おすすめ）
          </p>
          <CopyRow value={url} />
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
            ログイン不要・閲覧専用のページです。開くたびに最新の状態が表示され、相手はそのまま CSV も保存できます。
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-cyan-600 hover:underline dark:text-cyan-400"
          >
            相手に見える画面を確認する
            <ExternalLink className="h-3 w-3" />
          </a>
        </section>

        <section>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            2. スプレッドシートで自動更新
          </p>
          {live ? (
            <>
              <CopyRow value={formula} />
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                Google スプレッドシートのセルにこの式を貼ると一覧が取り込まれ、以後はおおむね1時間ごとに自動で更新されます。
                相手のシートにも、こちらの社内シートにも使えます。
              </p>
            </>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3.5 py-3 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              デモモードでは使えません（Supabase に接続すると、この一覧を式1つでスプレッドシートに取り込めます）。
            </p>
          )}
        </section>

        <p className="text-[11px] leading-relaxed text-slate-400">
          リンクはいつでも「停止」「URL を再発行」できます。担当者の交代や契約終了のときは再発行してください（古い URL は開けなくなります）。
        </p>
      </div>
    </Modal>
  );
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では、表示された値を手で選んでもらう
    }
  };
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
        {value}
      </code>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "コピー済み" : "コピー"}
      </Button>
    </div>
  );
}
