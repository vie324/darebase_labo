// =============================================================
// CSV/TSV の共通ユーティリティ（UI非依存）
//
// もとは請求モジュール内にあった解析処理を、銀行・支店マスタの取込でも
// 使うため lib へ移した。billing/statement-import.ts はここを再エクスポート
// しているので、既存の呼び出し側は変更不要。
// =============================================================

/** 区切りテキストを行×列に分解する（カンマ/タブ対応・簡易クオート処理） */
export function parseDelimited(text: string): string[][] {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  // タブが含まれていればTSV、なければCSVとして扱う
  const delimiter = lines.some((l) => l.includes("\t")) ? "\t" : ",";
  return lines.map((line) => splitLine(line, delimiter));
}

function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** CSVセルのエスケープ（区切り・改行・引用符を含む場合のみ引用する） */
export function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 行データを BOM 付き UTF-8 の CSV 文字列に変換（Excel でそのまま開ける） */
export function toCsv(headers: string[], rows: string[][]): string {
  const body = rows.map((r) => r.map(escapeCsv).join(","));
  return "\uFEFF" + [headers.map(escapeCsv).join(","), ...body].join("\r\n");
}

/** ブラウザでCSVをダウンロードさせる */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
