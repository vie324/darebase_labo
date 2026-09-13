"use client";

// =============================================================
// 経費精算 — 申請 → 承認 → 支払
//
// 一般社員: 自分の申請を出す・差し戻しを直して出し直す
// 管理部・経営: 全員分を見て、承認 / 差し戻し / 支払済みにする
//
// 承認・支払は DB 側でも管理部に限っている（0012 の expenses_guard）。
// 領収書は非公開バケットに置き、表示のたびに署名URLを取り直す。
// =============================================================

import { useMemo, useState, type ChangeEvent } from "react";
import {
  Check,
  CircleDollarSign,
  FileText,
  Paperclip,
  Plus,
  Receipt,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { storeFile } from "@/lib/supabase";
import { useFileUrl } from "@/lib/use-file-url";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_KEYS,
  EXPENSE_STATUSES,
  EXPENSE_STATUS_KEYS,
  categoryLabel,
  expenseStatusMeta,
  isEditableByOwner,
  needsCounterparty,
  summarize,
  validateForSubmit,
} from "@/lib/expenses";
import { cn, formatDate, formatYen, todayStr, uid } from "@/lib/utils";
import type { Expense } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  PageSkeleton,
  Select,
  StatCard,
  Tabs,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";

const EMPTY_DRAFT = {
  spent_on: "",
  category: "transport",
  amount: "",
  purpose: "",
  counterparty: "",
  payment_method: "self",
  receipt_file: "",
  deal_id: "",
  note: "",
};

