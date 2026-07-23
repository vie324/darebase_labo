import type {
  CommissionRate,
  Invoice,
  InvoiceDirection,
  InvoicePayment,
  InvoiceSource,
  InvoiceStatus,
  LineGroup,
  MakerStatement,
  Partner,
  StatementLine,
} from "../types";
import { daysFromNow, toDateStr } from "../utils";

// =============================================================
// 請求・支払モジュールのデモデータ。
// ダッシュボードのトレンドが常に意味を持つよう、日付はすべて
// 「今日」からの相対（monthShift）で生成する。
// =============================================================

/** 今日から monthsOffset ヶ月ずらした月の day 日を YYYY-MM-DD で返す（月末超過は月末に丸め） */
function monthShift(monthsOffset: number, day: number): string {
  const d = new Date();
  d.setDate(1); // 31日始まりの月ずれ事故を防ぐ
  d.setMonth(d.getMonth() + monthsOffset);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toDateStr(d);
}

/** 今日から monthsOffset ヶ月ずらした月を YYYY-MM で返す */
function monthKeyShift(monthsOffset: number): string {
  return monthShift(monthsOffset, 1).slice(0, 7);
}

// ---------- 取引先マスタ ----------
export const DEMO_PARTNERS: Partner[] = [
  {
    id: "ptr-maker-1",
    name: "株式会社セールスクラウド",
    kind: "maker",
    contact_name: "西村 隆",
    email: "partner@salescloud.example.com",
    phone: "03-1111-2222",
    address: "東京都港区芝浦1-2-3",
    payment_rule: "月末締め翌月末払い",
    default_due_days: 30,
    memo: "SFAツール「セールスクラウド」の販売代理契約。主力商材。",
    is_active: true,
    created_at: daysFromNow(-420),
  },
  {
    id: "ptr-maker-2",
    name: "ジャパンテレコム株式会社",
    kind: "maker",
    contact_name: "高橋 誠",
    email: "agency@jtelecom.example.com",
    phone: "03-3333-4444",
    address: "東京都千代田区大手町2-1-1",
    payment_rule: "月末締め翌月末払い",
    default_due_days: 30,
    memo: "法人向け通信回線・モバイルの取次。",
    is_active: true,
    created_at: daysFromNow(-300),
  },
  {
    id: "ptr-maker-3",
    name: "HRパートナーズ株式会社",
    kind: "maker",
    contact_name: "小林 由紀",
    email: "biz@hrpartners.example.com",
    phone: "06-5555-6666",
    address: "大阪府大阪市北区梅田3-3-3",
    payment_rule: "月末締め翌々月末払い",
    default_due_days: 60,
    memo: "人材紹介の成果報酬。入金サイトが長い点に注意。",
    is_active: true,
    created_at: daysFromNow(-260),
  },
  {
    id: "ptr-agency-1",
    name: "株式会社ウエストセールス",
    kind: "agency",
    contact_name: "松本 和也",
    email: "info@west-sales.example.com",
    phone: "06-7777-8888",
    address: "大阪府大阪市中央区本町4-4-4",
    payment_rule: "月末締め翌月末払い",
    default_due_days: 30,
    memo: "関西エリアの主力代理店。LINEグループで請求書のやり取りあり。",
    is_active: true,
    created_at: daysFromNow(-380),
  },
  {
    id: "ptr-agency-2",
    name: "合同会社ネクストリンク",
    kind: "agency",
    contact_name: "中野 沙織",
    email: "contact@nextlink.example.com",
    phone: "052-1234-5678",
    address: "愛知県名古屋市中村区名駅5-5-5",
    payment_rule: "月末締め翌月末払い",
    default_due_days: 30,
    memo: "東海エリア担当。通信系に強い。",
    is_active: true,
    created_at: daysFromNow(-330),
  },
  {
    id: "ptr-agency-3",
    name: "株式会社セールスブリッジ",
    kind: "agency",
    contact_name: "藤田 大地",
    email: "sales@salesbridge.example.com",
    phone: "092-9876-5432",
    address: "福岡県福岡市博多区博多駅前6-6-6",
    payment_rule: "月末締め翌月末払い",
    default_due_days: 30,
    memo: "九州エリア担当。人材系は固定報酬契約。",
    is_active: true,
    created_at: daysFromNow(-210),
  },
  {
    id: "ptr-client-1",
    name: "株式会社ミライテック",
    kind: "client",
    contact_name: "山本 部長",
    email: "yamamoto@miraitech.example.com",
    phone: "03-2468-1357",
    address: "東京都新宿区西新宿7-7-7",
    payment_rule: "月末締め翌月末払い",
    default_due_days: 30,
    memo: "直販の重要顧客。コンサル契約あり。",
    is_active: true,
    created_at: daysFromNow(-350),
  },
  {
    id: "ptr-client-2",
    name: "グローバル商事株式会社",
    kind: "client",
    contact_name: "佐々木 課長",
    email: "sasaki@global-trading.example.com",
    phone: "045-1122-3344",
    address: "神奈川県横浜市西区みなとみらい8-8-8",
    payment_rule: "20日締め翌月20日払い",
    default_due_days: 45,
    memo: "紹介経由の直販顧客。",
    is_active: true,
    created_at: daysFromNow(-280),
  },
];

