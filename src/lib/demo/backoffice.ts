// バックオフィス（勤怠・経費・人事評価）のデモシード。
// 「今月ぶん」を実行日から逆算して作るので、いつ開いても表が埋まって見える。

import type { AttendanceRecord, Evaluation, Expense } from "../types";
import { blankItems, type EvaluationItem } from "../evaluation";
import { daysFromNow, dateFromNow, toDateStr } from "../utils";

/** 実行日の当月ぶんの平日を作る（土日は行を作らない＝休日扱い） */
function weekdaysThisMonth(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= Math.min(last, now.getDate()); d += 1) {
    const date = new Date(year, month, d);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;
    days.push(toDateStr(date));
  }
  return days;
}

/** 見た目が単調にならないよう、日ごとに少しずつ違う打刻にする */
const PATTERNS: { kind: string; start: string; end: string; brk: number }[] = [
  { kind: "office", start: "09:00", end: "18:00", brk: 60 },
  { kind: "field", start: "08:30", end: "19:15", brk: 45 },
  { kind: "office", start: "09:00", end: "20:30", brk: 60 },
  { kind: "remote", start: "09:15", end: "18:00", brk: 60 },
  { kind: "field", start: "08:45", end: "18:30", brk: 60 },
];

function attendanceFor(
  ownerId: string,
  ownerName: string,
  offset: number
): AttendanceRecord[] {
  return weekdaysThisMonth().map((date, i) => {
    const p = PATTERNS[(i + offset) % PATTERNS.length];
    // 月に1日だけ有給を入れて、区分の違いが見えるようにする
    const isLeave = i === 6 && offset === 0;
    return {
      id: `att-${ownerId}-${date}`,
      owner_id: ownerId,
      owner_name: ownerName,
      work_date: date,
      kind: isLeave ? "paid_leave" : p.kind,
      start_at: isLeave ? "" : p.start,
      end_at: isLeave ? "" : p.end,
      break_minutes: isLeave ? 0 : p.brk,
      note: isLeave ? "私用のため" : "",
      updated_at: `${date}T19:00:00.000Z`,
      created_at: `${date}T09:00:00.000Z`,
    };
  });
}

export const DEMO_ATTENDANCE: AttendanceRecord[] = [
  ...attendanceFor("member-tanaka", "田中 美咲", 0),
  ...attendanceFor("member-ito", "伊藤 翔", 2),
  ...attendanceFor("member-suzuki", "鈴木 大輔", 3),
];

export const DEMO_EXPENSES: Expense[] = [
  {
    id: "exp-1",
    owner_id: "member-tanaka",
    owner_name: "田中 美咲",
    spent_on: dateFromNow(-3),
    category: "transport",
    amount: 3240,
    purpose: "みらい銀行 中央支店 同行訪問の交通費",
    counterparty: "",
    payment_method: "self",
    receipt_file: "attachments/demo-receipt-1.pdf",
    status: "submitted",
    submitted_at: daysFromNow(-2, 9, 30),
    approver_name: "",
    approved_at: "",
    reject_reason: "",
    paid_on: "",
    deal_id: null,
    note: "",
    updated_at: daysFromNow(-2, 9, 30),
    created_at: daysFromNow(-3, 19, 0),
  },
  {
    id: "exp-2",
    owner_id: "member-ito",
    owner_name: "伊藤 翔",
    spent_on: dateFromNow(-6),
    category: "entertainment",
    amount: 18400,
    purpose: "アオバ企画 役員との会食（受注後の運用打ち合わせ）",
    counterparty: "株式会社アオバ企画 佐野様・林様",
    payment_method: "corporate",
    receipt_file: "attachments/demo-receipt-2.pdf",
    status: "approved",
    submitted_at: daysFromNow(-5, 10, 0),
    approver_name: "山田 花子",
    approved_at: daysFromNow(-4, 14, 0),
    reject_reason: "",
    paid_on: "",
    deal_id: "deal-6",
    note: "",
    updated_at: daysFromNow(-4, 14, 0),
    created_at: daysFromNow(-6, 21, 0),
  },
  {
    id: "exp-3",
    owner_id: "member-suzuki",
    owner_name: "鈴木 大輔",
    spent_on: dateFromNow(-12),
    category: "supplies",
    amount: 5980,
    purpose: "名刺スキャナの用紙・クリーニングキット",
    counterparty: "",
    payment_method: "self",
    receipt_file: "attachments/demo-receipt-3.pdf",
    status: "paid",
    submitted_at: daysFromNow(-11, 9, 0),
    approver_name: "山田 花子",
    approved_at: daysFromNow(-10, 11, 0),
    reject_reason: "",
    paid_on: dateFromNow(-5),
    deal_id: null,
    note: "",
    updated_at: daysFromNow(-5, 10, 0),
    created_at: daysFromNow(-12, 18, 0),
  },
  {
    id: "exp-4",
    owner_id: "member-tanaka",
    owner_name: "田中 美咲",
    spent_on: dateFromNow(-9),
    category: "meeting",
    amount: 2800,
    purpose: "打ち合わせ時のコーヒー代",
    counterparty: "",
    payment_method: "self",
    receipt_file: "attachments/demo-receipt-4.pdf",
    status: "rejected",
    submitted_at: daysFromNow(-8, 9, 0),
    approver_name: "山田 花子",
    approved_at: "",
    reject_reason: "会議費は相手先の記載が必要です。どちらとの打ち合わせか追記してください。",
    paid_on: "",
    deal_id: null,
    note: "",
    updated_at: daysFromNow(-7, 16, 0),
    created_at: daysFromNow(-9, 20, 0),
  },
];

