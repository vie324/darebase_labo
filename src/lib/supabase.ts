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

const STORAGE_BUCKET = "files";
const DATA_URL_LIMIT = 1.5 * 1024 * 1024; // デモモードでlocalStorageに入れる上限

/**
 * ファイルを保存して参照URLを返す。
 * - Supabase接続時: Storage の "files" バケットへアップロードし公開URLを返す
 * - デモモード: 小さいファイルは dataURL（永続化可）、大きいファイルは
 *   objectURL（そのセッション中のみ有効）を返す
 */
export async function storeFile(
  file: File | Blob,
  path: string
): Promise<{ url: string; persistent: boolean }> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.storage
      .from(STORAGE_BUCKET)
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, persistent: true };
  }
  if (file.size <= DATA_URL_LIMIT) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { url: dataUrl, persistent: true };
  }
  return { url: URL.createObjectURL(file), persistent: false };
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
  const { url, persistent } = await storeFile(file, path);
  return { ref: url, persistent };
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