// ---------- 手数料率マスタ ----------
// 意図的に「ネクストリンク×HRパートナーズ」「セールスブリッジ×ジャパンテレコム」の
// 組み合わせを登録しない（明細計算の率未設定警告フローのデモ用）。
export const DEMO_COMMISSION_RATES: CommissionRate[] = [
  {
    id: "rate-a1-m1",
    agency_id: "ptr-agency-1",
    maker_id: "ptr-maker-1",
    product_name: "",
    rate_type: "percent",
    rate_percent: 60,
    fixed_fee: 0,
    effective_from: "",
    effective_to: "",
    memo: "セールスクラウド全商材の基本率",
    created_at: daysFromNow(-370),
  },
  {
    id: "rate-a1-m1-ent",
    agency_id: "ptr-agency-1",
    maker_id: "ptr-maker-1",
    product_name: "セールスクラウド Enterprise",
    rate_type: "percent",
    rate_percent: 65,
    fixed_fee: 0,
    effective_from: "",
    effective_to: "",
    memo: "Enterpriseプランのみ優遇率（商材指定は基本率より優先）",
    created_at: daysFromNow(-200),
  },
  {
    id: "rate-a1-m2",
    agency_id: "ptr-agency-1",
    maker_id: "ptr-maker-2",
    product_name: "",
    rate_type: "percent",
    rate_percent: 55,
    fixed_fee: 0,
    effective_from: "",
    effective_to: "",
    memo: "",
    created_at: daysFromNow(-290),
  },
  {
    id: "rate-a2-m1",
    agency_id: "ptr-agency-2",
    maker_id: "ptr-maker-1",
    product_name: "",
    rate_type: "percent",
    rate_percent: 58,
    fixed_fee: 0,
    effective_from: "",
    effective_to: "",
    memo: "",
    created_at: daysFromNow(-320),
  },
  {
    id: "rate-a2-m2",
    agency_id: "ptr-agency-2",
    maker_id: "ptr-maker-2",
    product_name: "",
    rate_type: "percent",
    rate_percent: 50,
    fixed_fee: 0,
    effective_from: "",
    effective_to: "",
    memo: "",
    created_at: daysFromNow(-310),
  },
  {
    id: "rate-a3-m1",
    agency_id: "ptr-agency-3",
    maker_id: "ptr-maker-1",
    product_name: "",
    rate_type: "percent",
    rate_percent: 60,
    fixed_fee: 0,
    effective_from: "",
    effective_to: "",
    memo: "",
    created_at: daysFromNow(-190),
  },
  {
    id: "rate-a3-m3",
    agency_id: "ptr-agency-3",
    maker_id: "ptr-maker-3",
    product_name: "",
    rate_type: "fixed",
    rate_percent: 0,
    fixed_fee: 30_000,
    effective_from: "",
    effective_to: "",
    memo: "人材紹介は1件あたり固定報酬",
    created_at: daysFromNow(-150),
  },
];

