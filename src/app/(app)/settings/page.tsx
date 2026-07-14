"use client";

import { useState } from "react";
import {
  CalendarClock,
  Database,
  Info,
  Palette,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Badge, Button, Card, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const configured = isSupabaseConfigured();
  const [cleared, setCleared] = useState(false);

  const resetDemoData = () => {
    if (!confirm("デモデータを初期状態に戻します。このブラウザで追加・編集した内容は削除されます。よろしいですか？")) {
      return;
    }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("dbl:data:"))
        .forEach((k) => localStorage.removeItem(k));
      setCleared(true);
      setTimeout(() => window.location.reload(), 600);
    } catch {}
  };

  return (
    <div>
      <PageHeader
        title="設定"
        description="接続状態の確認とデータ管理"
        icon={<Settings className="h-5 w-5" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* データベース接続 */}
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2.5">
            <Database className="h-5 w-5 text-cyan-500" />
            <h2 className="font-bold">データベース接続</h2>
            {configured ? (
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                Supabase 接続中
              </Badge>
            ) : (
              <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                デモモード
              </Badge>
            )}
          </div>
          {configured ? (
            <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Supabase に接続済みです。データはクラウドに保存され、チーム全員で共有されます。
            </p>
          ) : (
            <div className="space-y-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              <p>
                現在はデモモードで動作しています。データは
                <strong className="text-slate-700 dark:text-slate-200">
                  このブラウザの localStorage
                </strong>
                にのみ保存されます。チームで共有するには Supabase を接続してください。
              </p>
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-600 hover:underline dark:text-cyan-400"
                  >
                    supabase.com
                  </a>
                  でプロジェクトを作成
                </li>
                <li>
                  リポジトリの <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">supabase/migrations/</code> 内の SQL を番号順にすべて実行
                </li>
                <li>
                  環境変数 <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">NEXT_PUBLIC_SUPABASE_URL</code> と{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> を設定して再デプロイ
                </li>
              </ol>
              <p>詳しい手順は README を参照してください。</p>
            </div>
          )}
        </Card>

        {/* Google カレンダー連携 */}
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2.5">
            <CalendarClock className="h-5 w-5 text-cyan-500" />
            <h2 className="font-bold">Google カレンダー連携</h2>
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            <p>
              「日程調整」で確定した予定は、ワンクリックで Google カレンダーに登録できます
              （Googleの予定作成画面が開きます）。ICS ファイルのダウンロードにも対応しているため、
              Outlook など他のカレンダーにも取り込めます。
            </p>
            <p>
              組織全体での双方向同期（空き時間の自動取得など）を行う場合は、Google Cloud Console で
              OAuth クライアントを作成し、README の手順に従って設定してください。
            </p>
          </div>
        </Card>

        {/* テーマ */}
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2.5">
            <Palette className="h-5 w-5 text-cyan-500" />
            <h2 className="font-bold">テーマ</h2>
          </div>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            画面右上の月/太陽アイコンからライト・ダークモードを切り替えられます。
            設定はブラウザに保存されます。
          </p>
        </Card>

        {/* デモデータ管理 */}
        {!configured && (
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <RefreshCw className="h-5 w-5 text-cyan-500" />
              <h2 className="font-bold">デモデータの初期化</h2>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              このブラウザに保存されたデータを削除し、初期のサンプルデータに戻します。
            </p>
            <Button variant="danger" size="sm" onClick={resetDemoData} disabled={cleared}>
              <Trash2 className="h-4 w-4" />
              {cleared ? "初期化しました…" : "デモデータを初期化"}
            </Button>
          </Card>
        )}
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-cyan-100 bg-cyan-50/50 p-4 text-sm text-slate-600 dark:border-cyan-500/20 dark:bg-cyan-500/5 dark:text-slate-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" />
        <p className="leading-relaxed">
          DARE BASE LABO は Vercel + Supabase で動作する営業チーム向けオールインワンツールです。
          スケジュール・案件・名刺・ナレッジ・ロープレ練習・勉強会ログ・チャット・掲示板・日程調整を
          ひとつのワークスペースに統合します。
        </p>
      </div>
    </div>
  );
}