/** 評価シートに点数を入れる（key で引いて上書き） */
function withScores(
  scores: Record<string, { self?: number; reviewer?: number; note?: string }>
): EvaluationItem[] {
  return blankItems().map((item) => {
    const s = scores[item.key];
    if (!s) return item;
    return {
      ...item,
      self_score: s.self ?? null,
      reviewer_score: s.reviewer ?? null,
      reviewer_note: s.note ?? "",
    };
  });
}

const PERIOD = `${new Date().getFullYear()}-H1`;

export const DEMO_EVALUATIONS: Evaluation[] = [
  {
    id: "eval-1",
    target_id: "member-tanaka",
    target_name: "田中 美咲",
    period: PERIOD,
    status: "review",
    items: withScores({
      result: { self: 4, reviewer: 4, note: "目標比112%。単価の高い案件を自分で取りに行けている。" },
      process: { self: 5, reviewer: 3, note: "訪問量は十分。商談ログの記録が後追いになりがち。" },
      bank: { self: 4, reviewer: 5, note: "中央支店の紹介が前期比で倍。支店長との関係づくりが効いている。" },
      team: { self: 3, reviewer: 4, note: "ロープレの相手を進んで引き受けている。" },
      compliance: { self: 4, reviewer: 4 },
    }),
    self_comment:
      "紹介の獲得は狙いどおり伸ばせました。記録を後回しにしてしまう点は、訪問当日に音声を残す運用に変えて改善します。",
    reviewer_name: "佐藤 健太",
    reviewer_comment:
      "成果・紹介ともに期待を超えています。記録の遅れだけが後工程に効いているので、そこを仕組みで解消できれば次の期はA以上が見込めます。",
    total_score: 0, // 画面側で items から再計算して表示する
    finalized_at: "",
    updated_at: daysFromNow(-4, 18, 0),
    created_at: daysFromNow(-20, 10, 0),
  },
  {
    id: "eval-2",
    target_id: "member-ito",
    target_name: "伊藤 翔",
    period: PERIOD,
    status: "self",
    items: blankItems(),
    self_comment: "",
    reviewer_name: "佐藤 健太",
    reviewer_comment: "",
    total_score: 0,
    finalized_at: "",
    updated_at: daysFromNow(-6, 9, 0),
    created_at: daysFromNow(-6, 9, 0),
  },
  {
    id: "eval-3",
    target_id: "member-suzuki",
    target_name: "鈴木 大輔",
    period: PERIOD,
    status: "draft",
    items: blankItems(),
    self_comment: "",
    reviewer_name: "",
    reviewer_comment: "",
    total_score: 0,
    finalized_at: "",
    updated_at: daysFromNow(-6, 9, 0),
    created_at: daysFromNow(-6, 9, 0),
  },
];
