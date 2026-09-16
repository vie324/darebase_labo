// =============================================================
// 事業部 — 銀行営業 / アライアンス営業 の2本立て
//
// ■ なぜ同じテーブルを共有するのか
// 紹介元 → 紹介の窓口 → アポ → 案件、という骨格は両事業部で同じ。
//   銀行営業:       銀行     → 支店       → アポ → 案件
//   アライアンス:   1次代理店 → 2次代理店  → アポ → 案件
// 稼働率・紹介数・成約率・休眠判定（branch-metrics.ts）も、アポの案件化も、
// そのまま同じ計算で成り立つ。テーブルを分けると集計・スコープ・RLS・
// デモデータを丸ごと二重に持つことになり、片方だけ直す事故が起きる。
//
// そこで banks / branches は共有し、**画面に出す呼び名だけ**を
// 事業部ごとに切り替える。この対応表がその唯一の定義。
//
// 【ランタイム依存なし】node の型ストリップでテストできるよう、
// 値の import を持たない（型のみ）。
// =============================================================

import type { BusinessUnit } from "./types";

/** 事業部の識別子。DB には business_units.slug として入る */
export const BANKING = "banking";
export const ALLIANCE = "alliance";

export type BusinessUnitSlug = typeof BANKING | typeof ALLIANCE;

/**
 * 入力欄に出す例。
 * 呼び名だけ差し替えると「1次代理店名／例: みらい銀行」のようにちぐはぐになるため、
 * 例文も事業部ごとに持つ。
 */
export interface UnitExamples {
  /** banks.name の例 */
  parent: string;
  /** banks.code の例 */
  parentCode: string;
  /** branches.name の例 */
  child: string;
  /** branches.code の例 */
  childCode: string;
  /** branches.note の入力例 */
  childNote: string;
  /** まとめて登録（かんたん入力）の複数行プレースホルダ */
  childLines: string;
  /** 行頭の連番・括弧書きコードの説明で使う「◯◯（001）」の例 */
  childWithCode: string;
}

/** 画面に出す呼び名。banks / branches の実体は同じで、ラベルだけ変わる */
export interface UnitTerms {
  /** 事業部そのものの名前 */
  unit: string;
  /** banks にあたるもの */
  parent: string;
  /** branches にあたるもの */
  child: string;
  /** banks.code の呼び名 */
  parentCode: string;
  /** branches.code の呼び名 */
  childCode: string;
  /**
   * アポの received_at（紹介の接点を持った日）の呼び名。
   * 「受電日」「受電分」のように後ろに語を足して使うため、素の名詞で持つ。
   * 銀行は電話で来るが、アライアンスは電話とは限らない。
   */
  received: string;
  /** 一覧ページの説明文 */
  description: string;
  /** 稼働ダッシュボードの説明文 */
  activityDescription: string;
  /** 「紹介を受ける側」から見た1件の呼び名（アポ画面などで使う） */
  referral: string;
  /** 件数の数え方（例: 12支店 / 12社） */
  countUnit: string;
  /**
   * コードが数字だけか。
   * 銀行は金融機関コード・支店コードとも数字。代理店は "AP01" のような
   * 英数字が入るため、スマホで数字キーボードに固定してはいけない。
   */
  numericCode: boolean;
  /** 入力欄のプレースホルダ */
  examples: UnitExamples;
}

