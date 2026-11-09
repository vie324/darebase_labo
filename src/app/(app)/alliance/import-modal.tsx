"use client";

// ★案件管理表★『全体管理』の取込。
//   1. シートを見出しの行から選んでコピー → ここに貼る
//   2. 新規・更新・変更なしの件数と、新しく登録する1次代理店・2次代理店を確認
//   3. 取り込む（新規は案件を作り、更新はチェックしたときだけ上書き）
// 解析・突き合わせは lib/alliance-import.ts（テスト付き）。ここは保存だけを行う。

import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileSpreadsheet, Upload } from "lucide-react";
import { buildImportPlan, type ImportItem } from "@/lib/alliance-import";
import { dealMoneyPatch } from "@/lib/alliance";
import { DIRECT_CHILD_CODE, DIRECT_CHILD_NAME } from "@/lib/business-units";
import { sameName } from "@/lib/partnership";
import type { Collection } from "@/lib/use-collection";
import type { Bank, Branch, Deal, DealActivity, DealProduct, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button, Field, Modal, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

export function AllianceImportModal({
  unitId,
  banks,
  branches,
  deals,
  lines,
  products,
  activities,
  user,
  today,
  onClose,
}: {
  unitId: string;
  banks: Collection<Bank>;
  branches: Collection<Branch>;
  deals: Collection<Deal>;
  lines: Collection<DealProduct>;
  products: Product[];
  activities: Collection<DealActivity>;
  user: { id: string; name: string };
  today: string;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [defaultPrimary, setDefaultPrimary] = useState("");
  const [overwrite, setOverwrite] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const unitBanks = banks.items.filter((b) => b.business_unit_id === unitId);
  const unitBankIds = new Set(unitBanks.map((b) => b.id));
  const unitBranches = branches.items.filter((b) => unitBankIds.has(b.bank_id));
  const unitDeals = deals.items.filter((d) => d.business_unit_id === unitId);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const plan = useMemo(
    () =>
      text.trim()
        ? buildImportPlan(text, {
            banks: unitBanks,
            branches: unitBranches,
            deals: unitDeals,
            lines: lines.items,
            products,
            today,
            defaultPrimary: defaultPrimary || undefined,
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, defaultPrimary, banks.items, branches.items, deals.items, lines.items, products, today]
  );

  const counts = plan
    ? {
        new: plan.items.filter((i) => i.status === "new").length,
        update: plan.items.filter((i) => i.status === "update").length,
        same: plan.items.filter((i) => i.status === "same").length,
      }
    : null;
  const warned = plan ? plan.items.filter((i) => i.row.warnings.length > 0) : [];
  const targets = plan
    ? plan.items.filter((i) => i.status === "new" || (overwrite && i.status === "update"))
    : [];
  // 1次代理店の列が無い（担当者別シートなど）ときだけ、既定の1次代理店を選ばせる
  const needsDefaultPrimary = plan?.error === null && /\t|,/.test(text) && !/1次代理店/.test(text);

  const run = async (e: FormEvent) => {
    e.preventDefault();
    if (!plan || plan.error || running || targets.length === 0) return;
    setRunning(true);
    setProgress({ done: 0, total: targets.length });
    try {
      const now = () => new Date().toISOString();
      // ---- 1次代理店・2次代理店（無いものだけ作る） ----
      const bankRows = [...unitBanks];
      for (const name of plan.newPrimaries) {
        bankRows.push(
          await banks.add({ name, code: "", is_active: true, business_unit_id: unitId })
        );
      }
      const bankOf = (name: string) => bankRows.find((b) => sameName(b.name, name)) ?? null;
      const branchRows = [...unitBranches];
      for (const s of plan.newSecondaries) {
        const bank = bankOf(s.primary);
        if (!bank) continue;
        const direct = sameName(s.name, DIRECT_CHILD_NAME);
        branchRows.push(
          await branches.add({
            bank_id: bank.id,
            name: direct ? DIRECT_CHILD_NAME : s.name,
            code: direct ? DIRECT_CHILD_CODE : "",
            address: "",
            prefecture: "",
            assigned_to: null,
            assigned_name: "",
            assigned_org_id: null,
            status: "active",
            last_contact_at: "",
            note: direct ? "1次代理店から直接の紹介（直紹介）の受け皿" : "案件管理表から登録",
            business_unit_id: unitId,
            updated_at: now(),
          })
        );
      }
      const branchOf = (bankId: string, name: string) =>
        branchRows.find((b) => b.bank_id === bankId && sameName(b.name, name || DIRECT_CHILD_NAME)) ??
        null;

      const saveItem = async (item: ImportItem) => {
        const bank = item.row.primary ? bankOf(item.row.primary) : null;
        const branch = bank ? branchOf(bank.id, item.row.secondary) : null;
        const base = {
          ...item.fields,
          bank_id: bank?.id ?? null,
          branch_id: branch?.id ?? null,
          updated_at: now(),
        };
        let dealId = item.dealId;
        let removedLines = false;
        if (item.status === "new" || !dealId) {
          const row = await deals.add({
            ...base,
            contact_name: "",
            amount: 0,
            owner_name: user.name,
            owner_id: user.id,
            next_action: "",
            business_unit_id: unitId,
            organization_id: branch?.assigned_org_id ?? null,
            fulfillment_updated_at: item.fields.fulfillment_status ? today : "",
          });
          dealId = row.id;
        } else {
          await deals.update(dealId, base);
          // 明細はシートの プラン・プラン数・機器台数 で置き換える
          for (const old of lines.items.filter((l) => l.deal_id === dealId)) {
            await lines.remove(old.id);
            removedLines = true;
          }
        }
        const added: DealProduct[] = [];
        for (const l of item.lines) {
          added.push(await lines.add({ deal_id: dealId, memo: "", ...l }));
        }
        const money = dealMoneyPatch(
          { id: dealId, amount: 0, stage: item.fields.stage, bank_id: bank?.id ?? null },
          added,
          productById
        );
        if (money) {
          await deals.update(dealId, money);
        } else if (removedLines) {
          // シートからプランが消えた：明細の金額を残さない
          await deals.update(dealId, { amount: 0, gross_profit: 0, agency_fee: 0, contract_amount: 0 });
        }
        await activities.add({
          deal_id: dealId,
          type: "note",
          note:
            item.status === "new"
              ? `案件管理表（全体管理 ${item.row.rowNo}行目）から取り込みました`
              : `案件管理表（全体管理 ${item.row.rowNo}行目）の内容で更新しました：${item.changes.join("・")}`,
          author_name: user.name,
        });
      };

      // ---- 案件 ----
      let done = 0;
      for (const item of targets) {
        await saveItem(item);
        done += 1;
        setProgress({ done, total: targets.length });
      }

      toast(`${targets.length}件を取り込みました`, "success");
      onClose();
    } catch {
      toast("途中で保存できなくなりました。取り込めた分はそのまま残っています。もう一度貼り直すと残りだけ取り込めます", "error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Modal
      open
      onClose={running ? () => {} : onClose}
      title="案件管理表から取り込む"
      wide
      onSubmit={run}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-400">
            {progress
              ? `保存中… ${progress.done} / ${progress.total}件`
              : plan && !plan.error
                ? `${targets.length}件を取り込みます`
                : ""}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={running}>
              キャンセル
            </Button>
            <Button type="submit" disabled={!plan || !!plan.error || running || targets.length === 0}>
              <Upload className="h-4 w-4" />
              {running ? "取り込み中…" : "取り込む"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <div>
            ★案件管理表★の『全体管理』シートで、<b>見出しの行（紹介日・商談実施日・1次代理店…）から最後の行まで</b>を選んでコピーし、下に貼り付けてください。
            右側の集計表が一緒に入っても大丈夫です。同じ紹介（企業名 × 1次代理店 × 紹介日）はシステムの案件を更新するので、
            運用を移すまでの間はシートを直したら何度でも貼り直せます。
            機器代金・販売粗利・代理店支払い分は、商材マスタの単価 × プラン数・機器台数で計算し直します。
          </div>
        </div>

        <Field label="貼り付け">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="font-mono text-xs"
            placeholder={"紹介日\t商談実施日\t1次代理店\t2次代理店\t企業名\t商談種別\tセールスフェーズ\t…\n2026/09/01\t2026/09/04\tラフール\t直紹介\tスマイルエンジン株式会社\t販売協力\t‐\t…"}
            autoFocus
          />
        </Field>

        {needsDefaultPrimary && (
          <Field label="1次代理店の列がありません。どの1次代理店のシートですか？（例: ラフール様）">
            <Select value={defaultPrimary} onChange={(e) => setDefaultPrimary(e.target.value)}>
              <option value="">直販（1次代理店なし）</option>
              {unitBanks.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {!plan ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-400 dark:border-slate-700">
            <ClipboardPaste className="h-4 w-4" />
            貼り付けると、取り込む内容をここで確認できます
          </p>
        ) : plan.error ? (
          <p className="flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {plan.error}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                ["新規", counts!.new, "text-cyan-600 dark:text-cyan-400"],
                ["更新", counts!.update, "text-amber-600 dark:text-amber-400"],
                ["変更なし", counts!.same, "text-slate-400"],
              ].map(([label, n, color]) => (
                <div key={label as string} className="rounded-xl border border-slate-200 py-2.5 dark:border-slate-700">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className={cn("text-xl font-bold tabular-nums", color as string)}>{n as number}件</p>
                </div>
              ))}
            </div>

            {counts!.update > 0 && (
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={overwrite}
                  onChange={(e) => setOverwrite(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-cyan-600"
                />
                <span>
                  既にある案件（{counts!.update}件）をシートの内容で上書きする
                  <span className="block text-xs text-slate-400">
                    システムで先に直した項目もシートの値に戻ります。シートを正として運用している間はオンのままにしてください
                  </span>
                </span>
              </label>
            )}

            {(plan.newPrimaries.length > 0 || plan.newSecondaries.length > 0) && (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-3.5 text-xs dark:border-cyan-500/30 dark:bg-cyan-500/10">
                <p className="font-semibold text-cyan-700 dark:text-cyan-300">紹介元マスタに新しく登録します</p>
                {plan.newPrimaries.length > 0 && (
                  <p className="mt-1.5">
                    1次代理店：
                    {plan.newPrimaries.map((n) => (
                      <Badge key={n} className="mr-1 mb-1 bg-white dark:bg-slate-800">{n}</Badge>
                    ))}
                  </p>
                )}
                {plan.newSecondaries.length > 0 && (
                  <p className="mt-1.5">
                    2次代理店：
                    {plan.newSecondaries.map((s) => (
                      <Badge key={`${s.primary}/${s.name}`} className="mr-1 mb-1 bg-white dark:bg-slate-800">
                        {s.primary} ＞ {s.name}
                        {s.name === DIRECT_CHILD_NAME ? "（直紹介）" : ""}
                      </Badge>
                    ))}
                  </p>
                )}
              </div>
            )}

            {plan.unknownPlans.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                商材マスタに無いプラン：{plan.unknownPlans.join("、")}。先に商材マスタに足すと、明細として取り込めます
              </p>
            )}

            {warned.length > 0 && (
              <details className="rounded-xl border border-amber-200 px-3.5 py-2.5 text-xs dark:border-amber-500/30">
                <summary className="cursor-pointer font-semibold text-amber-700 dark:text-amber-300">
                  確認してほしい行（{warned.length}件）
                </summary>
                <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
                  {warned.map((i) => (
                    <li key={i.row.rowNo}>
                      <b>{i.row.rowNo}行目 {i.row.company}</b>：{i.row.warnings.join(" / ")}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="scrollbar-thin max-h-64 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2">行</th>
                    <th className="px-3 py-2">紹介日</th>
                    <th className="px-3 py-2">1次代理店</th>
                    <th className="px-3 py-2">企業名</th>
                    <th className="px-3 py-2">プラン・機器</th>
                    <th className="px-3 py-2">取込</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {plan.items.map((i) => (
                    <tr key={i.row.rowNo}>
                      <td className="px-3 py-1.5 text-slate-400">{i.row.rowNo}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{i.row.referredAt || "—"}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap">{i.row.primary || "直販"}</td>
                      <td className="px-3 py-1.5 font-semibold">{i.row.company}</td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">
                        {i.lines.map((l) => `${l.product_name}×${l.quantity}`).join(" / ") || "—"}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        {i.status === "new" ? (
                          <Badge className="bg-cyan-50 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">新規</Badge>
                        ) : i.status === "update" ? (
                          <span title={i.changes.join("・")}>
                            <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              更新{overwrite ? "" : "（しない）"}
                            </Badge>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400">
                            <CheckCircle2 className="h-3 w-3" />
                            変更なし
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