// ---------- メーカー明細 ----------
export const DEMO_MAKER_STATEMENTS: MakerStatement[] = [
  {
    id: "stmt-1",
    maker_id: "ptr-maker-1",
    title: `${monthKeyShift(-1)}分 販売手数料明細（セールスクラウド）`,
    statement_month: monthKeyShift(-1),
    status: "invoiced",
    total_amount: 3_100_000,
    source: "csv",
    approved_by: "佐藤 健太",
    approved_at: daysFromNow(-18),
    memo: "CSV取込→計算→承認→代理店別請求書発行まで完了。",
    created_at: daysFromNow(-22),
  },
  {
    id: "stmt-2",
    maker_id: "ptr-maker-2",
    title: `${monthKeyShift(0)}分 取次手数料明細（ジャパンテレコム）`,
    statement_month: monthKeyShift(0),
    status: "draft",
    total_amount: 1_360_000,
    source: "manual",
    approved_by: "",
    approved_at: "",
    memo: "取込直後。代理店未割当の行と率未設定の行があるので計算前に要確認。",
    created_at: daysFromNow(-2),
  },
];

// ---------- 明細行 ----------
export const DEMO_STATEMENT_LINES: StatementLine[] = [
  // --- stmt-1（先月・計算承認済み） ---
  {
    id: "sline-1-1",
    statement_id: "stmt-1",
    agency_id: "ptr-agency-1",
    product_name: "セールスクラウド Standard",
    customer_name: "株式会社ミライテック",
    amount: 800_000,
    rate_percent: 60,
    agency_amount: 480_000,
    company_amount: 320_000,
    rate_source: "master",
    memo: "",
    created_at: daysFromNow(-22),
  },
  {
    id: "sline-1-2",
    statement_id: "stmt-1",
    agency_id: "ptr-agency-1",
    product_name: "セールスクラウド Enterprise",
    customer_name: "グローバル商事株式会社",
    amount: 1_200_000,
    rate_percent: 65,
    agency_amount: 780_000,
    company_amount: 420_000,
    rate_source: "master",
    memo: "商材指定率(65%)が適用されている",
    created_at: daysFromNow(-22),
  },
  {
    id: "sline-1-3",
    statement_id: "stmt-1",
    agency_id: "ptr-agency-2",
    product_name: "セールスクラウド Standard",
    customer_name: "北都物産株式会社",
    amount: 600_000,
    rate_percent: 58,
    agency_amount: 348_000,
    company_amount: 252_000,
    rate_source: "master",
    memo: "",
    created_at: daysFromNow(-22),
  },
  {
    id: "sline-1-4",
    statement_id: "stmt-1",
    agency_id: "ptr-agency-3",
    product_name: "セールスクラウド Standard",
    customer_name: "東洋精機株式会社",
    amount: 500_000,
    rate_percent: 60,
    agency_amount: 300_000,
    company_amount: 200_000,
    rate_source: "master",
    memo: "",
    created_at: daysFromNow(-22),
  },
  // --- stmt-2（今月・未計算。警告フローのデモ） ---
  {
    id: "sline-2-1",
    statement_id: "stmt-2",
    agency_id: "ptr-agency-1",
    product_name: "光回線ビジネスプラン",
    customer_name: "株式会社ミライテック",
    amount: 450_000,
    rate_percent: null,
    agency_amount: 0,
    company_amount: 0,
    rate_source: "",
    memo: "",
    created_at: daysFromNow(-2),
  },
  {
    id: "sline-2-2",
    statement_id: "stmt-2",
    agency_id: "ptr-agency-2",
    product_name: "法人モバイル 20回線",
    customer_name: "西日本製作所株式会社",
    amount: 380_000,
    rate_percent: null,
    agency_amount: 0,
    company_amount: 0,
    rate_source: "",
    memo: "",
    created_at: daysFromNow(-2),
  },
  {
    id: "sline-2-3",
    statement_id: "stmt-2",
    agency_id: "ptr-agency-3",
    product_name: "光回線ビジネスプラン",
    customer_name: "九州機工株式会社",
    amount: 310_000,
    rate_percent: null,
    agency_amount: 0,
    company_amount: 0,
    rate_source: "",
    memo: "セールスブリッジ×ジャパンテレコムの率が未登録（計算時に警告になる）",
    created_at: daysFromNow(-2),
  },
  {
    id: "sline-2-4",
    statement_id: "stmt-2",
    agency_id: null,
    product_name: "光回線ビジネスプラン",
    customer_name: "株式会社エムズ商店",
    amount: 220_000,
    rate_percent: null,
    agency_amount: 0,
    company_amount: 0,
    rate_source: "",
    memo: "明細上の代理店名が一致せず未割当（手動で割当が必要）",
    created_at: daysFromNow(-2),
  },
];

