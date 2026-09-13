"use client";

// =============================================================
// 添付ファイルの参照 → 表示用URL
//
// DB に入っているのは非公開バケット（attachments）の Storage パスなので、
// 表示のたびに署名URLを発行する。dataURL / objectURL / 旧公開URL は
// 署名不要なのでそのまま返し、デモモードと既存データも同じフックで扱える。
// =============================================================

import { useEffect, useState } from "react";
import { isStoragePath, resolveFileUrl } from "./supabase";

export interface FileUrlState {
  /** 表示に使えるURL（解決前・解決失敗は ""） */
  url: string;
  loading: boolean;
}

/** 解決済みの署名URL。どの参照に対する結果かを持たせて取り違えを防ぐ */
interface Signed {
  ref: string;
  url: string;
}

export function useFileUrl(ref: string | null | undefined): FileUrlState {
  const value = ref ?? "";
  const needsSigning = isStoragePath(value);
  const [signed, setSigned] = useState<Signed | null>(null);

  useEffect(() => {
    if (!needsSigning) return;
    let alive = true;
    resolveFileUrl(value).then((url) => {
      if (alive) setSigned({ ref: value, url });
    });
    return () => {
      alive = false;
    };
  }, [value, needsSigning]);

  // 署名が要らない値（dataURL / objectURL / 通常URL）はそのまま返す
  if (!needsSigning) return { url: value, loading: false };
  // 参照が切り替わった直後の古い署名URLは使わない
  if (signed?.ref === value) return { url: signed.url, loading: false };
  return { url: "", loading: true };
}
