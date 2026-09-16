// 名刺画像の前処理（ブラウザ側）。
//
// スマホで撮った名刺は4000px・数MBになることがあり、そのまま送ると
// APIの上限に当たるうえ、転送にも解析にも時間がかかる。
// 長辺1600pxのJPEGに落としてから送る（名刺の文字はこれで十分読める）。

import { IMAGE_QUALITY, MAX_IMAGE_BYTES, MAX_IMAGE_EDGE } from "@/lib/card-analysis";

export interface PreparedImage {
  /** base64（データURLのヘッダは含まない） */
  base64: string;
  mediaType: "image/jpeg";
}

/** File を <img> として読み込む */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("画像を読み込めませんでした"));
    };
    img.src = url;
  });
}

/** canvas から JPEG の base64 を取り出す（データURLのヘッダは落とす） */
function toBase64(canvas: HTMLCanvasElement, quality: number): string {
  const dataUrl = canvas.toDataURL("image/jpeg", quality);
  const comma = dataUrl.indexOf(",");
  return comma > 0 ? dataUrl.slice(comma + 1) : "";
}

/**
 * 送信用に縮小する。
 * 1回縮めても上限を超える場合は、収まるまで品質と寸法を段階的に落とす。
 */
export async function prepareCardImage(file: File): Promise<PreparedImage> {
  const img = await loadImage(file);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像を処理できませんでした");

  let scale = longEdge > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / longEdge : 1;
  let quality = IMAGE_QUALITY;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    // 縮小のたびに前回の描画が残らないよう塗り直す（JPEGは透過を持てないため白地）
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const base64 = toBase64(canvas, quality);
    if (base64 === "") throw new Error("画像を処理できませんでした");
    if (base64.length <= MAX_IMAGE_BYTES) return { base64, mediaType: "image/jpeg" };

    // まず品質、それでも収まらなければ寸法を落とす
    if (quality > 0.6) quality -= 0.15;
    else scale *= 0.8;
  }
  throw new Error("画像が大きすぎます。もう一度撮り直してください");
}