export const UNIT_TERMS: Record<BusinessUnitSlug, UnitTerms> = {
  [BANKING]: {
    unit: "銀行営業",
    parent: "銀行",
    child: "支店",
    parentCode: "金融機関コード",
    childCode: "支店コード",
    received: "受電",
    description: "支店ごとの稼働状況を可視化し、放置支店の担当を振り替える",
    activityDescription: "支店ごとの紹介数・成約率と、放置されている支店を洗い出す",
    referral: "銀行紹介",
    countUnit: "支店",
    numericCode: true,
    examples: {
      parent: "みらい銀行",
      parentCode: "0011",
      child: "渋谷支店",
      childCode: "001",
      childNote: "支店長の人柄、紹介が出やすい商材など",
      childLines: "中央支店\n丸の内支店 002\n新宿支店,003,東京都,新宿区西新宿1-1-1",
      childWithCode: "中央支店（001）",
    },
  },
  [ALLIANCE]: {
    unit: "アライアンス営業",
    parent: "1次代理店",
    child: "2次代理店",
    parentCode: "提携先コード",
    childCode: "代理店コード",
    received: "紹介",
    description: "代理店ごとの紹介状況を可視化し、止まっている代理店に手を打つ",
    activityDescription: "代理店ごとの紹介数・成約率と、紹介が止まっている代理店を洗い出す",
    referral: "代理店紹介",
    countUnit: "社",
    numericCode: false,
    examples: {
      parent: "株式会社ブリッジパートナーズ",
      parentCode: "AP01",
      child: "株式会社アップリンク",
      childCode: "101",
      childNote: "担当者の人柄、紹介が出やすい商材など",
      childLines:
        "株式会社アップリンク\nミラクルセールス株式会社 102\n株式会社トップギア,103,千葉県,千葉市中央区1-1-1",
      childWithCode: "株式会社アップリンク（101）",
    },
  },
};

/**
 * 紹介元から直に紹介が来るぶんの受け皿になる窓口の名前。
 *
 * 1次代理店から2次代理店を介さず直接くる紹介は、その1次代理店の下に置いた
 * この窓口に付ける（銀行営業でいう本店営業部と同じ扱い）。
 * こうしておくと、紹介数・成約率・最終接点日が1次代理店の数字として
 * そのまま積み上がる。窓口なしで登録すると、どの集計にも入らなくなる。
 */
export const DIRECT_CHILD_NAME = "直接";
/** 「直接」の窓口に振るコード。まとめて登録の重複判定にも使う */
export const DIRECT_CHILD_CODE = "000";

/** 既定の事業部。未設定のデータはこちらに寄せる（0001〜0013 のデータはすべて銀行営業） */
export const DEFAULT_UNIT: BusinessUnitSlug = BANKING;

export const UNIT_SLUGS: BusinessUnitSlug[] = [BANKING, ALLIANCE];

/** DB から来た未知の slug を安全に変換する */
export function normalizeUnitSlug(value: unknown): BusinessUnitSlug {
  return value === ALLIANCE ? ALLIANCE : BANKING;
}

export function termsOf(slug: unknown): UnitTerms {
  return UNIT_TERMS[normalizeUnitSlug(slug)];
}

/**
 * business_units の行から、いま見ている事業部を解決する。
 * id が未指定・見つからない場合は銀行営業に倒す（既存データの互換）。
 */
export function resolveUnit(
  units: BusinessUnit[],
  unitId: string | null
): { unit: BusinessUnit | null; slug: BusinessUnitSlug; terms: UnitTerms } {
  const unit =
    (unitId ? units.find((u) => u.id === unitId) : undefined) ??
    units.find((u) => u.slug === DEFAULT_UNIT) ??
    units[0] ??
    null;
  const slug = normalizeUnitSlug(unit?.slug);
  return { unit, slug, terms: UNIT_TERMS[slug] };
}

/**
 * 行が指定の事業部に属するか。
 * business_unit_id が未設定の行は既定の事業部（銀行営業）のものとして扱う。
 * ＝ アライアンスを足したことで既存データが消えないようにするための判定。
 */
export function belongsToUnit(
  rowUnitId: string | null | undefined,
  unitId: string | null,
  defaultUnitId: string | null
): boolean {
  if (unitId === null) return true; // 事業部を絞っていない
  const resolved = rowUnitId ?? defaultUnitId;
  return resolved === unitId;
}

/** 事業部で行を絞る。business_unit_id を持つどのテーブルにも使える */
export function filterByUnit<T extends { business_unit_id?: string | null }>(
  rows: T[],
  unitId: string | null,
  defaultUnitId: string | null
): T[] {
  // 【注意】null は「事業部で絞らない」の意味。
  // 「選んだ事業部が business_units に無い」の合図として null を渡してはいけない。
  // 渡すと全件（他事業部のぶんも）返ってしまう。
  // 未作成の判定は useBusinessUnit の missing を見て、画面側で早期に返すこと。
  if (unitId === null) return rows;
  return rows.filter((r) => belongsToUnit(r.business_unit_id, unitId, defaultUnitId));
}
