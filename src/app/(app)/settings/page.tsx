"use client";

import { useEffect, useState } from "react";
import {
  CalendarClock,
  Database,
  Info,
  MessageCircle,
  Palette,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useCollection } from "@/lib/use-collection";
import { useAccess } from "@/lib/use-access";
import { Avatar, Badge, Button, Card, PageHeader, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { fetchLineStatus } from "../billing/line-client";

export default function SettingsPage() {
  const configured = isSupabaseConfigured();
  const [cleared, setCleared] = useState(false);
  const { isExecutive } = useAccess();
  const profiles = useCollection("profiles");
  const { toast } = useToast();
  const [lineConfigured, setLineConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    if (!configured) return;
    let alive = true;
    fetchLineStatus().then((s) => {
      if (alive) setLineConfigured(s.configured);
    });
    return () => {
      alive = false;
    };
  }, [configured]);

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

        {/* LINE公式アカウント連携 */}
        <Card className="p-6">
          <div className="mb-3 flex items-center gap-2.5">
            <MessageCircle className="h-5 w-5 text-cyan-500" />
            <h2 className="font-bold">LINE公式アカウント連携</h2>
            {!configured ? (
              <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                デモモード
              </Badge>
            ) : lineConfigured === null ? (
              <Badge>確認中…</Badge>
            ) : lineConfigured ? (
              <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                設定済み
              </Badge>
            ) : (
              <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                未設定
              </Badge>
            )}
          </div>
          <div className="space-y-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            <p>
              公式アカウントを三者グループ（担当者＋クライアント＋公式アカウント）に招待すると、
              グループに届いた請求書（画像・PDF）が「請求・支払 &gt; 受領ボックス」へ自動で取り込まれます。
              アプリからのLINE送付にも対応します。
            </p>
            {configured && !lineConfigured && lineConfigured !== null && (
              <ol className="list-decimal space-y-1.5 pl-5">
                <li>LINE Developers で Messaging API チャネルを作成し、チャネルアクセストークンを発行</li>
                <li>
                  サーバー環境変数{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">LINE_CHANNEL_SECRET</code> /{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">LINE_CHANNEL_ACCESS_TOKEN</code> /{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
                  を設定して再デプロイ
                </li>
                <li>
                  Webhook URL に{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                    https://&lt;ドメイン&gt;/api/line/webhook
                  </code>{" "}
                  を設定し「Webhookの利用」をON
                </li>
                <li>応答メッセージ・あいさつメッセージをOFF、「グループトークへの参加を許可」をON</li>
                <li>公式アカウントを各グループへ招待し、「請求・支払 &gt; マスタ」で取引先に紐付け</li>
              </ol>
            )}
            <p>詳しい手順は README の「LINE連携」を参照してください。</p>
          </div>
        </Card>

        {/* 権限管理（経営層のみ） */}
        {isExecutive && (
          <Card className="p-6">
            <div className="mb-3 flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-cyan-500" />
              <h2 className="font-bold">権限管理</h2>
              <Badge className="bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                経営層のみ
              </Badge>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              「経営層」に設定したメンバーだけが経営ダッシュボードとこの権限管理を利用できます。
              ※画面上の区分であり、データベースレベルの権限分離ではありません。
            </p>
            <div className="space-y-2">
              {profiles.items.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-slate-400">{p.role}</p>
                  </div>
                  <Select
                    value={p.access_level === "executive" ? "executive" : "member"}
                    onChange={async (e) => {
                      await profiles.update(p.id, {
                        access_level: e.target.value as "executive" | "member",
                      });
                      toast(
                        `${p.name}さんを${e.target.value === "executive" ? "経営層" : "メンバー"}に変更しました`,
                        "success"
                      );
                    }}
                    className="h-9 w-32 py-1 text-xs"
                  >
                    <option value="member">メンバー</option>
                    <option value="executive">経営層</option>
                  </Select>
                </div>
              ))}
            </div>
          </Card>
        )}

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
          スケジュール・案件・名刺・ナレッジ・ロープレ練習・勉強会ログ・チャット・掲示板・日程調整・
          請求管理・経営ダッシュボードをひとつのワークスペースに統合します。
        </p>
      </div>
    </div>
  );
}
