// =============================================================
// 名刺 OCR — tesseract.js による文字認識と、認識テキストの解析ロジック。
// UI に依存しない純粋ロジックのみを置く（テスト・再利用しやすいように）。
// tesseract.js の型には依存せず、必要最小限の独自 interface で扱う。
// =============================================================

import type { Contact } from "@/lib/types";

// ---------- tesseract.js の最小型定義 ----------
// （data.text: string だけ使えればよいので、内部型には踏み込まない）
interface OcrLogMessage {
  status: string;
  progress: number;
}

interface OcrRecognizeResult {
  data: { text: string };
}

interface TesseractLike {
  recognize(
    image: File | Blob,
    langs: string,
    options: { logger: (m: OcrLogMessage) => void }
  ): Promise<OcrRecognizeResult>;
}

/**
 * 名刺画像を OCR してテキストを返す。
 * - 言語データ/ワーカーは CDN から取得するためオンライン環境が必要。
 * - onProgress には認識フェーズの進捗 (0-1) を通知する。
 * - 取得・認識に失敗した場合は例外を投げる。
 */
export async function runOcr(
  file: File,
  onProgress?: (p: number) => void
): Promise<string> {
  // クライアントでのみ動的 import（言語データが大きいため遅延ロード）
  const mod = (await import("tesseract.js")) as unknown as {
    default: TesseractLike;
  };
  const Tesseract = mod.default;

  const result = await Tesseract.recognize(file, "jpn+eng", {
    logger: (m: OcrLogMessage) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(m.progress);
      }
    },
  });
  return result.data.text;
}

// ---------- 認識テキストの解析 ----------

/** parseBusinessCard が推定して埋めるフィールド（すべて任意） */
export type ParsedCardFields = Partial<
  Pick<
    Contact,
    | "name"
    | "company"
    | "department"
    | "title"
    | "email"
    | "phone"
    | "mobile"
    | "address"
    | "website"
  >
>;

// 会社を示す語
const COMPANY_RE =
  /株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|社団法人|財団法人|[（(]株[)）]|[（(]有[)）]|Inc\.?|Corp(?:oration)?\.?|Co\.,?\s*Ltd\.?|Co\.,|Company|Ltd\.?|LLC|LLP|K\.K\./i;

// 役職を示す語（長いものを先に並べて優先的にマッチさせる）
const TITLE_RE =
  /(代表取締役社長|代表取締役会長|代表取締役|取締役社長|取締役会長|執行役員|代表社員|代表理事|理事長|会長|社長|副社長|専務|常務|本部長|事業部長|部長|次長|課長|係長|主任|主査|主幹|室長|支店長|店長|所長|統括|リーダー|マネージャー|マネジャー|ディレクター|プロデューサー|チーフ|CEO|COO|CTO|CFO|CMO|President|Vice President|General Manager|Manager|Director|Chief|Officer|Leader|Founder)/i;

// 部署を示す語
const DEPT_RE =
  /(事業本部|本部|事業部|統括部|営業部|開発部|技術部|製造部|管理部|総務部|人事部|経理部|財務部|企画部|広報部|マーケティング部|システム部|情報システム部|[^\s　]{1,10}部門|[^\s　]{0,10}部(?:\s|$)|[^\s　]{0,10}課|[^\s　]{0,8}室|[^\s　]{0,8}グループ|[^\s　]{0,8}チーム|[^\s　]{0,8}センター|ディビジョン|Division|Department)/;

// 郵便番号・都道府県
const POSTAL_RE = /〒\s*\d{3}-?\d{4}/;
const PREF_RE =
  /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県)/;

// 日本語氏名（姓 空白 名）— 漢字/かなの 1-4 文字＋空白＋1-5 文字
const NAME_RE =
  /^[一-鿿぀-ゟ゠-ヿ々〆ヶ]{1,4}[\s　]+[一-鿿぀-ゟ゠-ヿ々〆ヶ]{1,5}$/;

// 電話番号らしいトークン（数字・区切りの並び）
const PHONE_TOKEN_RE = /(?:\+?\d[\d\-().\s]{7,}\d)/g;
// メールアドレス
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;

/** +81 を 0 に正規化した数字のみの文字列にする */
function digitsOf(raw: string): string {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+81")) d = "0" + d.slice(3);
  return d.replace(/\+/g, "");
}

/** 日本の固定/携帯番号として妥当か（10-11 桁で 0 始まり） */
function isJpPhone(digits: string): boolean {
  return /^0\d{9,10}$/.test(digits);
}

/** 070/080/090 始まりの携帯番号か */
function isMobileNumber(digits: string): boolean {
  return /^0[789]0\d{8}$/.test(digits);
}

/** マッチした電話番号トークンの前後の不要文字を除去（内部の書式は保持） */
function trimPhone(raw: string): string {
  return raw.replace(/^[^\d+]+/, "").replace(/[^\d)]+$/, "").trim();
}

/** URL を https:// 付きに正規化し、末尾の句読点等を除去 */
function normalizeUrl(raw: string): string {
  const cleaned = raw.replace(/[.,;、。）)】」』>]+$/, "").trim();
  return /^https?:\/\//i.test(cleaned) ? cleaned : "https://" + cleaned;
}

/**
 * OCR 認識テキストから連絡先フィールドを推定する。
 * 正規表現とヒューリスティックによる推定のため、確実でない項目は空のまま返す。
 * 返り値は値が得られたフィールドのみを含む部分オブジェクト。
 */
