"use client";

// 解析結果の表示。話者分離ログ / 議事録 / ToDo / 確度 / 失注リスク。

import { AlertTriangle, CheckCircle2, ListTodo, MessageSquareQuote, Quote } from "lucide-react";
import { CONFIDENCE_RANKS, TASK_PRIORITIES } from "@/lib/constants";
import {
  LOST_RISK_STYLE,
  SPEAKER_STYLE,
  type MeetingAnalysis,
} from "@/lib/meeting-analysis";
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

export function AnalysisView({ analysis }: { analysis: MeetingAnalysis }) {
  const rank = CONFIDENCE_RANKS[analysis.confidence.rank] ?? CONFIDENCE_RANKS.C;
  const risk = LOST_RISK_STYLE[analysis.lost_risk.level] ?? LOST_RISK_STYLE.mid;

  return (
    <div className="space-y-5">
      {/* 確度と失注リスク */}
      <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">確度</span>
          <Badge className={cn(rank.color, "text-sm font-bold")}>{analysis.confidence.rank}</Badge>
          <Badge className={risk.color}>{risk.label}</Badge>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{analysis.confidence.reason}</p>
        {analysis.confidence.evidence.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {analysis.confidence.evidence.map((quote, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/50 dark:text-slate-300"
              >
                <Quote className="mt-0.5 h-3 w-3 shrink-0 text-cyan-400" />
                <span>{quote}</span>
              </li>
            ))}
          </ul>
        )}
        {analysis.lost_risk.reasons.length > 0 && (
          <ul className="mt-3 space-y-1">
            {analysis.lost_risk.reasons.map((reason, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                {reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 議事録 */}
      <Section icon={<MessageSquareQuote className="h-3.5 w-3.5" />} title="議事録">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{analysis.summary}</p>
        {analysis.decisions.length > 0 && (
          <>
            <p className="mt-3 mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              決まったこと
            </p>
            <ul className="space-y-1">
              {analysis.decisions.map((d, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  {d}
                </li>
              ))}
            </ul>
          </>
        )}
        {analysis.concerns.length > 0 && (
          <>
            <p className="mt-3 mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              懸念
            </p>
            <ul className="space-y-1">
              {analysis.concerns.map((c, i) => (
                <li key={i} className="flex items-start gap-1.5 text-sm leading-relaxed">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  {c}
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* ToDo */}
      {analysis.next_actions.length > 0 && (
        <Section icon={<ListTodo className="h-3.5 w-3.5" />} title="次にやること">
          <ul className="space-y-1.5">
            {analysis.next_actions.map((a, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <Badge className={TASK_PRIORITIES[a.priority].color}>
                  {TASK_PRIORITIES[a.priority].label}
                </Badge>
                <span className="min-w-0 flex-1 text-sm">{a.title}</span>
                <span className="text-[11px] text-slate-400">
                  {a.owner}
                  {a.due_hint && ` ・ ${a.due_hint}`}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 話者分離ログ */}
      <Section icon={<MessageSquareQuote className="h-3.5 w-3.5" />} title="話者分離ログ">
        <ul className="space-y-2">
          {analysis.segments.map((seg, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <Badge className={cn(SPEAKER_STYLE[seg.role] ?? SPEAKER_STYLE.不明, "shrink-0")}>
                {seg.speaker || seg.role}
              </Badge>
              <p className="min-w-0 flex-1 text-sm leading-relaxed">{seg.text}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
