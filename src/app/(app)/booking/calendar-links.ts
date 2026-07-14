// =============================================================
// 日程調整 — 外部カレンダー連携ヘルパー
// 確定した候補日時から Google カレンダー登録URL / ICS(VCALENDAR) を生成する。
// 日時はすべて UTC(YYYYMMDDTHHmmSSZ) に変換して受け渡す。
// =============================================================

export interface CalendarEventDraft {
  title: string;
  start: string; // ISO
  end: string; // ISO
  description?: string;
  location?: string;
}

/**
 * ISO文字列 → Google/ICS 用の UTC タイムスタンプ "YYYYMMDDTHHmmSSZ"
 * 例: "2026-07-15T01:00:00.000Z" → "20260715T010000Z"
 */
export function toUtcStamp(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * Google カレンダーの「予定作成」テンプレート URL を組み立てる。
 * https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=開始/終了&details=...&location=...
 */
export function buildGoogleCalendarUrl(ev: CalendarEventDraft): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${toUtcStamp(ev.start)}/${toUtcStamp(ev.end)}`,
    details: ev.description ?? "",
    location: ev.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Google カレンダーの予定作成画面を新規タブで開く */
export function openGoogleCalendar(ev: CalendarEventDraft): void {
  window.open(buildGoogleCalendarUrl(ev), "_blank", "noopener,noreferrer");
}

/** ICS(テキスト)内で使う特殊文字のエスケープ */
function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** 標準的な VCALENDAR/VEVENT テキストを生成（Outlook 等向け・DTSTART/DTEND は UTC） */
export function buildIcs(ev: CalendarEventDraft): string {
  const stamp = toUtcStamp(new Date().toISOString());
  const uid = `${stamp}-${Math.random().toString(36).slice(2, 10)}@darebase`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//DARE BASE LABO//Booking//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toUtcStamp(ev.start)}`,
    `DTEND:${toUtcStamp(ev.end)}`,
    `SUMMARY:${escapeIcs(ev.title)}`,
    `DESCRIPTION:${escapeIcs(ev.description ?? "")}`,
    `LOCATION:${escapeIcs(ev.location ?? "")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n");
}

/** ICS ファイルをブラウザからダウンロードさせる */
export function downloadIcs(ev: CalendarEventDraft): void {
  const blob = new Blob([buildIcs(ev)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = (ev.title || "event").replace(/[\\/:*?"<>|]/g, "_");
  a.href = url;
  a.download = `${safeName}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
