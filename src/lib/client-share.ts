// =============================================================
// クライアント共有リンク（紹介元に、紹介いただいた顧客の進捗を公開する）
//
// ■ 方式
// 紹介元（銀行 / 1次代理店・2次代理店）ごとに、推測できない URL を発行し、
// ログインなしで開ける閲覧専用ページで進捗を見せる。スプレッドシートが
// 欲しい相手には、同じ内容を CSV でも渡す（ダウンロード / Google スプレッドシートの
// IMPORTDATA で自動更新）。データの正はこのシステムに1つだけ置き、
// 相手に渡るのは「公開してよい項目」の写しだけにする。
//
// ■ 公開する項目（これ以外は出さない）
//   紹介日 / 企業名 / 紹介の窓口 / 商談日 / ステータス / 進捗 / 商材 / 担当 / 更新日
// 金額・メモ・確度・先方担当者・失注理由などの社内情報は、DB 側の関数
// get_client_share（supabase/migrations/0015）が最初から返さない。
//
// ■ このファイル
// - collectShareRows … 公開する行の選び方。get_client_share の SQL と1対1
//   （デモモードは DB を通らないので、ここで同じ選び方を再現する）。
//   SQL を変えたら必ずこちらと client-share.test.ts も揃えること。
// - clientStatusOf  … 社内のステータスを、相手に見せる言葉に置き換える
// - shareCsvRows    … CSV の列（ダウンロードと自動取得で共通）
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import は constants.ts / pipeline.ts（同じく依存なし）に限定している。
// =============================================================

import { fulfillmentGroupOf } from "./pipeline.ts";
import type {
  Appointment,
  Bank,
  Branch,
  BusinessUnit,
  CalendarEvent,
  ClientShare,
  Deal,
  DealProduct,
} from "./types";

// ---------- トークン ----------

/**
 * 共有URLに入れるトークン。32バイトの乱数を URL で使える文字（base64url）にする。
 * 推測で当てられないことが唯一の鍵なので、Math.random は使わない。
 */
export function generateShareToken(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** トークンとして受け付ける形か（短すぎる値で総当たりされないよう、DB 側も同じ条件） */
export function isValidShareToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{32,128}$/.test(token);
}

// ---------- リンクの状態 ----------

export type ShareState = "active" | "expired" | "stopped";

