-- =============================================================
-- 0007: 案件ステージの2階建て化（データ移行）
--
-- 1階（商談）: appointment → follow_up(確度 C/B/A) → po_wait → won / lost
-- 2階（受注後）: 既存の fulfillment_status（契約締結 … 検収/請求）を
--                大分類5列に畳んで表示する（列定義は src/lib/constants.ts の
--                FULFILLMENT_GROUPS。DB のカラムは変更しない）。
--
-- 「商談後追い C/B/A」はステージではなく stage='follow_up' × confidence_rank
-- の組み合わせで表す。確度が変わればカンバンのカードが自動で列を移動する。
--
-- ステージ名は enum ではなく text のままにしてある（値の一覧は
-- src/lib/constants.ts の DEAL_STAGES / PIPELINE_COLUMNS に集約）。
-- =============================================================

-- 旧ステージ（lead / qualified / proposal / negotiation）を新ステージへ移す。
-- 確度ランクが未設定の行だけランクを補完する（手入力済みの判定は尊重する）。
update public.deals set stage = 'appointment'
where stage in ('lead', 'qualified');

update public.deals
set stage = 'follow_up',
    confidence_rank = case when confidence_rank = '' then 'C' else confidence_rank end
where stage = 'proposal';

update public.deals
set stage = 'follow_up',
    confidence_rank = case when confidence_rank = '' then 'B' else confidence_rank end
where stage = 'negotiation';

-- 受注済みで受注後フェーズが未設定の案件は、先頭フェーズ（契約締結）から始める
update public.deals
set fulfillment_status = 'contract',
    fulfillment_updated_at = case
      when fulfillment_updated_at = '' then to_char(now(), 'YYYY-MM-DD')
      else fulfillment_updated_at
    end
where stage = 'won' and fulfillment_status = '';

-- 既定値も新ステージに合わせる（新規行は「商談予定」から始まる）
alter table public.deals alter column stage set default 'appointment';

-- =============================================================
-- ロールバック（必要な場合）
--
-- alter table public.deals alter column stage set default 'lead';
-- update public.deals set stage = 'lead' where stage = 'appointment';
-- update public.deals set stage = 'negotiation' where stage = 'follow_up';
-- update public.deals set stage = 'proposal' where stage = 'po_wait';
-- ※ confidence_rank は残るが、旧UIでは参照されないため実害はない。
-- =============================================================
