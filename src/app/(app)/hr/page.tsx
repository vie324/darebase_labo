"use client";

// =============================================================
// 人事評価 — 自己評価と評価者評価を突き合わせる
//
// 一般社員: 自分の評価シートに自己採点とコメントを入れる
// 管理部・経営: シートを作り、評価者として採点し、確定する
//
// 点数の計算は lib/evaluation.ts の純粋関数で行う（AIには計算させない）。
// 評価項目（規定）は運用で変わるので、既定値を持ちつつ設定で差し替えられる形にしてある。
//
// 歩合・保険料の計算はここには入っていない。
// 雇用形態の内訳と人数が決まってから、総合点と勤怠の実績値を入力に組む。
// =============================================================

import { useMemo, useState, type FormEvent } from "react";
import {
  ClipboardCheck,
  Lock,
  MessageSquareQuote,
  Plus,
  Scale,
  Target,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import {
  SCORE_MAX,
  SCORE_MIN,
  blankItems,
  evaluationStatusMeta,
  filledCount,
  gapItems,
  readItems,
  scoreBand,
  totalScore,
  type EvaluationItem,
} from "@/lib/evaluation";
import { cn, formatDate } from "@/lib/utils";
import type { Evaluation } from "@/lib/types";
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
  ProgressBar,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";

/** 現在の期（上期/下期）を YYYY-H1 / YYYY-H2 で表す */
function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-H${now.getMonth() < 6 ? 1 : 2}`;
}

export default function HrPage() {
  const { user } = useUser();
  const { can, loading: accessLoading } = useAccess();
  const evaluations = useCollection("evaluations");
  const profiles = useCollection("profiles");
  const { toast } = useToast();

  const [openId, setOpenId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newDraft, setNewDraft] = useState({ target_id: "", period: currentPeriod() });

  const isAdmin = can("hr_admin");

  const rows = useMemo(
    () =>
      [...evaluations.items].sort(
        (a, b) => b.period.localeCompare(a.period) || a.target_name.localeCompare(b.target_name)
      ),
    [evaluations.items]
  );

  if (accessLoading || evaluations.loading || profiles.loading || !user) return <PageSkeleton />;

  if (!can("hr_self")) {
    return (
      <div>
        <PageHeader
          icon={<ClipboardCheck className="h-5 w-5" />}
          title="人事評価"
          description="自己評価と評価者評価"
        />
        <Card className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          人事評価の対象は本部の社員のみです。
        </Card>
      </div>
    );
  }

  const open = openId ? (rows.find((r) => r.id === openId) ?? null) : null;
  const mine = rows.filter((r) => r.target_id === user.id);
  const waitingSelf = rows.filter((r) => r.status === "self").length;
  const waitingReview = rows.filter((r) => r.status === "review").length;
  const finalized = rows.filter((r) => r.status === "finalized");
  const avgFinalized =
    finalized.length > 0
      ? Math.round(
          finalized.reduce((s, r) => s + totalScore(readItems(r.items), "reviewer"), 0) /
            finalized.length
        )
      : null;

  // ---------- 操作 ----------

  const createSheet = async (e?: FormEvent) => {
    e?.preventDefault();
    const target = profiles.items.find((p) => p.id === newDraft.target_id);
    if (!target) return;
    if (rows.some((r) => r.target_id === target.id && r.period === newDraft.period)) {
      toast("その期のシートはすでにあります", "error");
      return;
    }
    const now = new Date().toISOString();
    const row = await evaluations.add({
      target_id: target.id,
      target_name: target.name,
      period: newDraft.period,
      status: "self",
      items: blankItems(),
      self_comment: "",
      reviewer_name: user.name,
      reviewer_comment: "",
      total_score: 0,
      finalized_at: "",
      updated_at: now,
    });
    setNewOpen(false);
    setOpenId(row.id);
    toast(`${target.name}さんの評価シートを作成しました`, "success");
  };

  const saveSheet = async (
    row: Evaluation,
    patch: Partial<Evaluation>,
    message = "保存しました"
  ) => {
    await evaluations.update(row.id, { ...patch, updated_at: new Date().toISOString() });
    toast(message, "success");
  };

  const finalize = async (row: Evaluation, items: EvaluationItem[]) => {
    if (!confirm("確定すると本人・評価者とも編集できなくなります。よろしいですか？")) return;
    const now = new Date().toISOString();
    await evaluations.update(row.id, {
      status: "finalized",
      items,
      total_score: totalScore(items, "reviewer"),
      finalized_at: now,
      updated_at: now,
    });
    toast("評価を確定しました", "success");
  };

  // 評価シートが未作成のメンバー（管理部向け）
  const withoutSheet = profiles.items.filter(
    (p) =>
      !String(p.role_key ?? "").startsWith("partner") &&
      !rows.some((r) => r.target_id === p.id && r.period === currentPeriod())
  );

  return (
    <div>
      <PageHeader
        title="人事評価"
        description="自己評価と評価者評価を突き合わせ、面談の論点を洗い出します"
        icon={<ClipboardCheck className="h-5 w-5" />}
        actions={
          isAdmin ? (
            <Button size="sm" onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4" />
              評価シートを作成
            </Button>
          ) : undefined
        }
      />

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="本人記入待ち"
            value={`${waitingSelf}件`}
            sub="自己評価がまだ"
            icon={<UserCheck className="h-5 w-5" />}
            accent="amber"
          />
          <StatCard
            label="評価者記入中"
            value={`${waitingReview}件`}
            sub="面談前に埋める"
            icon={<Scale className="h-5 w-5" />}
            accent="sky"
          />
          <StatCard
            label="確定済み"
            value={`${finalized.length}件`}
            sub={avgFinalized !== null ? `平均 ${avgFinalized}点` : "確定なし"}
            icon={<Lock className="h-5 w-5" />}
            accent="emerald"
          />
          <StatCard
            label="未作成"
            value={`${withoutSheet.length}名`}
            sub={`${currentPeriod()} のシート`}
            icon={<Target className="h-5 w-5" />}
            accent="indigo"
          />
        </div>
      )}

      {/* 自分の評価 */}
      {!isAdmin && (
        <div className="mb-4">
          {mine.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-10 w-10" />}
              title="評価シートがまだありません"
              description="管理部がシートを作成すると、ここに自己評価の入力欄が出ます"
            />
          ) : null}
        </div>
      )}

      {/* 一覧 */}
      {rows.length > 0 && (
        <div className={cn("grid gap-4 lg:grid-cols-2", isAdmin && "mt-6")}>
          {rows.map((row) => {
            const items = readItems(row.items);
            const meta = evaluationStatusMeta(row.status);
            const selfScore = totalScore(items, "self");
            const reviewerScore = totalScore(items, "reviewer");
            const band = scoreBand(reviewerScore);
            const gaps = gapItems(items);
            return (
              <Card
                key={row.id}
                className="card-hover cursor-pointer p-5"
                onClick={() => setOpenId(row.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400">{row.period}</p>
                    <h2 className="mt-0.5 truncate font-bold">
                      {row.target_name}
                      {row.target_id === user.id && (
                        <span className="ml-1.5 text-xs font-normal text-slate-400">（自分）</span>
                      )}
                    </h2>
                  </div>
                  <Badge className={cn(meta.color, "shrink-0")}>{meta.label}</Badge>
                </div>

                <div className="mt-3 space-y-2">
                  <ScoreRow
                    label="自己評価"
                    score={selfScore}
                    filled={filledCount(items, "self")}
                  />
                  <ScoreRow
                    label="評価者"
                    score={reviewerScore}
                    filled={filledCount(items, "reviewer")}
                    accent
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {reviewerScore > 0 && (
                    <Badge className={cn(band.color, "font-bold")}>評価 {band.label}</Badge>
                  )}
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
        本人・評価者ともに、相手が記入した内容がこの画面で見えます（確定前でも）。面談でそのまま突き合わせる前提の作りです。
      </p>

      {gaps.length > 0 && (
                    <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      認識のズレ {gaps.length}項目
                    </Badge>
                  )}
                  {row.finalized_at && (
                    <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      確定 {formatDate(row.finalized_at.slice(0, 10))}
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------- シート作成 ---------- */}
      {newOpen && (
        <Modal
          open
          onClose={() => setNewOpen(false)}
          title="評価シートを作成"
          onSubmit={createSheet}
          footer={
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNewOpen(false)}>
                キャンセル
              </Button>
              <Button type="submit" disabled={newDraft.target_id === ""}>
                作成
              </Button>
            </div>
          }
        >
          <div className="grid gap-4">
            <Field label="対象者" required>
              <Select
                value={newDraft.target_id}
                onChange={(e) => setNewDraft({ ...newDraft, target_id: e.target.value })}
              >
                <option value="">選択してください</option>
                {profiles.items
                  .filter((p) => !String(p.role_key ?? "").startsWith("partner"))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}（{p.department}）
                    </option>
                  ))}
              </Select>
              <span className="mt-1 block text-[11px] text-slate-400">
                代理店スタッフは評価の対象外です
              </span>
            </Field>
            <Field label="評価期間" required>
              <Input
                value={newDraft.period}
                onChange={(e) => setNewDraft({ ...newDraft, period: e.target.value })}
                placeholder="2026-H1"
                required
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* ---------- 評価シート ---------- */}
      {open && (
        <Modal
          open
          onClose={() => setOpenId(null)}
          title={`${open.target_name} ・ ${open.period}`}
          wide
        >
          <EvaluationSheet
            key={open.id}
            row={open}
            isSelf={open.target_id === user.id}
            isAdmin={isAdmin}
            onSave={(patch, message) => saveSheet(open, patch, message)}
            onFinalize={(items) => finalize(open, items)}
          />
        </Modal>
      )}
    </div>
  );
}

function ScoreRow({
  label,
  score,
  filled,
  accent = false,
}: {
  label: string;
  score: number;
  /** 記入済みの項目数。0 なら「未記入」と出す */
  filled: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] font-bold text-slate-400">{label}</span>
      <ProgressBar
        value={score}
        className="h-2 flex-1"
        barClassName={accent ? "bg-cyan-500" : "bg-slate-300 dark:bg-slate-600"}
      />
      <span className="w-20 shrink-0 text-right text-xs tabular-nums">
        {filled === 0 ? (
          <span className="text-slate-400">未記入</span>
        ) : (
          <>
            <b>{score}</b>
            <span className="text-slate-400"> / {filled}項目</span>
          </>
        )}
      </span>
    </div>
  );
}

function EvaluationSheet({
  row,
  isSelf,
  isAdmin,
  onSave,
  onFinalize,
}: {
  row: Evaluation;
  isSelf: boolean;
  isAdmin: boolean;
  onSave: (patch: Partial<Evaluation>, message?: string) => Promise<void>;
  onFinalize: (items: EvaluationItem[]) => Promise<void>;
}) {
  const stored = readItems(row.items);
  const [items, setItems] = useState<EvaluationItem[]>(
    stored.length > 0 ? stored : blankItems()
  );
  const [selfComment, setSelfComment] = useState(row.self_comment);
  const [reviewerComment, setReviewerComment] = useState(row.reviewer_comment);

  const locked = row.status === "finalized";
  const canSelf = isSelf && !locked;
  const canReview = isAdmin && !locked;

  const selfScore = totalScore(items, "self");
  const reviewerScore = totalScore(items, "reviewer");
  const band = scoreBand(reviewerScore);
  const gaps = gapItems(items);

  const setScore = (key: string, field: "self_score" | "reviewer_score", value: string) => {
    const score = value === "" ? null : Number(value);
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: score } : i)));
  };

  const setNote = (key: string, field: "self_note" | "reviewer_note", value: string) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  };

  return (
    <div className="space-y-5">
      {/* 総合 */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <p className="text-[11px] font-bold text-slate-400">自己評価</p>
          <p className="text-xl font-bold tabular-nums">{selfScore}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400">評価者</p>
          <p className="text-xl font-bold tabular-nums">{reviewerScore}</p>
        </div>
        {reviewerScore > 0 && (
          <Badge className={cn(band.color, "text-sm font-bold")}>{band.label}</Badge>
        )}
        {locked && (
          <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <Lock className="mr-1 h-3 w-3" />
            確定済み
          </Badge>
        )}
        <p className="ml-auto text-[11px] text-slate-400">
          100点換算（未記入の項目は重みごと除外）
        </p>
      </div>

      {gaps.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300">
            <TrendingUp className="h-3.5 w-3.5" />
            面談で話すべき項目（本人と評価者で2段階以上ずれています）
          </h3>
          <p className="text-sm text-amber-900 dark:text-amber-100">
            {gaps.map((g) => g.label).join(" ・ ")}
          </p>
        </div>
      )}

      {/* 項目 */}
      <div className="space-y-3">
        {items.map((item) => {
          const gap =
            item.self_score !== null && item.reviewer_score !== null
              ? Math.abs(item.self_score - item.reviewer_score)
              : 0;
          return (
            <div
              key={item.key}
              className={cn(
                "rounded-xl border p-3.5",
                gap >= 2
                  ? "border-amber-200 dark:border-amber-500/30"
                  : "border-slate-200 dark:border-slate-700"
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold">{item.label}</span>
                <span className="text-xs text-slate-400">重み {item.weight}%</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {item.description}
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                  <p className="mb-1.5 text-[11px] font-bold text-slate-400">本人</p>
                  <ScoreSelect
                    value={item.self_score}
                    disabled={!canSelf}
                    onChange={(v) => setScore(item.key, "self_score", v)}
                  />
                  <Textarea
                    value={item.self_note}
                    onChange={(e) => setNote(item.key, "self_note", e.target.value)}
                    disabled={!canSelf}
                    placeholder="根拠となる事実"
                    className="mt-2 min-h-16 text-xs"
                  />
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                  <p className="mb-1.5 text-[11px] font-bold text-slate-400">評価者</p>
                  <ScoreSelect
                    value={item.reviewer_score}
                    disabled={!canReview}
                    onChange={(v) => setScore(item.key, "reviewer_score", v)}
                  />
                  <Textarea
                    value={item.reviewer_note}
                    onChange={(e) => setNote(item.key, "reviewer_note", e.target.value)}
                    disabled={!canReview}
                    placeholder="評価の理由"
                    className="mt-2 min-h-16 text-xs"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 総括コメント */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="本人コメント">
          <Textarea
            value={selfComment}
            onChange={(e) => setSelfComment(e.target.value)}
            disabled={!canSelf}
            className="min-h-24"
            placeholder="期を通じて取り組んだこと・次の期に変えること"
          />
        </Field>
        <Field label="評価者コメント">
          <Textarea
            value={reviewerComment}
            onChange={(e) => setReviewerComment(e.target.value)}
            disabled={!canReview}
            className="min-h-24"
            placeholder="評価の総括と、次の期への期待"
          />
        </Field>
      </div>

      {!locked && (
        <div className="flex flex-wrap justify-end gap-2">
          {canSelf && (
            <Button
              variant={isAdmin ? "secondary" : "primary"}
              onClick={() =>
                onSave(
                  {
                    items,
                    self_comment: selfComment,
                    ...(row.status === "self" ? { status: "review" } : {}),
                  },
                  "自己評価を保存しました"
                )
              }
            >
              <MessageSquareQuote className="h-4 w-4" />
              自己評価を保存
            </Button>
          )}
          {canReview && (
            <>
              <Button
                variant="secondary"
                onClick={() =>
                  onSave(
                    {
                      items,
                      reviewer_comment: reviewerComment,
                      total_score: totalScore(items, "reviewer"),
                      ...(row.status === "draft" ? { status: "review" } : {}),
                    },
                    "評価を保存しました"
                  )
                }
              >
                下書き保存
              </Button>
              <Button onClick={() => onFinalize(items)}>
                <Lock className="h-4 w-4" />
                確定する
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreSelect({
  value,
  disabled,
  onChange,
}: {
  value: number | null;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const LABELS: Record<number, string> = {
    1: "1 大きく下回る",
    2: "2 下回る",
    3: "3 期待どおり",
    4: "4 上回る",
    5: "5 大きく上回る",
  };
  return (
    <Select
      value={value === null ? "" : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="text-xs"
    >
      <option value="">未記入</option>
      {Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i).map((n) => (
        <option key={n} value={n}>
          {LABELS[n]}
        </option>
      ))}
    </Select>
  );
}
