"use client";

// Supabase クライアント。
// 環境変数が未設定の場合はデモモード（localStorage永続化）で全機能が動作する。

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let client: SupabaseClient | null = null;

/** 設定済みの場合のみクライアントを返す。デモモードでは null。 */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createBrowserClient(url!, anonKey!);
  }
  return client;
}

/**
 * 添付ファイル（名刺画像・営業資料・ロープレ録音）の保存先。
 *
 * 【重要】**非公開バケット**。以前は公開バケット "files" に置いて公開URLを
 * DBに保存していたが、代理店にアカウントを配る構成では「URLを知っていれば
 * 誰でも読める」状態は許容できないため 0008 で非公開に切り替えた。
 * DB には**Storageのパス**を保存し、表示時に署名URLを発行する
 * （請求書 "invoices" と同じ方式。resolveFileUrl / useFileUrl を使う）。
 */
const ATTACHMENT_BUCKET = "attachments";
const DATA_URL_LIMIT = 1.5 * 1024 * 1024; // デモモードでlocalStorageに入れる上限

/** 値が Storage のパス（= 署名URLの発行が必要）かどうか */
export function isStoragePath(ref: string): boolean {
  return ref !== "" && !/^(https?:|data:|blob:)/.test(ref);
}

/**
 * ファイルを保存して**参照（ref）**を返す。
 * - Supabase接続時: 非公開バケットへアップロードし Storage のパスを返す
 *   （そのまま <img src> には使えない。resolveFileUrl / useFileUrl で解決する）
 * - デモモード: 小さいファイルは dataURL（永続化可）、大きいファイルは
 *   objectURL（そのセッション中のみ有効）を返す
 */
export async function storeFile(
  file: File | Blob,
  path: string
): Promise<{ ref: string; persistent: boolean }> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.storage
      .from(ATTACHMENT_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return { ref: path, persistent: true };
  }
  if (file.size <= DATA_URL_LIMIT) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { ref: dataUrl, persistent: true };
  }
  return { ref: URL.createObjectURL(file), persistent: false };
}

/**
 * 保存された参照を、表示に使えるURLへ解決する。
 * dataURL / objectURL / 旧公開URL はそのまま返し、Storageパスだけ署名URLにする。
 * 解決できない場合は空文字（呼び出し側でプレースホルダーを出す）。
 */
export async function resolveFileUrl(
  ref: string,
  bucket: string = ATTACHMENT_BUCKET,
  expiresSec = 3600
): Promise<string> {
  if (ref === "") return "";
  if (!isStoragePath(ref)) return ref;
  const sb = getSupabase();
  if (!sb) return "";
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(ref, expiresSec);
  if (error || !data) return "";
  return data.signedUrl;
}

const INVOICE_BUCKET = "invoices";

/**
 * 請求書ファイルを保存する（機密のため非公開バケット）。
 * - Supabase接続時: "invoices" バケットへアップロードし **Storageパス** を返す
 *   （公開URLは存在しない。表示時は getSignedFileUrl で署名URLを取得する）
 * - デモモード: storeFile と同じく dataURL / objectURL を返す
 */
export async function storeInvoiceFile(
  file: File | Blob,
  path: string
): Promise<{ ref: string; persistent: boolean }> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.storage
      .from(INVOICE_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return { ref: path, persistent: true };
  }
  const { ref, persistent } = await storeFile(file, path);
  return { ref, persistent };
}

/** 非公開バケットのパスから署名URLを取得する（Supabase接続時のみ） */
export async function getSignedFileUrl(
  path: string,
  expiresSec = 3600
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(path, expiresSec);
  if (error) return null;
  return data.signedUrl;
}
