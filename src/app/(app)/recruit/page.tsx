"use client";

// =============================================================
// 採用 — 履歴書の解析・面接質問の生成・面接内容との突き合わせ
//
//   応募者を登録（履歴書を貼る）
//     → ①書類を解析（経歴の整理・面接で確認すべき点）
//       → ②この人向けの面接質問を作る
//         → 面接の文字起こしを入れて ③書類との食い違いを洗い出す
//
// 扱うのは応募者の個人情報なので、
//   - 経営・管理部（recruiting 権限）だけが開ける
//   - DB 側も RLS で同じ範囲に絞ってある（0011_recruiting.sql）
//   - AI は判断材料を作るだけで、合否は出さない
// =============================================================

import { useMemo, useState } from "react";
import {
  Brain,
  FileSearch,
  ListChecks,
  MessagesSquare,
  Plus,
  ScanSearch,
  ShieldAlert,
  Sparkles,
  Trash2,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useAccess } from "@/lib/use-access";
import { useAiStatus, useRecruitAi } from "@/lib/use-ai";
import {
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_KEYS,
  DEFAULT_REQUIREMENTS,
  isOpenStatus,
  readCrosscheck,
  readQuestions,
  readResumeAnalysis,
  seriousGaps,
  statusMeta,
  type Crosscheck,
  type InterviewQuestions,
  type RecruitContext,
  type ResumeAnalysis,
} from "@/lib/recruiting";
import { cn, formatDate, todayStr } from "@/lib/utils";
import type { Candidate } from "@/lib/types";
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
  Tabs,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { AiCaution, CrosscheckView, QuestionsView, ResumeAnalysisView } from "./analysis-views";

type DetailTab = "resume" | "questions" | "crosscheck";

const EMPTY_DRAFT = {
  name: "",
  name_kana: "",
  email: "",
  phone: "",
  position: "法人営業（銀行提携）",
  source: "",
  applied_at: "",
  resume_text: "",
};

