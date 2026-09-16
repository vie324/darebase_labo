"use client";

// 選んだ事業部が business_units に無いときの画面。
//
// 行が無いまま一覧を出すと「絞り込み条件なし」＝全件になり、
// アライアンスのタブに銀行営業のデータが出てしまう（それが実際に起きた不具合）。
// データは出さず、作成してもらう。

import { useState } from "react";
import { Layers, Plus } from "lucide-react";
import { UNIT_TERMS, type BusinessUnitSlug } from "@/lib/business-units";
import { Button, Card } from "@/components/ui";

export function UnitMissing({
  slug,
  canCreate,
  onCreate,
}: {
  slug: BusinessUnitSlug;
  /** 事業部を作れる権限があるか（本部社員のみ） */
  canCreate: boolean;
  onCreate: () => Promise<string | null>;
}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const name = UNIT_TERMS[slug].unit;

  const create = async () => {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      await onCreate();
    } catch {
      setError("作成できませんでした。時間をおいて再度お試しください。");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card className="flex flex-col items-center gap-3 py-16 text-center">
      <Layers className="h-10 w-10 text-slate-300 dark:text-slate-600" />
      <div>
        <p className="font-semibold text-slate-600 dark:text-slate-300">
          「{name}」がまだ作成されていません
        </p>
        <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
          {canCreate
            ? "作成すると、この事業部の紹介元・アポ・案件を登録できるようになります"
            : "本部のメンバーに作成を依頼してください"}
        </p>
      </div>
      {canCreate && (
        <Button onClick={create} disabled={creating}>
          <Plus className="h-4 w-4" />
          {creating ? "作成中…" : `${name}を作成`}
        </Button>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
    </Card>
  );
}