// ---------- 請求書・消込 ----------

const PARTNER_NAMES: Record<string, string> = Object.fromEntries(
  DEMO_PARTNERS.map((p) => [p.id, p.name])
);

interface InvoiceSpec {
  id: string;
  direction: InvoiceDirection;
  partnerId: string | null;
  title: string;
  subtotal: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  source?: InvoiceSource;
  statementId?: string | null;
  invoiceNumber?: string;
  lineGroupId?: string;
  lineMessageId?: string;
  withholding?: number;
  memo?: string;
  /** 消込済みの場合の入金日（省略時は未消込） */
  paidOn?: string;
}

const invoiceSeeds: Invoice[] = [];
const paymentSeeds: InvoicePayment[] = [];

function seedInvoice(spec: InvoiceSpec) {
  const tax = Math.floor(spec.subtotal * 0.1);
  const withholding = spec.withholding ?? 0;
  const total = spec.subtotal + tax - withholding;
  const paid = spec.paidOn != null;
  const createdAt = `${spec.issueDate}T09:00:00.000Z`;
  invoiceSeeds.push({
    id: spec.id,
    direction: spec.direction,
    partner_id: spec.partnerId,
    partner_name: spec.partnerId ? (PARTNER_NAMES[spec.partnerId] ?? "") : "",
    invoice_number: spec.invoiceNumber ?? "",
    title: spec.title,
    subtotal: spec.subtotal,
    tax,
    withholding,
    total,
    issue_date: spec.issueDate,
    due_date: spec.dueDate,
    status: paid ? "paid" : spec.status,
    paid_amount: paid ? total : 0,
    paid_date: spec.paidOn ?? "",
    source: spec.source ?? "manual",
    statement_id: spec.statementId ?? null,
    line_group_id: spec.lineGroupId ?? "",
    line_message_id: spec.lineMessageId ?? "",
    file_url: "",
    file_type: "",
    ocr_text: "",
    memo: spec.memo ?? "",
    updated_at: createdAt,
    created_at: createdAt,
  });
  if (paid) {
    paymentSeeds.push({
      id: `pay-${spec.id}`,
      invoice_id: spec.id,
      amount: total,
      paid_on: spec.paidOn!,
      method: "振込",
      recorded_by: "伊藤 翔",
      memo: "",
      created_at: `${spec.paidOn}T10:00:00.000Z`,
    });
  }
}

// 過去6ヶ月の入金実績（メーカー手数料）と支払実績（代理店分配）。すべて消込済み。
// 金額は右肩上がりのトレンドになるよう設定（ダッシュボードのデモ用）。
const HISTORY: {
  m: number;
  makerRev: [string, number][];
  agencyPay: [string, number][];
  /** true: 代理店支払を同月末に消込（翌月消込だと未来日付になる直近月用） */
  paySameMonth?: boolean;
}[] = [
  {
    m: -7,
    makerRev: [["ptr-maker-1", 1_800_000]],
    agencyPay: [
      ["ptr-agency-1", 700_000],
      ["ptr-agency-2", 400_000],
    ],
  },
  {
    m: -6,
    makerRev: [["ptr-maker-1", 2_000_000]],
    agencyPay: [
      ["ptr-agency-1", 780_000],
      ["ptr-agency-2", 430_000],
    ],
  },
  {
    m: -5,
    makerRev: [
      ["ptr-maker-1", 2_100_000],
      ["ptr-maker-3", 600_000],
    ],
    agencyPay: [
      ["ptr-agency-1", 820_000],
      ["ptr-agency-2", 450_000],
      ["ptr-agency-3", 350_000],
    ],
  },
  {
    m: -4,
    makerRev: [
      ["ptr-maker-1", 2_300_000],
      ["ptr-maker-2", 900_000],
    ],
    agencyPay: [
      ["ptr-agency-1", 950_000],
      ["ptr-agency-2", 600_000],
      ["ptr-agency-3", 380_000],
    ],
  },
  {
    m: -3,
    makerRev: [
      ["ptr-maker-1", 2_500_000],
      ["ptr-maker-2", 1_100_000],
    ],
    agencyPay: [
      ["ptr-agency-1", 1_050_000],
      ["ptr-agency-2", 680_000],
      ["ptr-agency-3", 420_000],
    ],
  },
  {
    m: -2,
    makerRev: [
      ["ptr-maker-1", 2_600_000],
      ["ptr-maker-2", 1_250_000],
    ],
    agencyPay: [
      ["ptr-agency-1", 1_120_000],
      ["ptr-agency-2", 720_000],
      ["ptr-agency-3", 450_000],
    ],
  },
  {
    // 先月は代理店支払のみ（前月分の分配。先月の売上は下の個別シードで表現）
    m: -1,
    makerRev: [],
    agencyPay: [
      ["ptr-agency-1", 980_000],
      ["ptr-agency-2", 520_000],
      ["ptr-agency-3", 310_000],
    ],
    paySameMonth: true,
  },
];

