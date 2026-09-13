"use client";

// 確度ランク A/B/C の判定基準の設定カード。
//
// 「A とは何か」は先方の運用で決まる値なので、コードに直書きせず
// app_settings に保存する。ここで書いた文言は案件フォームの確度ランク欄と
// 商談カンバンの列見出しにそのまま出るため、現場が同じ基準で判定できる。

import { useEffect, useState } from "react";
import { RotateCcw, Save, Target } from "lucide-react";
import {
  DEFAULT_CONFIDENCE_CRITERIA,
  useConfidenceCriteria,
  type ConfidenceCriteria,
} from "@/lib/settings";
import { CONFIDENCE_RANKS } from "@/lib/constants";
import { Badge, Button, Card, Field, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

const RANK_ORDER: (keyof ConfidenceCriteria)[] = ["A", "B", "C"];

export function ConfidenceSettingsCard() {
  const { criteria, loading, isDefault, save } = useConfidenceCriteria();
  const { toast } = useToast();
  const [draft, setDraft] = useState<ConfidenceCriteria>(criteria);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(criteria);
  }, [criteria]);

  const dirty = RANK_ORDER.some((k) => draft[k] !== criteria[k]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(draft);
      toast("確度の判定基準を保存しました", "success");
    } catch {
      toast("保存に失敗しました", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2.5">
        <Target className="h-5 w-5 text-cyan-500" />
        <h2 className="font-bold">確度の判定基準（A / B / C）</h2>
        {isDefault && (
          <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
            暫定値
          </Badge>
        )}
      </div>
      <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        商談後追いのカードをどの列に置くかの基準です。ここで書いた文言が案件の入力画面と
        商談カンバンの列見出しに表示されます。運用が決まったら書き換えてください。
      </p>

      <div className="space-y-3">
        {RANK_ORDER.map((rank) => (
          <Field key={rank} label={`ランク ${rank}`}>
            <div className="flex items-start gap-2.5">
              <Badge className={`${CONFIDENCE_RANKS[rank].color} mt-2 shrink-0`}>{rank}</Badge>
              <Textarea
                value={draft[rank]}
                onChange={(e) => setDraft({ ...draft, [rank]: e.target.value })}
                placeholder={DEFAULT_CONFIDENCE_CRITERIA[rank]}
                className="min-h-16"
              />
            </div>
          </Field>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={loading || saving || !dirty}>
          <Save className="h-4 w-4" />
          {saving ? "保存中…" : "保存"}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setDraft({ ...DEFAULT_CONFIDENCE_CRITERIA })}
          disabled={saving}
        >
          <RotateCcw className="h-4 w-4" />
          提案の内容に戻す
        </Button>
      </div>
    </Card>
  );
}
