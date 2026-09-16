"use client";

// 稼働の判定基準（休眠日数・稼働判定・フォロー日数）の設定カード。
//
// これらは先方から確定値が届くまでの「仮値」であり、コードに直書きしない（§7-6）。
// 変更は app_settings テーブルに保存され、稼働の集計に即時反映される。
//
// 基準は銀行営業とアライアンス営業で共通（＝どちらの稼働ダッシュボードにも効く）。
// 事業部ごとに別の基準を持たせるなら app_settings のキーを分けるところから。

import { useEffect, useState } from "react";
import { Activity, RotateCcw, Save } from "lucide-react";
import {
  DEFAULT_BRANCH_SETTINGS,
  useBranchSettings,
  type BranchSettings,
} from "@/lib/settings";
import { Badge, Button, Card, Field, Input } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

export function BranchSettingsCard() {
  const { settings, loading, isDefault, save } = useBranchSettings();
  const { toast } = useToast();
  const [draft, setDraft] = useState<BranchSettings>(settings);
  const [saving, setSaving] = useState(false);

  // 読み込み完了・他画面からの変更に追従する
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(settings);
  }, [settings]);

  const num = (key: keyof BranchSettings, label: string, hint: string) => (
    <Field label={label}>
      <Input
        type="number"
        min={0}
        value={String(draft[key] as number)}
        onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
      />
      <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>
    </Field>
  );

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await save(draft);
      toast("判定基準を保存しました", "success");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <Activity className="h-5 w-5 text-cyan-500" />
        <h2 className="font-bold">稼働の判定基準</h2>
        {isDefault && (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            仮の初期値
          </Badge>
        )}
      </div>
      <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        休眠判定・稼働率の計算に使う日数です。確定した基準が決まったらここで変更してください。
        変更は稼働ダッシュボードと紹介元マスタに即時反映されます（銀行営業・アライアンス営業に共通）。
      </p>

      {loading ? (
        <p className="py-4 text-sm text-slate-400">読み込み中…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {num("activeWindowDays", "稼働とみなす日数", "この日数以内に接点があれば稼働扱い")}
            {num("recentMonths", "直近アポ数の集計月数", "紹介元マスタの「直近アポ」の対象期間")}
            {num("dormantWarnDays", "休眠バッジ 黄（日）", "この日数から要フォロー表示")}
            {num("dormantAlertDays", "休眠バッジ 橙（日）", "この日数から休眠ぎみ表示")}
            {num("dormantCriticalDays", "休眠バッジ 赤（日）", "この日数から放置として警告")}
            {num("followUpDays", "結果未入力アラート（日）", "商談予定日からこの日数で通知")}
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={draft.shareBranchDashboard}
              onChange={(e) => setDraft({ ...draft, shareBranchDashboard: e.target.checked })}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-cyan-500"
            />
            <span>
              稼働ダッシュボードを全メンバーに公開する
              <span className="mt-0.5 block text-[11px] text-slate-400">
                オフにすると本部メンバーのみ全体を閲覧できます（ロール別の制御は Phase 2 で実装）
              </span>
            </span>
          </label>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="sm" onClick={submit} disabled={saving}>
              <Save className="h-4 w-4" />
              保存
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setDraft(DEFAULT_BRANCH_SETTINGS)}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4" />
              初期値に戻す
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