for (const h of HISTORY) {
  const ym = monthKeyShift(h.m).replace("-", "");
  for (const [makerId, amount] of h.makerRev) {
    seedInvoice({
      id: `inv-r${-h.m}-${makerId.replace("ptr-", "")}`,
      direction: "receivable",
      partnerId: makerId,
      title: `${monthKeyShift(h.m)}分 販売手数料`,
      subtotal: amount,
      issueDate: monthShift(h.m, 28),
      dueDate: monthShift(h.m + 1, 28),
      status: "sent",
      invoiceNumber: `INV-${ym}-${makerId.slice(-1)}`,
      paidOn: monthShift(h.m + 1, 25),
    });
  }
  for (const [agencyId, amount] of h.agencyPay) {
    seedInvoice({
      id: `inv-p${-h.m}-${agencyId.replace("ptr-", "")}`,
      direction: "payable",
      partnerId: agencyId,
      title: `${monthKeyShift(h.m)}分 代理店手数料お支払`,
      subtotal: amount,
      issueDate: monthShift(h.m, h.paySameMonth ? 20 : 28),
      dueDate: monthShift(h.m + (h.paySameMonth ? 0 : 1), 28),
      status: "confirmed",
      invoiceNumber: `PAY-${ym}-${agencyId.slice(-1)}`,
      paidOn: monthShift(h.m + (h.paySameMonth ? 0 : 1), h.paySameMonth ? 28 : 22),
    });
  }
}

// --- 期限超過の未入金（アラートのデモ用に2件） ---
seedInvoice({
  id: "inv-overdue-1",
  direction: "receivable",
  partnerId: "ptr-maker-3",
  title: `${monthKeyShift(-2)}分 人材紹介成果報酬`,
  subtotal: 900_000,
  issueDate: monthShift(-2, 28),
  dueDate: monthShift(-1, 28),
  status: "sent",
  invoiceNumber: `INV-${monthKeyShift(-2).replace("-", "")}-3`,
  memo: "入金遅延中。先方経理に確認の連絡済み。",
});
seedInvoice({
  id: "inv-overdue-2",
  direction: "receivable",
  partnerId: "ptr-maker-2",
  title: `${monthKeyShift(-1)}分 取次手数料`,
  subtotal: 1_400_000,
  issueDate: monthShift(-1, 28),
  dueDate: monthShift(0, 10),
  status: "sent",
  invoiceNumber: `INV-${monthKeyShift(-1).replace("-", "")}-2`,
});

// --- 先月分: メーカー入金（stmt-1 の元）と代理店支払 ---
seedInvoice({
  id: "inv-r1-maker1",
  direction: "receivable",
  partnerId: "ptr-maker-1",
  title: `${monthKeyShift(-1)}分 販売手数料`,
  subtotal: 3_100_000,
  issueDate: monthShift(-1, 28),
  dueDate: monthShift(0, 28),
  status: "sent",
  invoiceNumber: `INV-${monthKeyShift(-1).replace("-", "")}-1`,
  paidOn: monthShift(0, 5),
});
// stmt-1 から生成された代理店支払（承認→発行フローの結果）
seedInvoice({
  id: "inv-p1-agency1",
  direction: "payable",
  partnerId: "ptr-agency-1",
  title: `${monthKeyShift(-1)}分 手数料お支払明細（セールスクラウド）`,
  subtotal: 1_260_000,
  issueDate: monthShift(0, 3),
  dueDate: monthShift(0, 28),
  status: "confirmed",
  source: "statement",
  statementId: "stmt-1",
  invoiceNumber: `PAY-${monthKeyShift(-1).replace("-", "")}-1`,
  paidOn: monthShift(0, 20),
});
seedInvoice({
  id: "inv-p1-agency2",
  direction: "payable",
  partnerId: "ptr-agency-2",
  title: `${monthKeyShift(-1)}分 手数料お支払明細（セールスクラウド）`,
  subtotal: 348_000,
  issueDate: monthShift(0, 3),
  dueDate: monthShift(1, 15),
  status: "confirmed",
  source: "statement",
  statementId: "stmt-1",
  invoiceNumber: `PAY-${monthKeyShift(-1).replace("-", "")}-2`,
});
seedInvoice({
  id: "inv-p1-agency3",
  direction: "payable",
  partnerId: "ptr-agency-3",
  title: `${monthKeyShift(-1)}分 手数料お支払明細（セールスクラウド）`,
  subtotal: 300_000,
  issueDate: monthShift(0, 3),
  dueDate: monthShift(0, 12),
  status: "confirmed",
  source: "statement",
  statementId: "stmt-1",
  invoiceNumber: `PAY-${monthKeyShift(-1).replace("-", "")}-3`,
  memo: "支払期日を過ぎている。振込処理を至急確認。",
});

