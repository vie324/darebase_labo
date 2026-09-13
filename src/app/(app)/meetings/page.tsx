"use client";

// =============================================================
// 商談ログ — 1マイクで録った文字起こしを AI で解析する
//
//   文字起こしを入れる（貼り付け / 録音して自動文字起こし）
//     → AIで解析（話者分離・議事録・ToDo・確度・失注リスク）
//       → ToDoをタスクへ / 確度を案件へ反映
//
// Claude はサーバー経由でのみ呼ぶ（lib/use-ai.ts → /api/ai/analyze-meeting）。
// デモモードではサンプルの解析結果を返し、反映までの流れを確認できる。
// =============================================================

import { useMemo, useState } from "react";
import {
  Bot,
  Brain,
  CheckCheck,
  FileText,
  ListTodo,
  Plus,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { useAiStatus, useMeetingAnalyzer } from "@/lib/use-ai";
import { useConfidenceCriteria } from "@/lib/settings";
import { CONFIDENCE_RANKS } from "@/lib/constants";
import {
  ownActions,
  resolveDueDate,
  type MeetingAnalysis,
  type MeetingContext,
} from "@/lib/meeting-analysis";
import { cn, formatDate, todayStr } from "@/lib/utils";
import type { MeetingLog } from "@/lib/types";
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
  SearchInput,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { AnalysisView } from "./analysis-view";

const KINDS: { key: string; label: string }[] = [
  { key: "meeting", label: "商談" },
  { key: "internal", label: "社内会議" },
  { key: "study", label: "勉強会" },
];

/** jsonb から解析結果を取り出す（未解析・壊れている場合は null） */
function readAnalysis(value: unknown): MeetingAnalysis | null {
  if (!value || typeof value !== "object") return null;
  const a = value as Partial<MeetingAnalysis>;
  return Array.isArray(a.segments) && a.confidence ? (value as MeetingAnalysis) : null;
}

export default function MeetingsPage() {
  const { user } = useUser();
  const { organizationId, loading: accessLoading } = useAccess();
  const logs = useCollection("meeting_logs");
  const deals = useCollection("deals");
  const tasks = useCollection("tasks");
  const { criteria } = useConfidenceCriteria();
  const ai = useAiStatus();
  const { analyzing, error: analyzeError, analyze } = useMeetingAnalyzer();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    company_name: "",
    held_at: todayStr(),
    kind: "meeting",
    deal_id: "",
    transcript: "",
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.items
      .filter(
        (m) =>
          q === "" ||
          m.title.toLowerCase().includes(q) ||
          m.company_name.toLowerCase().includes(q)
      )
      .sort((a, b) => b.held_at.localeCompare(a.held_at));
  }, [logs.items, query]);

  if (!user || accessLoading || logs.loading || deals.loading || tasks.loading) {
    return <PageSkeleton />;
  }

  const detail = detailId ? (logs.items.find((m) => m.id === detailId) ?? null) : null;
  const analyzedCount = logs.items.filter((m) => readAnalysis(m.analysis)).length;
  const rankCount = (rank: string) =>
    logs.items.filter((m) => readAnalysis(m.analysis)?.confidence.rank === rank).length;

  const resetDraft = () =>
    setDraft({
      title: "",
      company_name: "",
      held_at: todayStr(),
      kind: "meeting",
      deal_id: "",
      transcript: "",
    });

  const contextOf = (log: {
    kind: string;
    company_name: string;
    deal_id: string | null;
  }): MeetingContext => {
    const deal = log.deal_id ? deals.items.find((d) => d.id === log.deal_id) : undefined;
    return {
      kind: log.kind,
      companyName: log.company_name || deal?.company || "",
      industry: "",
      revenueScale: "",
      criteria,
    };
  };

  // ---------- 操作 ----------

  const createLog = async () => {
    const now = new Date().toISOString();
    const row = await logs.add({
      title: draft.title.trim() || draft.company_name.trim() || "商談ログ",
      company_name: draft.company_name.trim(),
      held_at: draft.held_at,
      kind: draft.kind,
      deal_id: draft.deal_id || null,
      appointment_id: null,
      bank_id: null,
      branch_id: null,
      transcript: draft.transcript,
      media_url: "",
      analysis: null,
      analyzed_at: "",
      analysis_model: "",
      owner_id: user.id,
      owner_name: user.name,
      organization_id: organizationId,
      business_unit_id: null,
      updated_at: now,
    });
    setFormOpen(false);
    resetDraft();
    setDetailId(row.id);
    toast("商談ログを登録しました。「AIで解析」で分析できます", "success");
  };

  const runAnalysis = async (log: MeetingLog) => {
    const result = await analyze(log.transcript, contextOf(log));
    if (!result) return;
    await logs.update(log.id, {
      analysis: result.analysis,
      analyzed_at: new Date().toISOString(),
      analysis_model: result.model,
      updated_at: new Date().toISOString(),
    });
    toast("解析しました", "success");
  };

  /** 自社がやることをタスクに登録する */
  const createTasks = async (log: MeetingLog) => {
    const analysis = readAnalysis(log.analysis);
    const actions = ownActions(analysis);
    if (actions.length === 0) return;
    const today = todayStr();
    for (const a of actions) {
      await tasks.add({
        title: a.title,
        description: `商談ログ「${log.title}」から自動作成`,
        status: "todo",
        priority: a.priority,
        due_date: resolveDueDate(a.due_hint, today),
        assignee_name: log.owner_name || user.name,
        related_deal: log.deal_id
          ? (deals.items.find((d) => d.id === log.deal_id)?.name ?? "")
          : "",
        completed_at: null,
      });
    }
    toast(`${actions.length}件のタスクを作成しました`, "success");
  };

  /** 確度を案件に反映する */
  const applyConfidence = async (log: MeetingLog) => {
    const analysis = readAnalysis(log.analysis);
    if (!analysis || !log.deal_id) return;
    const deal = deals.items.find((d) => d.id === log.deal_id);
    if (!deal) return;
    await deals.update(deal.id, {
      confidence_rank: analysis.confidence.rank,
      // 後追い中でなければステージも後追いに寄せる（受注・失注は触らない）
      ...(deal.stage === "appointment" ? { stage: "follow_up" as const } : {}),
      updated_at: new Date().toISOString(),
    });
    toast(`案件「${deal.name}」の確度を ${analysis.confidence.rank} に更新しました`, "success");
  };

  const removeLog = async (log: MeetingLog) => {
    if (!confirm(`「${log.title}」を削除しますか？文字起こしと解析結果も削除されます。`)) return;
    await logs.remove(log.id);
    setDetailId(null);
    toast("削除しました", "info");
  };

  return (
    <div>
      <PageHeader
        title="商談ログ"
        description="録音の文字起こしから、議事録・ToDo・確度をAIが起こします"
        icon={<Bot className="h-5 w-5" />}
        actions={
          <Button
            size="sm"
            onClick={() => {
              resetDraft();
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            ログを追加
          </Button>
        }
      />

      {/* AIの設定状況 */}
      {!ai.loading && !ai.configured && (
        <Card
          className={cn(
            "mb-6 p-4 text-sm leading-relaxed",
            ai.isDemo
              ? "border-amber-200 bg-amber-50/60 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              : "border-slate-200 text-slate-600 dark:text-slate-300"
          )}
        >
          {ai.isDemo ? (
            <>
              <b>デモモードです。</b>「AIで解析」を押すとサンプルの解析結果が表示されます
              （実際には Claude を呼びません）。本番では Supabase 接続と
              <code className="mx-1 rounded bg-white/60 px-1 dark:bg-slate-900/40">
                ANTHROPIC_API_KEY
              </code>
              の設定が必要です。
            </>
          ) : (
            <>
              <b>AIが未設定です。</b> サーバーの環境変数に
              <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
                ANTHROPIC_API_KEY
              </code>
              を設定すると解析できるようになります（
              <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">NEXT_PUBLIC_</code>
              は付けないでください）。
            </>
          )}
        </Card>
      )}

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="ログ数"
          value={`${logs.items.length}件`}
          sub={`解析済み ${analyzedCount}件`}
          icon={<FileText className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="確度A"
          value={`${rankCount("A")}件`}
          sub="判定基準を満たす"
          icon={<Target className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="確度B"
          value={`${rankCount("B")}件`}
          sub="あと一押し"
          icon={<Target className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="確度C"
          value={`${rankCount("C")}件`}
          sub="情報収集段階"
          icon={<Target className="h-5 w-5" />}
          accent="sky"
        />
      </div>

      <div className="mt-6 mb-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="商談名・会社名で検索…"
          className="w-full sm:w-72"
        />
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bot className="h-10 w-10" />}
          title={logs.items.length === 0 ? "商談ログがありません" : "該当するログがありません"}
          description={
            logs.items.length === 0
              ? "商談の録音を文字起こししてここに貼ると、議事録とToDoが自動で作られます"
              : "検索条件を変えてみてください"
          }
          action={
            logs.items.length === 0 ? (
              <Button
                onClick={() => {
                  resetDraft();
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                最初のログを追加
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid animate-fade-up gap-4 lg:grid-cols-2">
          {filtered.map((m) => {
            const analysis = readAnalysis(m.analysis);
            const rank = analysis ? CONFIDENCE_RANKS[analysis.confidence.rank] : null;
            return (
              <Card
                key={m.id}
                className="card-hover cursor-pointer p-5"
                onClick={() => setDetailId(m.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-400">
                      {KINDS.find((k) => k.key === m.kind)?.label ?? m.kind} ・{" "}
                      {formatDate(m.held_at)}
                    </p>
                    <h2 className="mt-0.5 truncate font-bold">{m.title}</h2>
                    {m.company_name && (
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {m.company_name}
                      </p>
                    )}
                  </div>
                  {rank ? (
                    <Badge className={cn(rank.color, "shrink-0 font-bold")}>
                      {analysis!.confidence.rank}
                    </Badge>
                  ) : (
                    <Badge className="shrink-0 bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      未解析
                    </Badge>
                  )}
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {analysis?.summary || m.transcript.slice(0, 120) || "文字起こしなし"}
                </p>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------- 追加フォーム ---------- */}
      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} title="商談ログを追加" wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="タイトル">
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="例: 大和精機 初回商談"
              />
            </Field>
            <Field label="相手先">
              <Input
                value={draft.company_name}
                onChange={(e) => setDraft({ ...draft, company_name: e.target.value })}
                placeholder="例: 大和精機"
              />
            </Field>
            <Field label="実施日">
              <Input
                type="date"
                value={draft.held_at}
                onChange={(e) => setDraft({ ...draft, held_at: e.target.value })}
              />
            </Field>
            <Field label="種別">
              <Select
                value={draft.kind}
                onChange={(e) => setDraft({ ...draft, kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="紐付ける案件" className="sm:col-span-2">
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
              <span className="mt-1 block text-[11px] text-slate-400">
                紐付けると、解析した確度をワンタップで案件に反映できます
              </span>
            </Field>
            <Field label="文字起こし" required className="sm:col-span-2">
              <Textarea
                value={draft.transcript}
                onChange={(e) => setDraft({ ...draft, transcript: e.target.value })}
                placeholder="録音の文字起こしを貼り付けてください（話者が混ざったままで構いません）"
                className="min-h-48"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                ロープレ練習の文字起こし機能（Chrome / Edge）で書き起こしたテキストもそのまま使えます
              </span>
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={createLog} disabled={draft.transcript.trim().length < 20}>
              登録
            </Button>
          </div>
        </Modal>
      )}

      {/* ---------- 詳細 ---------- */}
      {detail && (
        <Modal open onClose={() => setDetailId(null)} title={detail.title} wide>
          <MeetingDetail
            log={detail}
            analysis={readAnalysis(detail.analysis)}
            analyzing={analyzing}
            error={analyzeError}
            canAnalyze={ai.configured || ai.isDemo}
            dealName={
              detail.deal_id
                ? (deals.items.find((d) => d.id === detail.deal_id)?.name ?? "")
                : ""
            }
            onAnalyze={() => runAnalysis(detail)}
            onCreateTasks={() => createTasks(detail)}
            onApplyConfidence={() => applyConfidence(detail)}
            onDelete={() => removeLog(detail)}
          />
        </Modal>
      )}
    </div>
  );
}

function MeetingDetail({
  log,
  analysis,
  analyzing,
  error,
  canAnalyze,
  dealName,
  onAnalyze,
  onCreateTasks,
  onApplyConfidence,
  onDelete,
}: {
  log: MeetingLog;
  analysis: MeetingAnalysis | null;
  analyzing: boolean;
  error: string;
  canAnalyze: boolean;
  dealName: string;
  onAnalyze: () => void;
  onCreateTasks: () => void;
  onApplyConfidence: () => void;
  onDelete: () => void;
}) {
  const [showTranscript, setShowTranscript] = useState(!analysis);
  const todoCount = ownActions(analysis).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{formatDate(log.held_at)}</span>
        {log.company_name && <span>・ {log.company_name}</span>}
        {dealName && <span>・ 案件: {dealName}</span>}
        {log.analyzed_at && <span>・ 解析済み（{log.analysis_model}）</span>}
      </div>

      {/* 操作 */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onAnalyze} disabled={analyzing || !canAnalyze}>
          {analyzing ? (
            <>
              <Brain className="h-4 w-4 animate-pulse" />
              解析中…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {analysis ? "AIで再解析" : "AIで解析"}
            </>
          )}
        </Button>
        {analysis && todoCount > 0 && (
          <Button size="sm" variant="secondary" onClick={onCreateTasks}>
            <ListTodo className="h-4 w-4" />
            ToDoをタスクに登録（{todoCount}）
          </Button>
        )}
        {analysis && log.deal_id && (
          <Button size="sm" variant="secondary" onClick={onApplyConfidence}>
            <CheckCheck className="h-4 w-4" />
            確度 {analysis.confidence.rank} を案件に反映
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="ml-auto text-slate-400 hover:text-rose-500"
        >
          <Trash2 className="h-4 w-4" />
          削除
        </Button>
      </div>

      {error && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </p>
      )}

      {analysis ? (
        <AnalysisView analysis={analysis} />
      ) : (
        <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
          まだ解析していません。「AIで解析」を押すと、話者分離・議事録・ToDo・確度が作られます。
        </p>
      )}

      {/* 元の文字起こし */}
      <div>
        <button
          onClick={() => setShowTranscript((v) => !v)}
          className="cursor-pointer text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
        >
          {showTranscript ? "元の文字起こしを隠す" : "元の文字起こしを表示"}
        </button>
        {showTranscript && (
          <pre className="scrollbar-thin mt-2 max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            {log.transcript || "（文字起こしなし）"}
          </pre>
        )}
      </div>
    </div>
  );
}
