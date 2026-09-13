// 商談ログのデモシード。
// AI未設定でも「解析するとこう出る」が分かるよう、解析済みの1件を入れてある。

import type { MeetingLog } from "../types";
import type { MeetingAnalysis } from "../meeting-analysis";
import { dateFromNow, daysFromNow } from "../utils";

const SAMPLE_TRANSCRIPT = `本日はお時間いただきありがとうございます。みらい銀行の田村様からご紹介いただきました、DARE BASE の田中と申します。
いえいえ、こちらこそ。田村さんから話は聞いています。うちも通信費はずっと気になっていまして。
ありがとうございます。現在は何回線ほどお使いでしょうか。
本社と工場で、だいたい40回線くらいですかね。総務の者が管理しているんですが、明細を見ても正直よく分からなくて。
なるほど。40回線ですと、弊社の実績では月あたり3万円前後の削減になるケースが多いです。
それは大きいですね。年間で35万くらいか。ただ、切り替えとなると工事が入るんですよね。
設置工事は必要になりますが、業務を止めずに夜間で対応した実績もあります。
なるほど。実は来期の予算をいま組んでいるところで、通信費の見直しも項目に入れてあるんです。
ちょうどよいタイミングですね。ご予算の規模感はいかがでしょうか。
初期費用で100万円くらいまでなら、私の決裁で通せます。それ以上だと役員会にかける必要がありますね。
承知しました。であれば、まず御社の現状の明細を拝見して、具体的な削減額をお出しします。
お願いします。明細は総務から出させますので、来週の水曜くらいまでにはお渡しできると思います。
ありがとうございます。いただいてから3営業日で見積をお持ちします。
助かります。あと、うちの工場長にも一度説明してもらえますか。現場が止まるのを一番気にするので。
もちろんです。工場長様のご都合を伺って、次回は同席いただく形にしましょう。`;

const SAMPLE_ANALYSIS: MeetingAnalysis = {
  segments: [
    { role: "自社", speaker: "田中 美咲", text: "本日はお時間いただきありがとうございます。みらい銀行の田村様からご紹介いただきました、DARE BASE の田中と申します。" },
    { role: "顧客", speaker: "", text: "こちらこそ。田村さんから話は聞いています。うちも通信費はずっと気になっていまして。" },
    { role: "自社", speaker: "田中 美咲", text: "現在は何回線ほどお使いでしょうか。" },
    { role: "顧客", speaker: "", text: "本社と工場で、だいたい40回線くらいですかね。明細を見てもよく分からなくて。" },
    { role: "自社", speaker: "田中 美咲", text: "40回線ですと、月あたり3万円前後の削減になるケースが多いです。" },
    { role: "顧客", speaker: "", text: "来期の予算をいま組んでいるところで、通信費の見直しも項目に入れてあります。" },
    { role: "顧客", speaker: "", text: "初期費用で100万円くらいまでなら、私の決裁で通せます。" },
    { role: "自社", speaker: "田中 美咲", text: "現状の明細を拝見して、具体的な削減額をお出しします。" },
    { role: "顧客", speaker: "", text: "明細は来週の水曜くらいまでにはお渡しできると思います。工場長にも説明してもらえますか。" },
  ],
  summary:
    "みらい銀行 田村様からの紹介案件です。本社と工場で約40回線を利用しており、通信費の削減に関心があります。来期予算に通信費見直しが項目として入っており、初期費用100万円までは面談相手の決裁で通せるとのことです。現状明細をいただいた上で、具体的な削減額と見積を提出する流れになりました。次回は現場を預かる工場長の同席を依頼されています。",
  decisions: [
    "先方が現状の通信明細を提出する（来週水曜目処）",
    "明細受領後、3営業日で見積を提出する",
    "次回は工場長に同席いただく",
  ],
  concerns: [
    "設置工事による業務停止を工場長が懸念する可能性がある",
    "初期費用が100万円を超えると役員会の決裁が必要になる",
  ],
  next_actions: [
    { title: "通信明細の受領を確認し、削減シミュレーションを作成する", owner: "自社", due_hint: "明細受領後すぐ", priority: "high" },
    { title: "見積書を作成して提出する", owner: "自社", due_hint: "3営業日以内", priority: "high" },
    { title: "工場長同席の次回日程を調整する", owner: "自社", due_hint: "今週中", priority: "mid" },
    { title: "夜間工事の実績資料を用意する", owner: "自社", due_hint: "次回訪問まで", priority: "mid" },
    { title: "総務から通信明細を出す", owner: "顧客", due_hint: "来週水曜", priority: "high" },
  ],
  confidence: {
    rank: "B",
    reason:
      "予算枠と決裁範囲が明示され導入時期も来期と具体的ですが、まだ見積提出前で、現場責任者である工場長の合意が取れていません。",
    evidence: [
      "来期の予算をいま組んでいるところで、通信費の見直しも項目に入れてあるんです。",
      "初期費用で100万円くらいまでなら、私の決裁で通せます。",
      "うちの工場長にも一度説明してもらえますか。現場が止まるのを一番気にするので。",
    ],
  },
  lost_risk: {
    level: "mid",
    reasons: [
      "工場長が業務停止を懸念しており、反対されると停滞する",
      "初期費用が100万円を超えると決裁ルートが変わり、期間が伸びる",
    ],
  },
};