// --- 今月分: 未来の入金予定（キャッシュフロー予測のデモ用） ---
seedInvoice({
  id: "inv-r0-maker1",
  direction: "receivable",
  partnerId: "ptr-maker-1",
  title: `${monthKeyShift(0)}分 販売手数料`,
  subtotal: 2_900_000,
  issueDate: monthShift(0, 5),
  dueDate: monthShift(1, 28),
  status: "sent",
  invoiceNumber: `INV-${monthKeyShift(0).replace("-", "")}-1`,
});
seedInvoice({
  id: "inv-r0-maker2",
  direction: "receivable",
  partnerId: "ptr-maker-2",
  title: `${monthKeyShift(0)}分 取次手数料`,
  subtotal: 1_500_000,
  issueDate: monthShift(0, 6),
  dueDate: monthShift(2, 10),
  status: "sent",
  invoiceNumber: `INV-${monthKeyShift(0).replace("-", "")}-2`,
});
seedInvoice({
  id: "inv-r0-client1",
  direction: "receivable",
  partnerId: "ptr-client-1",
  title: "営業コンサルティング費用",
  subtotal: 350_000,
  issueDate: monthShift(0, 8),
  dueDate: monthShift(1, 28),
  status: "draft",
  memo: "下書き。送付前に金額を最終確認。",
});

// --- LINE経由で受領した請求書（受領ボックスのデモ用） ---
seedInvoice({
  id: "inv-line-1",
  direction: "payable",
  partnerId: "ptr-agency-1",
  title: "LINE受信 請求書（ウエストセールス様グループ）",
  subtotal: 0,
  issueDate: toDateStr(new Date()),
  dueDate: "",
  status: "received",
  source: "line",
  lineGroupId: "Cdemo1111111111111111111111111111",
  lineMessageId: "demo-msg-0001",
  memo: "LINEグループから自動取込。内容を確認して金額・期日を登録してください。",
});

export const DEMO_INVOICES: Invoice[] = invoiceSeeds;
export const DEMO_INVOICE_PAYMENTS: InvoicePayment[] = paymentSeeds;

// ---------- LINEグループ ----------
export const DEMO_LINE_GROUPS: LineGroup[] = [
  {
    id: "lg-1",
    group_id: "Cdemo1111111111111111111111111111",
    group_name: "ウエストセールス様×DARE BASE 請求書連携",
    partner_id: "ptr-agency-1",
    status: "active",
    joined_at: daysFromNow(-60),
    memo: "岡崎+松本様+公式アカウントの三者グループ",
    created_at: daysFromNow(-60),
  },
  {
    id: "lg-2",
    group_id: "Cdemo2222222222222222222222222222",
    group_name: "ミライテック様×DARE BASE",
    partner_id: "ptr-client-1",
    status: "active",
    joined_at: daysFromNow(-45),
    memo: "",
    created_at: daysFromNow(-45),
  },
  {
    id: "lg-3",
    group_id: "Cdemo3333333333333333333333333333",
    group_name: "セールスブリッジ様 新規グループ",
    partner_id: null,
    status: "unmapped",
    joined_at: daysFromNow(-3),
    memo: "参加直後。取引先への紐付けが必要。",
    created_at: daysFromNow(-3),
  },
];
