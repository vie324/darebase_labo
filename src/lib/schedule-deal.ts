// =============================================================
// スケジュールからの案件登録（UI非依存の純粋ロジック・テスト付き）
//
// 予定の入力画面で「案件も登録する」にチェックすると、その場で案件管理に
// 「商談予定」の案件が1件でき、予定は events.deal_id でその案件に紐づく。
// 案件の修正は案件管理で行う（予定の画面からはリンクで飛ぶだけ）。
//
// ここに置くのは、入力の手間を減らすための初期値と、二重登録を防ぐための
// 判定だけ。保存そのものは画面（schedule/page.tsx）が行う。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import を持たない（型のみ）。
// =============================================================

import type { Appointment, CalendarEvent } from "./types";

/** 予定のタイトルの末尾によく付く語（会社名の推定で落とす） */
const TITLE_SUFFIX =
  /[\s　]*(?:様|御中)?[\s　]*(?:初回|定例|最終)?(?:訪問商談|訪問|商談|打ち合わせ|打合せ|ミーティング|MTG|面談|アポ|提案|デモ|ご挨拶|挨拶)(?:[\s　].*)?$/;

/**
 * 予定のタイトルから相手先の会社名を推定する（入力欄の初期値用）。
 * 「株式会社ミライテック 訪問商談」「【商談】ミライテック様」→ 会社名
 * 推定できないときはタイトルの先頭の語を返す。どちらにしても画面で直せる。
 */
export function guessCompany(title: string): string {
  // 先頭の【商談】[訪問] のような見出しは外す
  const t = title.trim().replace(/^[【\[［(（][^】\]］)）]*[】\]］)）][\s　]*/, "");
  const stripped = t.replace(TITLE_SUFFIX, "").trim();
  // タイトルが「訪問商談」だけ、のように会社名が無ければ空欄のまま
  if (!stripped) return "";
  // 残りに空白があれば先頭の語（「グローバル商事 見積提出期限」など）
  const first = stripped.split(/[\s　]+/)[0] ?? "";
  return first.replace(/(?:様|御中)$/, "");
}

/** 予定の日付から n 日後（完了予定日の初期値）。YYYY-MM-DD（ローカル日付） */
export function defaultExpectedClose(startIso: string, days = 30): string {
  const d = new Date(startIso);
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${next.getFullYear()}-${p(next.getMonth() + 1)}-${p(next.getDate())}`;
}

/** 案件名を空欄にしたときの名前。商材があれば「会社名 商材」（例: 株式会社X DDS・AI） */
export function scheduleDealName(company: string, productNames: string[]): string {
  const c = company.trim();
  return productNames.length > 0 ? `${c} ${productNames.join("・")}` : c;
}

/**
 * この予定を作ったアポイント（紹介アポを登録すると予定が自動でできる）。
 * アポから来た予定で案件を登録するときは、アポの紹介元を引き継ぎ、
 * アポの側にも案件を紐づける（アポ画面の「案件化する」と二重にならないように）。
 */
export function sourceAppointmentOf(
  event: Pick<CalendarEvent, "id">,
  appointments: Appointment[]
): Appointment | null {
  return appointments.find((a) => a.event_id === event.id) ?? null;
}

/**
 * 予定に紐づく案件の id。
 * 予定に直接付いていればそれを、無ければ予定を作ったアポが案件化済みならその案件を返す
 * （0015 より前に案件化したアポの予定は events.deal_id を持たないため）。
 */
export function linkedDealIdOf(
  event: Pick<CalendarEvent, "id" | "deal_id">,
  appointments: Appointment[]
): string | null {
  return event.deal_id || sourceAppointmentOf(event, appointments)?.deal_id || null;
}

/**
 * 同じ会社の進行中の案件（二重登録の注意書き用）。
 * 空白の有無だけ違う会社名は同じとみなす。
 */
export function openDealsOfCompany<T extends { company: string; stage: string }>(
  deals: T[],
  company: string,
  isOpen: (stage: string) => boolean
): T[] {
  const norm = (s: string) => s.replace(/[\s　]/g, "");
  const key = norm(company);
  if (!key) return [];
  return deals.filter((d) => norm(d.company) === key && isOpen(d.stage));
}