export default function ExpensesPage() {
  const { user } = useUser();
  const { can, loading: accessLoading } = useAccess();
  const expenses = useCollection("expenses");
  const deals = useCollection("deals");
  const { toast } = useToast();

  const [tab, setTab] = useState<"mine" | "approve">("mine");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT, spent_on: todayStr() });
  const [uploading, setUploading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const isApprover = can("hr_admin");

  const mine = useMemo(
    () => expenses.items.filter((e) => e.owner_id === user?.id),
    [expenses.items, user?.id]
  );
  const pending = useMemo(
    () => expenses.items.filter((e) => e.status === "submitted"),
    [expenses.items]
  );

  const visible = useMemo(() => {
    const base = isApprover && tab === "approve" ? expenses.items : mine;
    return base
      .filter((e) => statusFilter === "all" || e.status === statusFilter)
      .sort((a, b) => b.spent_on.localeCompare(a.spent_on));
  }, [expenses.items, mine, isApprover, tab, statusFilter]);

  if (accessLoading || expenses.loading || deals.loading || !user) return <PageSkeleton />;

  if (!can("hr_self")) {
    return (
      <div>
        <PageHeader
          icon={<Receipt className="h-5 w-5" />}
          title="経費精算"
          description="申請から支払までの記録"
        />
        <Card className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          経費精算の対象は本部の社員のみです。
        </Card>
      </div>
    );
  }

  const totals = summarize(isApprover && tab === "approve" ? expenses.items : mine);
  const detail = detailId ? (expenses.items.find((e) => e.id === detailId) ?? null) : null;

  // ---------- 操作 ----------

  const openNew = () => {
    setEditId(null);
    setDraft({ ...EMPTY_DRAFT, spent_on: todayStr() });
    setFormOpen(true);
  };

  const openEdit = (row: Expense) => {
    setEditId(row.id);
    setDraft({
      spent_on: row.spent_on,
      category: row.category,
      amount: String(row.amount),
      purpose: row.purpose,
      counterparty: row.counterparty,
      payment_method: row.payment_method,
      receipt_file: row.receipt_file,
      deal_id: row.deal_id ?? "",
      note: row.note,
    });
    setDetailId(null);
    setFormOpen(true);
  };

  const handleReceipt = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const { ref } = await storeFile(file, `receipts/${uid()}.${ext}`);
      setDraft((d) => ({ ...d, receipt_file: ref }));
    } catch {
      toast("領収書のアップロードに失敗しました", "error");
    } finally {
      setUploading(false);
      input.value = "";
    }
  };

  const draftRow = () => ({
    spent_on: draft.spent_on,
    category: draft.category,
    amount: Number(draft.amount) || 0,
    purpose: draft.purpose,
    counterparty: draft.counterparty,
    payment_method: draft.payment_method,
    receipt_file: draft.receipt_file,
    deal_id: draft.deal_id || null,
    note: draft.note,
  });

  const save = async (submit: boolean) => {
    const now = new Date().toISOString();
    const body = draftRow();
    const status = submit ? "submitted" : "draft";
    if (editId) {
      await expenses.update(editId, {
        ...body,
        status,
        submitted_at: submit ? now : "",
        // 差し戻しから出し直すときは前回の理由を消す
        reject_reason: submit ? "" : undefined,
        updated_at: now,
      } as Partial<Expense>);
    } else {
      await expenses.add({
        ...body,
        owner_id: user.id,
        owner_name: user.name,
        status,
        submitted_at: submit ? now : "",
        approver_name: "",
        approved_at: "",
        reject_reason: "",
        paid_on: "",
        updated_at: now,
      });
    }
    setFormOpen(false);
    toast(submit ? "申請しました" : "下書きを保存しました", "success");
  };

  const submitExisting = async (row: Expense) => {
    const errors = validateForSubmit(row);
    if (errors.length > 0) {
      toast(errors[0], "error");
      return;
    }
    const now = new Date().toISOString();
    await expenses.update(row.id, {
      status: "submitted",
      submitted_at: now,
      reject_reason: "",
      updated_at: now,
    });
    toast("申請しました", "success");
  };

  const withdraw = async (row: Expense) => {
    await expenses.update(row.id, { status: "draft", updated_at: new Date().toISOString() });
    toast("申請を取り下げました", "info");
  };

  const approve = async (row: Expense) => {
    const now = new Date().toISOString();
    await expenses.update(row.id, {
      status: "approved",
      approver_name: user.name,
      approved_at: now,
      reject_reason: "",
      updated_at: now,
    });
    toast(`${row.owner_name}さんの申請を承認しました`, "success");
  };

  const reject = async (row: Expense) => {
    const reason = prompt("差し戻す理由を入力してください（申請者に表示されます）");
    if (reason === null || reason.trim() === "") return;
    const now = new Date().toISOString();
    await expenses.update(row.id, {
      status: "rejected",
      approver_name: user.name,
      reject_reason: reason.trim(),
      updated_at: now,
    });
    toast("差し戻しました", "info");
  };

  const markPaid = async (row: Expense) => {
    const now = new Date().toISOString();
    await expenses.update(row.id, {
      status: "paid",
      paid_on: todayStr(),
      updated_at: now,
    });
    toast("支払済みにしました", "success");
  };

  const remove = async (row: Expense) => {
    if (!confirm("この申請を削除しますか？")) return;
    await expenses.remove(row.id);
    setDetailId(null);
    toast("削除しました", "info");
  };

  const formErrors = validateForSubmit(draftRow());

  return (
    <div>
      <PageHeader
        title="経費精算"
        description="領収書を添えて申請し、管理部が承認・支払を記録します"
        icon={<Receipt className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" />
            経費を申請
          </Button>
        }
      />

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="承認待ち"
          value={`${totals.pendingCount}件`}
          sub={formatYen(totals.pendingAmount)}
          icon={<Send className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="承認済み・未払い"
          value={formatYen(totals.payableAmount)}
          sub="これから支払うぶん"
          icon={<Wallet className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="支払済み"
          value={formatYen(totals.paidAmount)}
          sub="精算が完了したぶん"
          icon={<CircleDollarSign className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="科目トップ"
          value={totals.byCategory[0]?.label ?? "—"}
          sub={
            totals.byCategory[0]
              ? `${formatYen(totals.byCategory[0].amount)} ・ ${totals.byCategory[0].count}件`
              : "申請なし"
          }
          icon={<FileText className="h-5 w-5" />}
          accent="indigo"
        />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        {isApprover && (
          <Tabs
            tabs={[
              { key: "mine" as const, label: "自分の申請", count: mine.length },
              { key: "approve" as const, label: "承認する", count: pending.length },
            ]}
            active={tab}
            onChange={setTab}
          />
        )}
        <div className="w-36">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">すべての状態</option>
            {EXPENSE_STATUS_KEYS.map((s) => (
              <option key={s} value={s}>
                {EXPENSE_STATUSES[s].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* 一覧 */}
      {visible.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-10 w-10" />}
          title={tab === "approve" ? "承認する申請はありません" : "経費の申請がありません"}
          description={
            tab === "approve"
              ? "申請が出るとここに並びます"
              : "立て替えた費用を、領収書を添えて申請してください"
          }
          action={
            tab === "mine" ? (
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" />
                経費を申請
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Card className="animate-fade-up overflow-hidden">
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 sm:px-6">利用日</th>
                  {tab === "approve" && <th className="px-4 py-3">申請者</th>}
                  <th className="px-4 py-3">科目</th>
                  <th className="px-4 py-3">用途</th>
                  <th className="px-4 py-3 text-right">金額</th>
                  <th className="px-4 py-3">状態</th>
                  <th className="px-5 py-3 text-right sm:px-6">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map((row) => {
                  const meta = expenseStatusMeta(row.status);
                  const mineRow = row.owner_id === user.id;
                  return (
                    <tr
                      key={row.id}
                      className="cursor-pointer transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      onClick={() => setDetailId(row.id)}
                    >
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums sm:px-6">
                        {formatDate(row.spent_on)}
                      </td>
                      {tab === "approve" && (
                        <td className="px-4 py-3 whitespace-nowrap">{row.owner_name}</td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap">{categoryLabel(row.category)}</td>
                      <td className="max-w-[18rem] truncate px-4 py-3">{row.purpose}</td>
                      <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                        {formatYen(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={meta.color}>{meta.label}</Badge>
                      </td>
                      <td
                        className="px-5 py-3 text-right sm:px-6"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="flex flex-wrap justify-end gap-1.5">
                          {isApprover && row.status === "submitted" && (
                            <>
                              <Button size="sm" onClick={() => approve(row)}>
                                <Check className="h-3.5 w-3.5" />
                                承認
                              </Button>
                              <Button size="sm" variant="secondary" onClick={() => reject(row)}>
                                <Undo2 className="h-3.5 w-3.5" />
                                差し戻す
                              </Button>
                            </>
                          )}
                          {isApprover && row.status === "approved" && (
                            <Button size="sm" onClick={() => markPaid(row)}>
                              <Wallet className="h-3.5 w-3.5" />
                              支払済み
                            </Button>
                          )}
                          {mineRow && isEditableByOwner(row.status) && (
                            <Button size="sm" variant="secondary" onClick={() => submitExisting(row)}>
                              <Send className="h-3.5 w-3.5" />
                              申請
                            </Button>
                          )}
                          {mineRow && row.status === "submitted" && (
                            <Button size="sm" variant="ghost" onClick={() => withdraw(row)}>
                              <RotateCcw className="h-3.5 w-3.5" />
                              取り下げ
                            </Button>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* 科目別の内訳 */}
      {totals.byCategory.length > 0 && (
        <Card className="mt-4 p-5 sm:p-6">
          <h2 className="mb-4 font-bold">科目別の内訳</h2>
          <div className="flex flex-wrap gap-2">
            {totals.byCategory.map((c) => (
              <span
                key={c.category}
                className="rounded-xl bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800/50"
              >
                <span className="font-semibold">{c.label}</span>
                <span className="ml-2 tabular-nums text-slate-500 dark:text-slate-400">
                  {formatYen(c.amount)} ・ {c.count}件
                </span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* ---------- 申請フォーム ---------- */}
      {formOpen && (
        <Modal
          open
          onClose={() => setFormOpen(false)}
          title={editId ? "経費申請を編集" : "経費を申請"}
          wide
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="利用日" required>
              <Input
                type="date"
                value={draft.spent_on}
                onChange={(e) => setDraft({ ...draft, spent_on: e.target.value })}
              />
            </Field>
            <Field label="金額（円）" required>
              <Input
                type="number"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="3240"
              />
            </Field>
            <Field label="勘定科目">
              <Select
                value={draft.category}
                onChange={(e) => setDraft({ ...draft, category: e.target.value })}
              >
                {EXPENSE_CATEGORY_KEYS.map((c) => (
                  <option key={c} value={c}>
                    {EXPENSE_CATEGORIES[c].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="支払方法">
              <Select
                value={draft.payment_method}
                onChange={(e) => setDraft({ ...draft, payment_method: e.target.value })}
              >
                <option value="self">自己立替</option>
                <option value="corporate">法人カード</option>
              </Select>
            </Field>
            <Field label="用途（何のための支出か）" required className="sm:col-span-2">
              <Input
                value={draft.purpose}
                onChange={(e) => setDraft({ ...draft, purpose: e.target.value })}
                placeholder="例: みらい銀行 中央支店 同行訪問の交通費"
              />
            </Field>
            <Field
              label="相手先"
              required={needsCounterparty(draft.category)}
              className="sm:col-span-2"
            >
              <Input
                value={draft.counterparty}
                onChange={(e) => setDraft({ ...draft, counterparty: e.target.value })}
                placeholder="例: 株式会社アオバ企画 佐野様・林様"
              />
              {needsCounterparty(draft.category) && (
                <span className="mt-1 block text-[11px] text-slate-400">
                  {categoryLabel(draft.category)}は「誰と」の記載がないと経費として説明できません
                </span>
              )}
            </Field>
            <Field label="関連する案件" className="sm:col-span-2">
              <Select
                value={draft.deal_id}
                onChange={(e) => setDraft({ ...draft, deal_id: e.target.value })}
              >
                <option value="">なし</option>
                {deals.items.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}（{d.company}）
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="領収書" required className="sm:col-span-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-sm text-slate-500 transition-colors hover:border-cyan-400 hover:text-cyan-600 dark:border-slate-700 dark:text-slate-400">
                <Paperclip className="h-4 w-4" />
                {uploading
                  ? "アップロード中…"
                  : draft.receipt_file
                    ? "添付済み（差し替えるにはここをクリック）"
                    : "領収書の画像・PDFを選ぶ"}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleReceipt}
                />
              </label>
            </Field>
            <Field label="備考" className="sm:col-span-2">
              <Textarea
                value={draft.note}
                onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                className="min-h-20"
              />
            </Field>
          </div>

          {formErrors.length > 0 && (
            <ul className="mt-4 space-y-1 rounded-xl bg-amber-50/70 px-3.5 py-2.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              {formErrors.map((e) => (
                <li key={e}>・{e}</li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              キャンセル
            </Button>
            <Button variant="secondary" onClick={() => save(false)}>
              下書き保存
            </Button>
            <Button onClick={() => save(true)} disabled={formErrors.length > 0}>
              <Send className="h-4 w-4" />
              申請する
            </Button>
          </div>
        </Modal>
      )}

      {/* ---------- 詳細 ---------- */}
      {detail && (
        <Modal open onClose={() => setDetailId(null)} title="経費申請" wide>
          <ExpenseDetail
            row={detail}
            canEdit={detail.owner_id === user.id && isEditableByOwner(detail.status)}
            onEdit={() => openEdit(detail)}
            onDelete={() => remove(detail)}
          />
        </Modal>
      )}
    </div>
  );
}

function ExpenseDetail({
  row,
  canEdit,
  onEdit,
  onDelete,
}: {
  row: Expense;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const meta = expenseStatusMeta(row.status);
  const receipt = useFileUrl(row.receipt_file);

  const facts: [string, string][] = [
    ["申請者", row.owner_name],
    ["利用日", formatDate(row.spent_on)],
    ["勘定科目", categoryLabel(row.category)],
    ["金額", formatYen(row.amount)],
    ["支払方法", row.payment_method === "corporate" ? "法人カード" : "自己立替"],
    ["用途", row.purpose],
    ["相手先", row.counterparty || "—"],
    ["承認者", row.approver_name || "—"],
    ["承認日", row.approved_at ? formatDate(row.approved_at.slice(0, 10)) : "—"],
    ["支払日", row.paid_on ? formatDate(row.paid_on) : "—"],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={cn(meta.color, "font-bold")}>{meta.label}</Badge>
        <span className="text-lg font-bold tabular-nums">{formatYen(row.amount)}</span>
        <div className="ml-auto flex gap-2">
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={onEdit}>
              編集
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="text-slate-400 hover:text-rose-500"
            >
              <Trash2 className="h-4 w-4" />
              削除
            </Button>
          )}
        </div>
      </div>

      {row.reject_reason && (
        <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm leading-relaxed text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          <b>差し戻し:</b> {row.reject_reason}
        </p>
      )}

      <dl className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-800/50">
            <dt className="text-[11px] font-bold text-slate-400">{label}</dt>
            <dd className="mt-0.5 text-sm">{value}</dd>
          </div>
        ))}
      </dl>

      {row.note && (
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {row.note}
        </p>
      )}

      <div>
        <h3 className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">領収書</h3>
        {row.receipt_file === "" ? (
          <p className="text-sm text-slate-400">未添付</p>
        ) : receipt.loading ? (
          <p className="text-sm text-slate-400">読み込み中…</p>
        ) : (
          <a
            href={receipt.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
          >
            <Paperclip className="h-4 w-4" />
            領収書を開く
          </a>
        )}
      </div>
    </div>
  );
}
