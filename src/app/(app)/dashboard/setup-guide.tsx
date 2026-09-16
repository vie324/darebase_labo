"use client";

// =============================================================
// はじめかたガイド
//
// Supabase に接続したての状態では、どの画面も空で「まず何をすればいいか」が
// 分からない。実データの有無から進捗を判定し、残っている手順だけを案内する。
//
// - すべて完了したら自動的に消える（消し忘れの案内が残らない）
// - 手順は権限で出し分ける（代理店にマスタ取込や招待は出さない）
// - 「閉じる」でブラウザに記憶する
// =============================================================

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Briefcase,
  Landmark,
  Phone,
  Rocket,
  UserPlus,
  X,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useAccess } from "@/lib/use-access";
import { useBusinessUnit } from "@/lib/use-business-unit";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui";

const DISMISS_KEY = "dbl:setup-guide-dismissed";

interface Step {
  key: string;
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  done: boolean;
}

export function SetupGuide() {
  const branches = useCollection("branches");
  const appointments = useCollection("appointments");
  const deals = useCollection("deals");
  const profiles = useCollection("profiles");
  const { can, isPartner, loading: accessLoading } = useAccess();

  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    let stored = false;
    try {
      stored = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // 読めない場合は表示する
    }
    // localStorage はSSRで参照できないため、マウント後に反映する
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(stored);
  }, []);

  const { terms } = useBusinessUnit();

  const loading =
    accessLoading ||
    branches.loading ||
    appointments.loading ||
    deals.loading ||
    profiles.loading;
  if (loading || dismissed) return null;

  const candidates: (Step | false)[] = [
    can("master_add") && {
      key: "branches",
      title: `${terms.parent}・${terms.child}リストを登録する`,
      description: `${terms.child}名を貼り付けるだけで登録できます。${terms.child}ごとの稼働状況を追えるようになります`,
      href: "/banks",
      icon: <Landmark className="h-4 w-4" />,
      done: branches.items.length > 0,
    },
    can("role_admin") && {
      key: "members",
      title: "メンバーを招待する",
      description: "ロールを決めて招待します。代理店は自社分だけが見えます",
      href: "/settings",
      icon: <UserPlus className="h-4 w-4" />,
      done: profiles.items.length > 1,
    },
    {
      key: "appointments",
      title: "紹介をアポイントに登録する",
      description: `${terms.parent}から来た紹介を登録すると、予定と${terms.child}の接点日に反映されます`,
      href: "/appointments",
      icon: <Phone className="h-4 w-4" />,
      done: appointments.items.length > 0,
    },
    {
      key: "deals",
      title: "商談を案件化して追いかける",
      description: "商談予定 → 後追い → 発注書待ち → 受注 の順にカンバンで管理します",
      href: "/deals",
      icon: <Briefcase className="h-4 w-4" />,
      done: deals.items.length > 0,
    },
  ];
  const steps: Step[] = candidates.filter((s): s is Step => s !== false);

  const doneCount = steps.filter((s) => s.done).length;
  // すべて終わっていれば案内する必要はない
  if (doneCount === steps.length) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // 保存できなくても閉じるだけはできる
    }
  };

  return (
    <Card className="mb-6 border-cyan-100 p-5 sm:p-6 dark:border-cyan-500/20">
      <div className="mb-4 flex items-start gap-3">
        <div className="bg-brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-900">
          <Rocket className="h-[18px] w-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">はじめかた</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {isPartner
              ? "この2つが終わればひととおり使えます"
              : `この順で進めると、${terms.child}の稼働から受注までがつながります`}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 tabular-nums dark:bg-slate-800 dark:text-slate-400">
          {doneCount} / {steps.length}
        </span>
        <button
          onClick={close}
          aria-label="はじめかたガイドを閉じる"
          className="shrink-0 cursor-pointer rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={cn(
                "group flex items-center gap-3 rounded-xl border p-3 transition-colors",
                step.done
                  ? "border-transparent bg-slate-50/70 dark:bg-slate-800/40"
                  : "border-slate-200 hover:border-cyan-300 hover:bg-cyan-50/50 dark:border-slate-700 dark:hover:border-cyan-500/40 dark:hover:bg-cyan-500/5"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  step.done
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {step.done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-sm font-semibold",
                    step.done && "text-slate-400 line-through dark:text-slate-500"
                  )}
                >
                  {step.icon}
                  {step.title}
                </span>
                {!step.done && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {step.description}
                  </span>
                )}
              </span>
              {!step.done && (
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-500" />
              )}
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
