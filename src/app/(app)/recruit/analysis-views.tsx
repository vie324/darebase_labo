"use client";

// 採用のAI解析結果の表示。履歴書の整理 / 面接質問 / 書類と面接の突き合わせ。
// どれも「人が判断するための材料」であることが画面から分かるようにする。

import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  CircleHelp,
  HelpCircle,
  Quote,
  Sparkles,
  Target,
} from "lucide-react";
import {
  GAP_STYLE,
  QUESTION_CATEGORY_STYLE,
  type Crosscheck,
  type InterviewQuestions,
  type ResumeAnalysis,
} from "@/lib/recruiting";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** AIの出力の扱いを毎回そえる（採用の判断はAIにさせない） */
export function AiCaution({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
      {children}
    </p>
  );
}

// ---------- 1. 履歴書の整理 ----------

export function ResumeAnalysisView({ analysis }: { analysis: ResumeAnalysis }) {
  return (
    <div className="space-y-5">
      <AiCaution>
        AIが書類の記載を整理したものです。合否の判断はしていません。数値や期間は必ず原本と突き合わせてください。
      </AiCaution>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <p className="text-sm leading-relaxed">{analysis.summary}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            社会人経験 {analysis.experience_years}年
          </Badge>
          <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            営業経験 {analysis.sales_years}年
          </Badge>
          <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            転職 {analysis.job_changes.count}回
          </Badge>
          {analysis.job_changes.blanks.map((b) => (
            <Badge
              key={b}
              className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
            >
              空白 {b}
            </Badge>
          ))}
        </div>
      </div>

      {analysis.career.length > 0 && (
        <Section icon={<Briefcase className="h-3.5 w-3.5" />} title="職歴">
          <ol className="space-y-3">
            {analysis.career.map((c, i) => (
              <li
                key={i}
                className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-semibold">{c.company}</span>
                  <span className="text-xs text-slate-400">{c.period}</span>
                </div>
                {c.role && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{c.role}</p>
                )}
                {c.highlights.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {c.highlights.map((h, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
                      >
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                        {h}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {analysis.strengths.length > 0 && (
        <Section icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="募集職種に対して強みになりそうな点">
          <ul className="space-y-2">
            {analysis.strengths.map((s, i) => (
              <li
                key={i}
                className="rounded-xl bg-emerald-50/70 px-3.5 py-2.5 dark:bg-emerald-500/10"
              >
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {s.point}
                </p>
                <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-emerald-700/80 dark:text-emerald-300/70">
                  <Quote className="mt-0.5 h-3 w-3 shrink-0" />
                  {s.evidence}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {analysis.verify_points.length > 0 && (
        <Section icon={<CircleHelp className="h-3.5 w-3.5" />} title="面接で確認すべき点">
          <ul className="space-y-2">
            {analysis.verify_points.map((v, i) => (
              <li key={i} className="rounded-xl bg-amber-50/70 px-3.5 py-2.5 dark:bg-amber-500/10">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {v.point}
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-amber-700/80 dark:text-amber-300/70">
                  {v.reason}
                </p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {analysis.skills.length > 0 && (
        <Section icon={<Sparkles className="h-3.5 w-3.5" />} title="スキル・資格">
          <div className="flex flex-wrap gap-1.5">
            {analysis.skills.map((s) => (
              <Badge
                key={s}
                className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
              >
                {s}
              </Badge>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ---------- 2. 面接質問 ----------

export function QuestionsView({ questions }: { questions: InterviewQuestions }) {
  return (
    <div className="space-y-5">
      <AiCaution>
        書類の記載をもとに作った質問案です。そのまま読み上げる前提ではなく、面接官が取捨選択して使ってください。
      </AiCaution>

      {questions.focus && (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 dark:border-cyan-500/30 dark:bg-cyan-500/10">
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-300">
            <Target className="h-3.5 w-3.5" />
            この面接で確かめること
          </h3>
          <p className="text-sm leading-relaxed text-cyan-900 dark:text-cyan-100">
            {questions.focus}
          </p>
        </div>
      )}

      <ol className="space-y-3">
        {questions.questions.map((q, i) => (
          <li key={i} className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed font-semibold">{q.question}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      QUESTION_CATEGORY_STYLE[q.category] ??
                        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    )}
                  >
                    {q.category}
                  </Badge>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{q.intent}</span>
                </div>
                {q.follow_ups.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {q.follow_ups.map((f, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
                      >
                        <HelpCircle className="mt-0.5 h-3 w-3 shrink-0 text-slate-300 dark:text-slate-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------- 3. 書類と面接の突き合わせ ----------

export function CrosscheckView({ check }: { check: Crosscheck }) {
  return (
    <div className="space-y-5">
      <AiCaution>
        食い違いは「言い間違い・書類の書き方の差」であることも多く、それ自体が不採用の理由にはなりません。本人に確認する材料として使ってください。
      </AiCaution>

      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <p className="text-sm leading-relaxed">{check.summary}</p>
      </div>

      {check.findings.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50/70 px-3.5 py-3 text-sm text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          書類と面接で食い違う点は見つかりませんでした。
        </div>
      ) : (
        <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} title="食い違っている点">
          <ul className="space-y-3">
            {check.findings.map((f, i) => {
              const style = GAP_STYLE[f.level] ?? GAP_STYLE.low;
              return (
                <li
                  key={i}
                  className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-700"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={style.color}>{style.label}</Badge>
                    <span className="text-sm font-semibold">{f.topic}</span>
                  </div>
                  <dl className="mt-2.5 grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                      <dt className="text-[11px] font-bold text-slate-400">書類</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {f.resume_says}
                      </dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                      <dt className="text-[11px] font-bold text-slate-400">面接</dt>
                      <dd className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {f.interview_says}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-cyan-700 dark:text-cyan-300">
                    <HelpCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    {f.how_to_confirm}
                  </p>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {check.consistent_points.length > 0 && (
        <Section icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="書類と一致していた点">
          <ul className="space-y-1.5">
            {check.consistent_points.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              >
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                {c}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {check.unanswered.length > 0 && (
        <Section icon={<CircleHelp className="h-3.5 w-3.5" />} title="面接で触れられなかった点">
          <ul className="space-y-1.5">
            {check.unanswered.map((u, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
              >
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" />
                {u}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
