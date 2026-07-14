"use client";

// =============================================================
// ロープレ練習 — 営業トークを録音／画面録画で練習し、
// 文字起こし・簡易分析・チームフィードバックで改善するモジュール。
// タブ: 練習する / トークスクリプト / 練習履歴
// =============================================================

import { useMemo, useState } from "react";
import { CalendarDays, Clock, Mic, Star, Target } from "lucide-react";
import { PageHeader, PageSkeleton, StatCard, Tabs } from "@/components/ui";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { formatDuration } from "@/lib/utils";
import type { RoleplayFeedback, RoleplaySession } from "@/lib/types";
import { isThisWeek, overallAverageRating } from "./helpers";
import { PracticePanel } from "./practice-panel";
import { ScriptsPanel } from "./scripts-panel";
import { HistoryPanel } from "./history-panel";

type TabKey = "practice" | "scripts" | "history";

export default function RoleplayPage() {
  const { user } = useUser();
  const scripts = useCollection("scripts");
  const sessions = useCollection("roleplay_sessions");
  const profiles = useCollection("profiles");

  const [tab, setTab] = useState<TabKey>("practice");
  const [practiceScriptId, setPracticeScriptId] = useState<string>("");
  const [practiceKey, setPracticeKey] = useState(0);

  const colorOf = useMemo(() => {
    const map = new Map(profiles.items.map((p) => [p.name, p.color]));
    return (name: string) => map.get(name) ?? "indigo";
  }, [profiles.items]);

  if (!user || scripts.loading || sessions.loading || profiles.loading) {
    return <PageSkeleton />;
  }

  // ---------- 統計 ----------
  const total = sessions.items.length;
  const thisWeek = sessions.items.filter((s) => isThisWeek(s.created_at)).length;
  const avg = overallAverageRating(sessions.items);
  const totalSec = sessions.items.reduce((sum, s) => sum + s.duration_sec, 0);

  // ---------- 操作 ----------
  const practiceWithScript = (scriptId: string) => {
    setPracticeScriptId(scriptId);
    setPracticeKey((k) => k + 1);
    setTab("practice");
  };

  const addFeedback = async (session: RoleplaySession, feedback: RoleplayFeedback) => {
    await sessions.update(session.id, { feedbacks: [...session.feedbacks, feedback] });
  };

  const tabDefs: { key: TabKey; label: string; count?: number }[] = [
    { key: "practice", label: "練習する" },
    { key: "scripts", label: "トークスクリプト", count: scripts.items.length },
    { key: "history", label: "練習履歴", count: sessions.items.length },
  ];

  return (
    <div>
      <PageHeader
        title="ロープレ練習"
        description="録音・画面録画でトークを練習し、分析とフィードバックで磨く"
        icon={<Mic className="h-5 w-5" />}
      />

      {/* 統計 */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="総練習回数"
          value={total}
          sub="チーム全体の練習数"
          icon={<Target className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="今週の練習"
          value={thisWeek}
          sub="月曜からの練習数"
          icon={<CalendarDays className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="平均評価"
          value={avg !== null ? avg.toFixed(1) : "—"}
          sub={avg !== null ? "フィードバック星の平均" : "まだ評価がありません"}
          icon={<Star className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="総練習時間"
          value={formatDuration(totalSec)}
          sub="積み上げた練習量"
          icon={<Clock className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      {/* タブ */}
      <Tabs<TabKey> tabs={tabDefs} active={tab} onChange={setTab} className="mb-5" />

      {tab === "practice" && (
        <PracticePanel
          key={practiceKey}
          scripts={scripts.items}
          initialScriptId={practiceScriptId}
          userName={user.name}
          addSession={sessions.add}
          onSaved={() => setTab("history")}
        />
      )}

      {tab === "scripts" && (
        <ScriptsPanel
          scripts={scripts.items}
          userName={user.name}
          colorOf={colorOf}
          onAdd={scripts.add}
          onUpdate={scripts.update}
          onRemove={scripts.remove}
          onPractice={practiceWithScript}
        />
      )}

      {tab === "history" && (
        <HistoryPanel
          sessions={sessions.items}
          userName={user.name}
          colorOf={colorOf}
          onAddFeedback={addFeedback}
          onRemove={sessions.remove}
        />
      )}
    </div>
  );
}