export function parseBusinessCard(text: string): ParsedCardFields {
  const result: ParsedCardFields = {};
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const full = lines.join("\n");

  // 名前推定の際に「使用済み」とみなす行を記録する
  const consumed = new Set<string>();

  // ---- メールアドレス ----
  const emailMatch = full.match(EMAIL_RE);
  const email = emailMatch ? emailMatch[0] : "";
  if (email) {
    result.email = email;
    const line = lines.find((l) => l.includes(email));
    if (line) consumed.add(line);
  }

  // ---- Web サイト ----
  let website = "";
  const urlMatch = full.match(/https?:\/\/[^\s<>"）)】」』]+/i);
  if (urlMatch) {
    website = normalizeUrl(urlMatch[0]);
  } else {
    const wwwMatch = full.match(/\bwww\.[A-Za-z0-9.\-]+\.[A-Za-z]{2,}[^\s<>"）)】」』]*/i);
    if (wwwMatch) {
      website = normalizeUrl(wwwMatch[0]);
    } else {
      // 素のドメイン（メールと同じドメインは避ける）
      const emailDomain = (email.split("@")[1] ?? "").toLowerCase();
      const domains =
        full.match(
          /\b[A-Za-z0-9\-]+\.(?:co\.jp|or\.jp|ne\.jp|com|net|org|jp|io|dev|app|biz|info|co)\b/gi
        ) ?? [];
      const picked = domains.find((d) => d.toLowerCase() !== emailDomain);
      if (picked) website = normalizeUrl(picked);
    }
  }
  if (website) {
    result.website = website;
    const bare = website.replace(/^https?:\/\//i, "");
    const line = lines.find((l) => l.includes(bare) || l.includes(website));
    if (line) consumed.add(line);
  }

  // ---- 電話 / 携帯 ----
  let phone = "";
  let mobile = "";
  for (const rawLine of lines) {
    // FAX 部分は電話として拾わない
    const faxIdx = rawLine.search(/fax|ＦＡＸ|ファ(?:ッ)?ク/i);
    if (faxIdx === 0) continue; // FAX 専用行
    const line = faxIdx > 0 ? rawLine.slice(0, faxIdx) : rawLine;
    const wantsMobile = /携帯|モバイル|mobile|cell|ケータイ|ｹｰﾀｲ/i.test(line);

    const tokens = line.match(PHONE_TOKEN_RE);
    if (!tokens) continue;
    let hit = false;
    for (const t of tokens) {
      const digits = digitsOf(t);
      if (!isJpPhone(digits)) continue;
      hit = true;
      const formatted = trimPhone(t);
      if (isMobileNumber(digits) || wantsMobile) {
        if (!mobile) mobile = formatted;
      } else if (!phone) {
        phone = formatted;
      }
    }
    if (hit) consumed.add(rawLine);
  }
  if (phone) result.phone = phone;
  if (mobile) result.mobile = mobile;

  // ---- 会社名 ----
  const companyLine = lines.find((l) => COMPANY_RE.test(l));
  if (companyLine) {
    result.company = companyLine;
    consumed.add(companyLine);
  }

  // ---- 役職 ----
  let titleValue = "";
  for (const l of lines) {
    if (consumed.has(l)) continue;
    const m = l.match(TITLE_RE);
    if (m) {
      titleValue = m[0];
      result.title = titleValue;
      consumed.add(l);
      break;
    }
  }

  // ---- 部署 ----
  const deptLine = lines.find(
    (l) => !consumed.has(l) && DEPT_RE.test(l) && !COMPANY_RE.test(l)
  );
  if (deptLine) {
    let dept = deptLine;
    if (titleValue) dept = dept.replace(titleValue, "").trim();
    dept = dept.replace(/[・:：\s　]+$/, "").trim();
    if (dept && DEPT_RE.test(dept)) {
      result.department = dept;
      consumed.add(deptLine);
    }
  }

  // ---- 住所 ----
  const addrIdx = lines.findIndex((l) => POSTAL_RE.test(l) || PREF_RE.test(l));
  if (addrIdx >= 0) {
    let address = lines[addrIdx];
    // 〒 のみの行なら、次行（実際の住所）も連結する
    if (POSTAL_RE.test(address) && !PREF_RE.test(address) && lines[addrIdx + 1]) {
      address = `${address} ${lines[addrIdx + 1]}`.trim();
      consumed.add(lines[addrIdx + 1]);
    }
    result.address = address;
    consumed.add(lines[addrIdx]);
  }

  // ---- 氏名 ----
  const nameCandidates = lines.filter(
    (l) =>
      !consumed.has(l) &&
      !EMAIL_RE.test(l) &&
      !/https?:\/\/|www\./i.test(l) &&
      !/\d{3,}/.test(l) &&
      !COMPANY_RE.test(l)
  );
  // まず「姓 空白 名」パターンを優先
  let name = nameCandidates.find((l) => NAME_RE.test(l));
  if (!name) {
    // 次善: 日本語のみで短い行を名前とみなす
    name = nameCandidates.find(
      (l) =>
        /^[一-鿿぀-ゟ゠-ヿ々〆ヶ\s　]+$/.test(l) &&
        l.replace(/[\s　]/g, "").length >= 2 &&
        l.replace(/[\s　]/g, "").length <= 8
    );
  }
  if (name) result.name = name;

  return result;
}