export const SHARE_STATES: Record<ShareState, { label: string; color: string }> = {
  active: {
    label: "公開中",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  expired: {
    label: "期限切れ",
    color: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  stopped: {
    label: "停止中",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
  },
};

export function shareState(
  share: Pick<ClientShare, "is_active" | "expires_at">,
  now: Date
): ShareState {
  if (!share.is_active) return "stopped";
  if (share.expires_at && new Date(share.expires_at).getTime() < now.getTime()) return "expired";
  return "active";
}

/** 有効期限の選択肢。相手がスプレッドシートで自動取得していると、期限切れで止まる点に注意 */
export const EXPIRY_OPTIONS: { key: string; label: string; days: number | null }[] = [
  { key: "1m", label: "1ヶ月", days: 30 },
  { key: "3m", label: "3ヶ月", days: 90 },
  { key: "6m", label: "6ヶ月", days: 180 },
  { key: "1y", label: "1年", days: 365 },
  { key: "none", label: "無期限", days: null },
];

/** 期限の選択肢から有効期限（ISO）を作る。null = 無期限 */
export function expiresAtFrom(days: number | null, now: Date): string | null {
  if (days === null) return null;
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  // 期限日の終わりまで開けるようにする
  d.setHours(23, 59, 59, 0);
  return d.toISOString();
}

/** 有効期限の表示（数ヶ月先の日付なので年まで出す）。null = 無期限 */
export function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "無期限";
  const t = tokyoParts(expiresAt);
  if (!t) return "無期限";
  const [y, m, d] = t.date.split("-").map(Number);
  return `${y}/${m}/${d}`;
}

/** 公開ページの見出しの初期値 */
export function defaultShareTitle(sourceName: string, channelName?: string): string {
  const who = channelName ? `${sourceName} ${channelName}` : sourceName;
  return `${who} 様 ご紹介案件の進捗`;
}

// ---------- 公開する行 ----------

/**
 * 公開ページの1行（get_client_share が返す rows の1要素と同じ形）。
 * 社内のステータスはコードのまま持ち、見せる言葉への置き換えは clientStatusOf で行う。
 */
export interface ShareSourceRow {
  /** 紹介日 YYYY-MM-DD（アポの受付日。アポを経ない案件は登録日） */
  referred_on: string;
  company: string;
  /** 紹介の窓口（支店 / 2次代理店）の名前 */
  channel: string;
  /** 商談日時 ISO（"" = 未定） */
  meeting_at: string;
  /** アポイントのステータス（"" = アポを経ない案件） */
  appointment_status: string;
  /** 案件のステージ（"" = 未案件化） */
  deal_stage: string;
  /** 受注後フェーズ（"" = なし） */
  fulfillment_status: string;
  /** 商材名（" / " 区切り） */
  products: string;
  /** 担当営業 */
  owner: string;
  /** 最終更新 ISO */
  updated_at: string;
}

export interface ShareDataset {
  appointments: Appointment[];
  deals: Deal[];
  dealProducts: DealProduct[];
  branches: Branch[];
  events: CalendarEvent[];
}

/**
 * 日付・時刻は日本時間で切る（get_client_share も Asia/Tokyo）。
 * CSV はサーバー（UTC）でも作るため、実行環境のタイムゾーンに頼らない。
 */
const TOKYO = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function tokyoParts(iso: string): { date: string; time: string } | null {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  const parts = TOKYO.formatToParts(d);
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

/** timestamptz 相当の値の日付部分（日本時間）。YYYY-MM-DD はそのまま */
function dateOf(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  return tokyoParts(iso)?.date ?? "";
}

function laterOf(a: string, b: string | undefined): string {
  if (!b) return a;
  return new Date(b).getTime() > new Date(a).getTime() ? b : a;
}

/**
 * 公開する行を選ぶ（get_client_share の SQL と同じ条件）。
 *   1. その紹介元（と窓口）から来たアポイント。案件化していれば案件の状態も付ける
 *   2. アポを経ずに紹介元を付けて登録した案件（スケジュール・案件管理から登録したもの）
 * 並びは紹介日の新しい順、同じ日は企業名順。
 */
export function collectShareRows(
  share: Pick<ClientShare, "bank_id" | "branch_id">,
  data: ShareDataset,
  now: Date
): ShareSourceRow[] {
  const inScope = (bankId: string | null | undefined, branchId: string | null | undefined) =>
    bankId === share.bank_id && (!share.branch_id || branchId === share.branch_id);

  // 行ごとに全件を探さないよう、先に引けるようにしておく（紹介・案件が増えても重くしない）
  const channelById = new Map(data.branches.map((b) => [b.id, b.name]));
  const dealById = new Map(data.deals.map((d) => [d.id, d]));
  const linesByDeal = groupBy(data.dealProducts, (l) => l.deal_id);
  const startsByDeal = groupBy(
    data.events.filter((e) => e.deal_id),
    (e) => e.deal_id as string
  );
  const channelOf = (branchId: string | null | undefined) =>
    (branchId && channelById.get(branchId)) || "";
  const productsOf = (dealId: string | null | undefined) =>
    (dealId ? (linesByDeal.get(dealId) ?? []) : [])
      .slice()
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((l) => l.product_name)
      .join(" / ");

  const rows: ShareSourceRow[] = [];

  for (const a of data.appointments) {
    if (!inScope(a.bank_id, a.branch_id)) continue;
    const deal = a.deal_id ? dealById.get(a.deal_id) : undefined;
    rows.push({
      referred_on: a.received_at || dateOf(a.created_at),
      company: a.company_name,
      channel: channelOf(a.branch_id),
      meeting_at: a.scheduled_at,
      appointment_status: a.status,
      deal_stage: deal?.stage ?? "",
      fulfillment_status: deal?.fulfillment_status ?? "",
      products: productsOf(deal?.id),
      owner: a.assigned_name || deal?.owner_name || "",
      updated_at: laterOf(a.updated_at, deal?.updated_at),
    });
  }

  const viaAppointment = new Set(data.appointments.map((a) => a.deal_id).filter(Boolean));
  for (const d of data.deals) {
    if (!inScope(d.bank_id, d.branch_id) || viaAppointment.has(d.id)) continue;
    // 商談日は、この案件に紐づく予定のうち次に来るもの（無ければ最後のもの）
    const starts = (startsByDeal.get(d.id) ?? [])
      .map((e) => e.start_at)
      .sort((x, y) => new Date(x).getTime() - new Date(y).getTime());
    const upcoming = starts.find((s) => new Date(s).getTime() >= now.getTime());
    rows.push({
      referred_on: dateOf(d.created_at),
      company: d.company,
      channel: channelOf(d.branch_id),
      meeting_at: upcoming ?? starts[starts.length - 1] ?? "",
      appointment_status: "",
      deal_stage: d.stage,
      fulfillment_status: d.fulfillment_status ?? "",
      products: productsOf(d.id),
      owner: d.owner_name,
      updated_at: d.updated_at,
    });
  }

  return rows.sort(
    (a, b) => b.referred_on.localeCompare(a.referred_on) || a.company.localeCompare(b.company, "ja")
  );
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const list = out.get(key);
    if (list) list.push(item);
    else out.set(key, [item]);
  }
  return out;
}

// ---------- 相手に見せるステータス ----------

/**
 * 相手（紹介元）に見せるステータス。
 * 社内の「失注」「確度C」のような言葉はそのまま出さず、紹介元にとって意味のある
 * 粒度に丸める。受注後の細かいフェーズ（リース審査など）も出さない
 * （顧客の与信に関わるため。進捗は「手続き中 / 設置準備中 / 開通済み」まで）。
 */
export type ClientStatusKey =
  | "arranging"
  | "scheduled"
  | "considering"
  | "ordering"
  | "won"
  | "partnership"
  | "declined"
  | "cancelled";

export const CLIENT_STATUSES: Record<ClientStatusKey, { label: string; color: string; order: number }> = {
  arranging: {
    label: "日程調整中",
    color: "bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300",
    order: 0,
  },
  scheduled: {
    label: "商談予定",
    color: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    order: 1,
  },
  considering: {
    label: "ご検討中",
    color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    order: 2,
  },
  ordering: {
    label: "お手続き中",
    color: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
    order: 3,
  },
  won: {
    label: "ご成約",
    color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    order: 4,
  },
  partnership: {
    label: "販売協力",
    color: "bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300",
    order: 5,
  },
  declined: {
    label: "見送り",
    color: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    order: 6,
  },
  cancelled: {
    label: "キャンセル",
    color: "bg-slate-100 text-slate-500 dark:bg-slate-500/15 dark:text-slate-400",
    order: 7,
  },
};

export const CLIENT_STATUS_KEYS = (Object.keys(CLIENT_STATUSES) as ClientStatusKey[]).sort(
  (a, b) => CLIENT_STATUSES[a].order - CLIENT_STATUSES[b].order
);

/** 案件化していれば案件のステージを、していなければアポのステータスを見る */
export function clientStatusOf(
  row: Pick<ShareSourceRow, "appointment_status" | "deal_stage" | "meeting_at">
): ClientStatusKey {
  switch (row.deal_stage) {
    case "appointment":
      return "scheduled";
    case "follow_up":
      return "considering";
    case "po_wait":
      return "ordering";
    case "won":
      return "won";
    case "partnership":
      return "partnership";
    case "lost":
      return "declined";
  }
  switch (row.appointment_status) {
    case "done":
      return "considering";
    case "won":
      return "won";
    case "lost":
      return "declined";
    case "cancelled":
      return "cancelled";
    default:
      // 予定（や未知の値）は、日程が決まっていれば商談予定
      return row.meeting_at ? "scheduled" : "arranging";
  }
}

/** 成約後の進捗（相手に見せる粒度）。成約していなければ "" */
export function clientProgressOf(
  row: Pick<ShareSourceRow, "appointment_status" | "deal_stage" | "meeting_at" | "fulfillment_status">
): string {
  if (clientStatusOf(row) !== "won" || !row.fulfillment_status) return "";
  switch (fulfillmentGroupOf(row.fulfillment_status)) {
    case "install_adjust":
    case "install_wait":
      return "設置準備中";
    case "activated":
      return "開通済み";
    default:
      return "お手続き中";
  }
}

/** 公開ページで使う形（見せる言葉を付けた行） */
export interface ClientShareRow extends ShareSourceRow {
  status: ClientStatusKey;
  progress: string;
}

export function toClientRows(rows: ShareSourceRow[]): ClientShareRow[] {
  return rows.map((r) => ({ ...r, status: clientStatusOf(r), progress: clientProgressOf(r) }));
}

/** ステータスごとの件数（公開ページの上部に出す） */
export function countByStatus(rows: ClientShareRow[]): Record<ClientStatusKey, number> {
  const out = Object.fromEntries(CLIENT_STATUS_KEYS.map((k) => [k, 0])) as Record<
    ClientStatusKey,
    number
  >;
  for (const r of rows) out[r.status] += 1;
  return out;
}

// ---------- CSV ----------

/**
 * スプレッドシートで式として解釈される先頭文字を無害化する（CSV インジェクション対策）。
 * 企業名などは社内の誰でも入力できるため、相手の表計算ソフトで式が動かないようにする。
 */
export function sanitizeCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** 日時 ISO → "YYYY-MM-DD HH:mm"（日本時間）。空なら "" */
function dateTimeCell(iso: string): string {
  const t = tokyoParts(iso);
  return t ? `${t.date} ${t.time}` : "";
}

/**
 * CSV の見出しと行。ダウンロードと自動取得（/api/share/[token]/csv）で共通。
 * @param channelLabel 窓口の列名（「支店」「2次代理店」）
 */
export function shareCsvRows(
  rows: ClientShareRow[],
  channelLabel: string
): { headers: string[]; body: string[][] } {
  return {
    headers: ["紹介日", "企業名", channelLabel, "商談日", "ステータス", "進捗", "商材", "担当", "最終更新"],
    body: rows.map((r) =>
      [
        r.referred_on,
        r.company,
        r.channel,
        dateTimeCell(r.meeting_at),
        CLIENT_STATUSES[r.status].label,
        r.progress,
        r.products,
        r.owner,
        dateTimeCell(r.updated_at),
      ].map(sanitizeCell)
    ),
  };
}

// ---------- 公開ページのデータ（get_client_share の返り値） ----------

/** 公開ページ・CSV の元になるデータ（get_client_share が ok のときの中身） */
export interface SharePayload {
  title: string;
  /** 紹介元の名前 */
  source: string;
  /** 窓口で絞ったリンクのときの窓口名 */
  channel: string | null;
  /** 事業部 slug（呼び名の切り替えに使う） */
  unit: string;
  expires_at: string | null;
  generated_at: string;
  rows: ShareSourceRow[];
}

export type ShareError = "not_found" | "expired" | "unavailable";

export type ShareResult = { ok: true; data: SharePayload } | { ok: false; error: ShareError };

const text = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * get_client_share の返り値を取り込む。
 * 自前の関数だが、ネットワーク越しの値なので形を検めてから使う
 * （想定外の形は「使えない」として扱い、画面を壊さない）。
 */
export function parseSharePayload(value: unknown): ShareResult {
  if (!value || typeof value !== "object") return { ok: false, error: "unavailable" };
  const v = value as Record<string, unknown>;
  if (v.ok !== true) {
    const error: ShareError =
      v.error === "expired" ? "expired" : v.error === "not_found" ? "not_found" : "unavailable";
    return { ok: false, error };
  }
  const rows = Array.isArray(v.rows) ? v.rows : [];
  return {
    ok: true,
    data: {
      title: text(v.title),
      source: text(v.source),
      channel: typeof v.channel === "string" ? v.channel : null,
      unit: text(v.unit) || "banking",
      expires_at: typeof v.expires_at === "string" ? v.expires_at : null,
      generated_at: text(v.generated_at),
      rows: rows.map((r) => {
        const o = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        return {
          referred_on: text(o.referred_on),
          company: text(o.company),
          channel: text(o.channel),
          meeting_at: text(o.meeting_at),
          appointment_status: text(o.appointment_status),
          deal_stage: text(o.deal_stage),
          fulfillment_status: text(o.fulfillment_status),
          products: text(o.products),
          owner: text(o.owner),
          updated_at: text(o.updated_at),
        };
      }),
    },
  };
}

/** デモモードで公開ページを組み立てるのに使うテーブル一式 */
export interface DemoShareTables extends ShareDataset {
  shares: ClientShare[];
  banks: Bank[];
  units: BusinessUnit[];
}

/**
 * デモモード用：get_client_share と同じ判定・同じ形の結果を、手元のデータから作る。
 * （停止中は「無い」と同じ扱い。期限切れは期限切れと伝える）
 */
export function buildDemoSharePayload(
  token: string,
  tables: DemoShareTables,
  now: Date
): ShareResult {
  if (!isValidShareToken(token)) return { ok: false, error: "not_found" };
  const share = tables.shares.find((s) => s.token === token);
  if (!share || !share.is_active) return { ok: false, error: "not_found" };
  if (shareState(share, now) === "expired") return { ok: false, error: "expired" };
  const bank = tables.banks.find((b) => b.id === share.bank_id);
  const unit = tables.units.find((u) => u.id === bank?.business_unit_id)?.slug ?? "banking";
  const channel = share.branch_id
    ? (tables.branches.find((b) => b.id === share.branch_id)?.name ?? null)
    : null;
  return {
    ok: true,
    data: {
      title: share.title,
      source: bank?.name ?? "",
      channel,
      unit,
      expires_at: share.expires_at,
      generated_at: now.toISOString(),
      rows: collectShareRows(share, tables, now),
    },
  };
}
