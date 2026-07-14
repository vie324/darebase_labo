// 共通ユーティリティ

/** classNames を条件付きで結合する */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** 金額を「¥1,200,000」形式に */
export function formatYen(amount: number): string {
  return "¥" + amount.toLocaleString("ja-JP");
}

/** 金額を「120万円」など読みやすい省略形に */
export function formatYenShort(amount: number): string {
  if (amount >= 100_000_000) return `${(amount / 100_000_000).toFixed(1).replace(/\.0$/, "")}億円`;
  if (amount >= 10_000) return `${Math.round(amount / 10_000).toLocaleString("ja-JP")}万円`;
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** ISO文字列 → "7/14(火) 10:00" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w}) ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** ISO or YYYY-MM-DD → "7/14(火)" */
export function formatDate(iso: string): string {
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "";
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}(${w})`;
}

/** ISO → "10:00" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 相対時間 "3分前" "2時間前" "3日前" */
export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}日前`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}ヶ月前`;
  return `${Math.floor(month / 12)}年前`;
}

/** 秒数 → "3:05" / "1:02:03" */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** 今日の日付を YYYY-MM-DD で */
export function todayStr(): string {
  return toDateStr(new Date());
}

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 今日から n 日後の hour:min を ISO で返す（デモデータ用） */
export function daysFromNow(days: number, hour = 9, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** 今日から n 日後を YYYY-MM-DD で（デモデータ用） */
export function dateFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ごく簡易な markdown → HTML（見出し/太字/リスト/リンク/コード/引用のみ）。
 *  ユーザー入力は先にエスケープするためXSS安全。 */
export function renderMarkdown(md: string): string {
  const esc = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const blocks = esc.split(/\n{2,}/).map((block) => {
    const b = block.trim();
    if (!b) return "";
    // コードブロック
    if (b.startsWith("```")) {
      const code = b.replace(/^```[a-z]*\n?/, "").replace(/```$/, "");
      return `<pre><code>${code}</code></pre>`;
    }
    // 見出し
    if (/^### /.test(b)) return `<h3>${inline(b.slice(4))}</h3>`;
    if (/^## /.test(b)) return `<h2>${inline(b.slice(3))}</h2>`;
    if (/^# /.test(b)) return `<h1>${inline(b.slice(2))}</h1>`;
    // 引用
    if (/^&gt; /.test(b)) {
      return `<blockquote>${inline(b.replace(/^&gt; /gm, "").replace(/\n/g, "<br/>"))}</blockquote>`;
    }
    // リスト
    if (/^[-*] /m.test(b)) {
      const items = b
        .split("\n")
        .filter((l) => /^[-*] /.test(l))
        .map((l) => `<li>${inline(l.slice(2))}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }
    if (/^\d+\. /m.test(b)) {
      const items = b
        .split("\n")
        .filter((l) => /^\d+\. /.test(l))
        .map((l) => `<li>${inline(l.replace(/^\d+\. /, ""))}</li>`)
        .join("");
      return `<ol>${items}</ol>`;
    }
    return `<p>${inline(b).replace(/\n/g, "<br/>")}</p>`;
  });

  function inline(s: string): string {
    return s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(
        /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
  }

  return blocks.join("\n");
}