export default function RecruitPage() {
  const { user } = useUser();
  const { can, loading: accessLoading } = useAccess();
  const candidates = useCollection("candidates");
  const ai = useAiStatus();
  const { running, error: aiError, run } = useRecruitAi();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"open" | "all">("open");
  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT, applied_at: todayStr() });

  const canRecruit = can("recruiting");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates.items
      .filter((c) => statusFilter === "all" || isOpenStatus(c.status))
      .filter(
        (c) =>
          q === "" ||
          c.name.toLowerCase().includes(q) ||
          c.name_kana.toLowerCase().includes(q) ||
          c.position.toLowerCase().includes(q)
      )
      .sort((a, b) => b.applied_at.localeCompare(a.applied_at));
  }, [candidates.items, query, statusFilter]);

  if (accessLoading || candidates.loading) return <PageSkeleton />;

  if (!canRecruit) {
    return (
      <div>
        <PageHeader
          icon={<UserRoundSearch className="h-5 w-5" />}
          title="採用"
          description="履歴書の解析・面接質問の生成・面接内容との突き合わせ"
        />
        <Card className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-10 w-10 text-slate-300 dark:text-slate-600" />
          <div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              このページは経営層と管理部のみ閲覧できます
            </p>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
              応募者の履歴書・面接記録を扱うため、閲覧できる範囲を絞っています
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const detail = detailId ? (candidates.items.find((c) => c.id === detailId) ?? null) : null;
  const countBy = (status: string) => candidates.items.filter((c) => c.status === status).length;
  const openCount = candidates.items.filter((c) => isOpenStatus(c.status)).length;
  const unanalyzed = candidates.items.filter(
    (c) => isOpenStatus(c.status) && !readResumeAnalysis(c.resume_analysis)
  ).length;

  // ---------- 操作 ----------

  const createCandidate = async () => {
    const now = new Date().toISOString();
    const row = await candidates.add({
      name: draft.name.trim(),
      name_kana: draft.name_kana.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      position: draft.position.trim(),
      status: "applied",
      source: draft.source.trim(),
      applied_at: draft.applied_at || todayStr(),
      resume_text: draft.resume_text,
      resume_file: "",
      resume_analysis: null,
      questions: null,
      interview_transcript: "",
      crosscheck: null,
      note: "",
      owner_id: user?.id ?? null,
      owner_name: user?.name ?? "",
      business_unit_id: null,
      updated_at: now,
    });
    setFormOpen(false);
    setDraft({ ...EMPTY_DRAFT, applied_at: todayStr() });
    setDetailId(row.id);
    toast("応募者を登録しました。「書類を解析」で経歴を整理できます", "success");
  };

  const contextOf = (c: Candidate): RecruitContext => ({
    position: c.position,
    requirements: DEFAULT_REQUIREMENTS,
  });

  const analyzeResume = async (c: Candidate) => {
    const res = await run({ task: "resume", resumeText: c.resume_text, context: contextOf(c) });
    if (!res) return;
    await candidates.update(c.id, {
      resume_analysis: res.result as ResumeAnalysis,
      updated_at: new Date().toISOString(),
    });
    toast("書類を解析しました", "success");
  };

  const generateQuestions = async (c: Candidate) => {
    const res = await run({
      task: "questions",
      resumeText: c.resume_text,
      context: contextOf(c),
      resumeAnalysis: readResumeAnalysis(c.resume_analysis),
    });
    if (!res) return;
    await candidates.update(c.id, {
      questions: res.result as InterviewQuestions,
      updated_at: new Date().toISOString(),
    });
    toast("面接質問を作成しました", "success");
  };

  const runCrosscheck = async (c: Candidate) => {
    const res = await run({
      task: "crosscheck",
      resumeText: c.resume_text,
      transcript: c.interview_transcript,
      context: contextOf(c),
    });
    if (!res) return;
    await candidates.update(c.id, {
      crosscheck: res.result as Crosscheck,
      updated_at: new Date().toISOString(),
    });
    toast("書類と面接を突き合わせました", "success");
  };

  const changeStatus = async (c: Candidate, status: string) => {
    await candidates.update(c.id, { status, updated_at: new Date().toISOString() });
  };

  const saveTranscript = async (c: Candidate, text: string) => {
    await candidates.update(c.id, {
      interview_transcript: text,
      updated_at: new Date().toISOString(),
    });
  };

  const saveNote = async (c: Candidate, note: string) => {
    await candidates.update(c.id, { note, updated_at: new Date().toISOString() });
  };

  const removeCandidate = async (c: Candidate) => {
    if (
      !confirm(
        `「${c.name}」を削除しますか？履歴書・面接の文字起こし・解析結果もすべて削除され、元に戻せません。`
      )
    ) {
      return;
    }
    await candidates.remove(c.id);
    setDetailId(null);
    toast("削除しました", "info");
  };

  return (
    <div>
      <PageHeader
        title="採用"
        description="履歴書の整理・面接質問の生成・面接内容との突き合わせをAIが補助します"
        icon={<UserRoundSearch className="h-5 w-5" />}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setDraft({ ...EMPTY_DRAFT, applied_at: todayStr() });
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            応募者を追加
          </Button>
        }
      />

      {/* 個人情報の扱い */}
      <Card className="mb-4 flex items-start gap-2.5 p-4 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <span>
          このページのデータは応募者の個人情報です。閲覧できるのは経営層と管理部のみで、営業メンバー・代理店からは1件も見えません。
          AIの出力は判断材料であり、合否の判断は行いません。不採用・辞退となった方の情報は、保存期間を決めて削除してください。
        </span>
      </Card>

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
              <b>デモモードです。</b>
              解析ボタンを押すとサンプルの結果が表示されます（実際には Claude を呼びません）。
            </>
          ) : (
            <>
              <b>AIが未設定です。</b> サーバーの環境変数に
              <code className="mx-1 rounded bg-slate-100 px-1 dark:bg-slate-800">
                ANTHROPIC_API_KEY
              </code>
              を設定すると解析できるようになります。
            </>
          )}
        </Card>
      )}

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="選考中"
          value={`${openCount}名`}
          sub={`応募者 全${candidates.items.length}名`}
          icon={<Users className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="書類選考"
          value={`${countBy("screening") + countBy("applied")}名`}
          sub={unanalyzed > 0 ? `未解析 ${unanalyzed}名` : "すべて解析済み"}
          icon={<FileSearch className="h-5 w-5" />}
          accent="sky"
        />
        <StatCard
          label="面接"
          value={`${countBy("interview")}名`}
          sub="日程調整・実施中"
          icon={<MessagesSquare className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="内定"
          value={`${countBy("offer")}名`}
          sub={`入社 ${countBy("hired")}名`}
          icon={<ListChecks className="h-5 w-5" />}
          accent="emerald"
        />
      </div>

      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        <Tabs
          tabs={[
            { key: "open" as const, label: "選考中", count: openCount },
            { key: "all" as const, label: "すべて", count: candidates.items.length },
          ]}
          active={statusFilter}
          onChange={setStatusFilter}
        />
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="氏名・職種で検索…"
          className="w-full sm:w-64"
        />
      </div>

      {/* 一覧 */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserRoundSearch className="h-10 w-10" />}
          title={candidates.items.length === 0 ? "応募者がいません" : "該当する応募者がいません"}
          description={
            candidates.items.length === 0
              ? "履歴書・職務経歴書を貼り付けて登録すると、経歴の整理と面接質問をAIが作ります"
              : "絞り込み条件を変えてみてください"
          }
          action={
            candidates.items.length === 0 ? (
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                最初の応募者を追加
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid animate-fade-up gap-4 lg:grid-cols-2">
          {filtered.map((c) => {
            const meta = statusMeta(c.status);
            const analysis = readResumeAnalysis(c.resume_analysis);
            const gaps = seriousGaps(readCrosscheck(c.crosscheck));
            return (
              <Card
                key={c.id}
                className="card-hover cursor-pointer p-5"
                onClick={() => setDetailId(c.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs text-slate-400">
                      {c.position || "職種未設定"}
                      {c.source && ` ・ ${c.source}`}
                    </p>
                    <h2 className="mt-0.5 truncate font-bold">{c.name || "（氏名未入力）"}</h2>
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                      応募 {formatDate(c.applied_at)}
                    </p>
                  </div>
                  <Badge className={cn(meta.color, "shrink-0 font-bold")}>{meta.label}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                  {analysis?.summary || c.resume_text.slice(0, 110) || "書類が未登録です"}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                  <Badge
                    className={
                      analysis
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }
                  >
                    書類解析 {analysis ? "済" : "未"}
                  </Badge>
                  <Badge
                    className={
                      readQuestions(c.questions)
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }
                  >
                    質問 {readQuestions(c.questions) ? "作成済" : "未"}
                  </Badge>
                  {gaps.length > 0 && (
                    <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                      要確認 {gaps.length}件
                    </Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ---------- 追加フォーム ---------- */}
      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} title="応募者を追加" wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="氏名" required>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="例: 佐々木 遼"
              />
            </Field>
            <Field label="フリガナ">
              <Input
                value={draft.name_kana}
                onChange={(e) => setDraft({ ...draft, name_kana: e.target.value })}
                placeholder="例: ササキ リョウ"
              />
            </Field>
            <Field label="応募職種">
              <Input
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: e.target.value })}
              />
            </Field>
            <Field label="応募経路">
              <Input
                value={draft.source}
                onChange={(e) => setDraft({ ...draft, source: e.target.value })}
                placeholder="例: 人材紹介 / 求人媒体 / リファラル"
              />
            </Field>
            <Field label="メール">
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
            <Field label="電話">
              <Input
                value={draft.phone}
                onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
              />
            </Field>
            <Field label="応募日">
              <Input
                type="date"
                value={draft.applied_at}
                onChange={(e) => setDraft({ ...draft, applied_at: e.target.value })}
              />
            </Field>
            <Field label="履歴書・職務経歴書" required className="sm:col-span-2">
              <Textarea
                value={draft.resume_text}
                onChange={(e) => setDraft({ ...draft, resume_text: e.target.value })}
                placeholder="履歴書・職務経歴書の本文を貼り付けてください"
                className="min-h-48"
              />
              <span className="mt-1 block text-[11px] text-slate-400">
                PDFやWordの場合は、本文をコピーして貼り付けてください
              </span>
            </Field>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              キャンセル
            </Button>
            <Button
              onClick={createCandidate}
              disabled={draft.name.trim() === "" || draft.resume_text.trim().length < 50}
            >
              登録
            </Button>
          </div>
        </Modal>
      )}

      {/* ---------- 詳細 ---------- */}
      {detail && (
        <Modal open onClose={() => setDetailId(null)} title={detail.name || "応募者"} wide>
          <CandidateDetail
            candidate={detail}
            running={running}
            error={aiError}
            canAnalyze={ai.configured || ai.isDemo}
            onAnalyzeResume={() => analyzeResume(detail)}
            onGenerateQuestions={() => generateQuestions(detail)}
            onCrosscheck={() => runCrosscheck(detail)}
            onChangeStatus={(s) => changeStatus(detail, s)}
            onSaveTranscript={(t) => saveTranscript(detail, t)}
            onSaveNote={(n) => saveNote(detail, n)}
            onDelete={() => removeCandidate(detail)}
          />
        </Modal>
      )}
    </div>
  );
}

function CandidateDetail({
  candidate,
  running,
  error,
  canAnalyze,
  onAnalyzeResume,
  onGenerateQuestions,
  onCrosscheck,
  onChangeStatus,
  onSaveTranscript,
  onSaveNote,
  onDelete,
}: {
  candidate: Candidate;
  running: "resume" | "questions" | "crosscheck" | null;
  error: string;
  canAnalyze: boolean;
  onAnalyzeResume: () => void;
  onGenerateQuestions: () => void;
  onCrosscheck: () => void;
  onChangeStatus: (status: string) => void;
  onSaveTranscript: (text: string) => void;
  onSaveNote: (note: string) => void;
  onDelete: () => void;
}) {
  const analysis = readResumeAnalysis(candidate.resume_analysis);
  const questions = readQuestions(candidate.questions);
  const check = readCrosscheck(candidate.crosscheck);

  const [tab, setTab] = useState<DetailTab>("resume");
  const [transcript, setTranscript] = useState(candidate.interview_transcript);
  const [note, setNote] = useState(candidate.note);
  const [showResume, setShowResume] = useState(false);

  const busy = running !== null;
  const transcriptDirty = transcript !== candidate.interview_transcript;
  const noteDirty = note !== candidate.note;

  return (
    <div className="space-y-5">
      {/* 基本情報 */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-400">
        <span>応募 {formatDate(candidate.applied_at)}</span>
        {candidate.position && <span>・ {candidate.position}</span>}
        {candidate.source && <span>・ {candidate.source}</span>}
        {candidate.email && <span>・ {candidate.email}</span>}
        <div className="ml-auto w-32">
          <Select value={candidate.status} onChange={(e) => onChangeStatus(e.target.value)}>
            {CANDIDATE_STATUS_KEYS.map((k) => (
              <option key={k} value={k}>
                {CANDIDATE_STATUSES[k].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* 操作 */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onAnalyzeResume} disabled={busy || !canAnalyze}>
          {running === "resume" ? (
            <>
              <Brain className="h-4 w-4 animate-pulse" />
              解析中…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              {analysis ? "書類を再解析" : "書類を解析"}
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onGenerateQuestions}
          disabled={busy || !canAnalyze}
        >
          {running === "questions" ? (
            <>
              <Brain className="h-4 w-4 animate-pulse" />
              作成中…
            </>
          ) : (
            <>
              <ListChecks className="h-4 w-4" />
              {questions ? "面接質問を作り直す" : "面接質問を作る"}
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={onCrosscheck}
          disabled={busy || !canAnalyze || candidate.interview_transcript.trim().length < 50}
          title={
            candidate.interview_transcript.trim().length < 50
              ? "面接の文字起こしを保存すると実行できます"
              : undefined
          }
        >
          {running === "crosscheck" ? (
            <>
              <Brain className="h-4 w-4 animate-pulse" />
              照合中…
            </>
          ) : (
            <>
              <ScanSearch className="h-4 w-4" />
              書類と面接を突き合わせる
            </>
          )}
        </Button>
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

      <Tabs
        tabs={[
          { key: "resume" as const, label: "書類" },
          { key: "questions" as const, label: "面接質問", count: questions?.questions.length },
          { key: "crosscheck" as const, label: "突き合わせ", count: check?.findings.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {/* 書類 */}
      {tab === "resume" &&
        (analysis ? (
          <ResumeAnalysisView analysis={analysis} />
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            まだ解析していません。「書類を解析」を押すと、経歴の整理と面接で確認すべき点が出ます。
          </p>
        ))}

      {/* 面接質問 */}
      {tab === "questions" &&
        (questions ? (
          <QuestionsView questions={questions} />
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
            まだ作成していません。「面接質問を作る」を押すと、この候補者の経歴に沿った質問案が出ます。
          </p>
        ))}

      {/* 突き合わせ */}
      {tab === "crosscheck" && (
        <div className="space-y-5">
          {check ? (
            <CrosscheckView check={check} />
          ) : (
            <AiCaution>
              面接の文字起こしを保存してから「書類と面接を突き合わせる」を押すと、書類の記載と発言の食い違いを洗い出します。
            </AiCaution>
          )}

          <Field label="面接の文字起こし">
            <Textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="面接の録音を文字起こししたテキストを貼り付けてください（話者が混ざったままで構いません）"
              className="min-h-40"
            />
          </Field>
          {transcriptDirty && (
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setTranscript(candidate.interview_transcript)}
              >
                取り消す
              </Button>
              <Button size="sm" onClick={() => onSaveTranscript(transcript)}>
                文字起こしを保存
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 面接メモ（人が書く） */}
      <Field label="社内メモ">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="面接官の所見・次のアクションなど"
          className="min-h-20"
        />
      </Field>
      {noteDirty && (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setNote(candidate.note)}>
            取り消す
          </Button>
          <Button size="sm" onClick={() => onSaveNote(note)}>
            メモを保存
          </Button>
        </div>
      )}

      {/* 元の書類 */}
      <div>
        <button
          onClick={() => setShowResume((v) => !v)}
          className="cursor-pointer text-xs font-semibold text-cyan-600 hover:text-cyan-500 dark:text-cyan-400"
        >
          {showResume ? "履歴書・職務経歴書を隠す" : "履歴書・職務経歴書を表示"}
        </button>
        {showResume && (
          <pre className="scrollbar-thin mt-2 max-h-64 overflow-y-auto rounded-xl bg-slate-50 p-3 text-xs leading-relaxed whitespace-pre-wrap text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
            {candidate.resume_text || "（未登録）"}
          </pre>
        )}
      </div>
    </div>
  );
}