/** 失注案件（deal-6）のログ。失注分析に要因が出るようにしてある */
const LOST_ANALYSIS: MeetingAnalysis = {
  segments: [],
  summary:
    "Web広告運用の提案でしたが、最終的に競合B社に決定しました。運用体制の評価は高かったものの、初期費用の差を社内で説明しきれなかったとのことです。決裁は取締役会に上がっており、面談相手だけでは押し切れませんでした。",
  decisions: ["今回は見送り", "半年後に運用状況を見て再提案の余地あり"],
  concerns: ["面談相手に決裁権がなかった", "初期費用の差を説明する材料が足りなかった"],
  next_actions: [
    { title: "半年後の再アプローチをリマインダーに設定する", owner: "自社", due_hint: "今週中", priority: "low" },
  ],
  confidence: { rank: "C", reason: "失注のため確度なし。", evidence: [] },
  lost_risk: {
    level: "high",
    reasons: [
      "価格面で競合B社に決定した",
      "決裁者が同席せず、取締役会で押し切れなかった",
      "初期費用の差を説明する費用対効果の資料が不足していた",
    ],
  },
};

export const DEMO_MEETING_LOGS: MeetingLog[] = [
  {
    id: "meeting-1",
    title: "大和精機 初回商談",
    held_at: dateFromNow(-2),
    kind: "meeting",
    deal_id: null,
    appointment_id: null,
    bank_id: null,
    branch_id: null,
    company_name: "大和精機",
    transcript: SAMPLE_TRANSCRIPT,
    media_url: "",
    analysis: SAMPLE_ANALYSIS,
    analyzed_at: daysFromNow(-2, 18, 30),
    analysis_model: "claude-opus-5",
    owner_id: "member-tanaka",
    owner_name: "田中 美咲",
    organization_id: null,
    business_unit_id: "bu-banking",
    updated_at: daysFromNow(-2, 18, 30),
    created_at: daysFromNow(-2, 18, 0),
  },
  {
    id: "meeting-2",
    title: "アオバ企画 最終提案（失注）",
    held_at: dateFromNow(-14),
    kind: "meeting",
    deal_id: "deal-6",
    appointment_id: null,
    bank_id: null,
    branch_id: null,
    company_name: "株式会社アオバ企画",
    transcript:
      "（前略）ご検討ありがとうございました。今回はB社さんにお願いすることになりまして。運用の体制はお宅の方が良かったんですが、初期費用の差を取締役会で説明しきれませんでした。（後略）",
    media_url: "",
    analysis: LOST_ANALYSIS,
    analyzed_at: daysFromNow(-14, 17, 0),
    analysis_model: "claude-opus-5",
    owner_id: "member-ito",
    owner_name: "伊藤 翔",
    organization_id: null,
    business_unit_id: "bu-banking",
    updated_at: daysFromNow(-14, 17, 0),
    created_at: daysFromNow(-14, 16, 30),
  },
];

/** デモモードで「AIで解析」を押したときに返すモック（本番は Claude が返す） */
export const DEMO_ANALYSIS: MeetingAnalysis = SAMPLE_ANALYSIS;
