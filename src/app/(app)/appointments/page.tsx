"use client";

// =============================================================
// アポイント — 銀行支店から電話で来た紹介を最小入力で登録する
//
// 登録時の連動（§5-2）:
//  1. branches.last_contact_at を更新（＝支店稼働の指標に反映）
//  2. 商談予定日時があれば既存スケジュール（events）に予定を作成
//  3. 商談日から N 日経っても結果未入力ならフォロー要としてアラート
// =============================================================

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarPlus,
  Phone,
  Plus,
  Trophy,
} from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { useBranchSettings } from "@/lib/settings";
import { monthlyAppointmentCounts, toMonth } from "@/lib/branch-metrics";
import { APPOINTMENT_STATUSES, CONTACT_ROLES } from "@/lib/constants";
import { cn, formatDate, formatDateTime, todayStr } from "@/lib/utils";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  PageSkeleton,
  SearchInput,
  Select,
  StatCard,
  Tabs,
} from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { AppointmentDetailModal, AppointmentFormModal } from "./appointment-modals";
import {
  addMinutesIso,
  isUpcoming,
  localInputToIso,
  needsFollowUp,
  type AppointmentFormValues,
} from "./shared";
import { useAccess } from "@/lib/use-access";

type TabKey = "all" | "upcoming" | "followup" | "won";

export default function AppointmentsPage() {
  const { user } = useUser();
  // 代理店ユーザーが登録した行は自組織に紐づける（RLS のスコープ条件）
  const { organizationId } = useAccess();
  const { toast } = useToast();
  const appointments = useCollection("appointments");
  const banks = useCollection("banks");
  const branches = useCollection("branches");
  const events = useCollection("events");
  const deals = useCollection("deals");
  const profiles = useCollection("profiles");
  const businessUnits = useCollection("business_units");
  const { settings } = useBranchSettings();

  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [bankFilter, setBankFilter] = useState("all");
  const [formState, setFormState] = useState<{ initial: Appointment | null } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const today = todayStr();

  const loading =
    !user || appointments.loading || banks.loading || branches.loading || profiles.loading;

  const followUps = useMemo(
    () => appointments.items.filter((a) => needsFollowUp(a, today, settings.followUpDays)),
    [appointments.items, today, settings.followUpDays]
  );

  if (loading) return <PageSkeleton />;

  const bankNameOf = (id: string | null) =>
    id ? (banks.items.find((b) => b.id === id)?.name ?? "") : "";
  const branchNameOf = (id: string | null) =>
    id ? (branches.items.find((b) => b.id === id)?.name ?? "") : "";
  const defaultBusinessUnitId =
    businessUnits.items.find((b) => b.slug === "banking")?.id ??
    businessUnits.items[0]?.id ??
    null;

  const month = monthlyAppointmentCounts(appointments.items, toMonth(today));
  const upcoming = appointments.items.filter((a) => isUpcoming(a, today));

  const q = query.trim().toLowerCase();
  const filtered = appointments.items
    .filter((a) => {
      if (tab === "upcoming" && !isUpcoming(a, today)) return false;
      if (tab === "followup" && !needsFollowUp(a, today, settings.followUpDays)) return false;
      if (tab === "won" && a.status !== "won") return false;
      if (ownerFilter !== "all" && a.assigned_to !== ownerFilter) return false;
      if (bankFilter !== "all" && a.bank_id !== bankFilter) return false;
      if (q) {
        const hay = `${a.company_name} ${bankNameOf(a.bank_id)} ${branchNameOf(a.branch_id)} ${a.industry}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // 予定があるものは日時の近い順、無いものは受電日の新しい順
      const av = a.scheduled_at || a.received_at;
      const bv = b.scheduled_at || b.received_at;
      return bv.localeCompare(av);
    });

  const detail = detailId ? (appointments.items.find((a) => a.id === detailId) ?? null) : null;

  // ---------- 操作 ----------

  const saveAppointment = async (values: AppointmentFormValues) => {
    const branch = branches.items.find((b) => b.id === values.branch_id);
    const assignee = profiles.items.find((p) => p.id === values.assigned_to);
    const scheduledIso = localInputToIso(values.scheduled_local);
    const now = new Date().toISOString();

    const base = {
      bank_id: values.bank_id || null,
      branch_id: values.branch_id || null,
      assigned_to: values.assigned_to || null,
      assigned_name: assignee?.name ?? "",
      organization_id: branch?.assigned_org_id ?? organizationId ?? null,
      received_at: values.received_at,
      scheduled_at: scheduledIso,
      company_name: values.company_name,
      industry: values.industry,
      revenue_scale: values.revenue_scale,
      contact_role: values.contact_role,
      source_note: values.source_note,
      updated_at: now,
    };

    const eventTitle = `${values.company_name}（${bankNameOf(values.bank_id)} ${branch?.name ?? ""}）`;

    if (formState?.initial) {
      const prev = formState.initial;
      await appointments.update(prev.id, base);
      // 連動しているスケジュールも追従させる
      if (prev.event_id && events.items.some((e) => e.id === prev.event_id)) {
        if (scheduledIso) {
          await events.update(prev.event_id, {
            title: eventTitle,
            start_at: scheduledIso,
            end_at: addMinutesIso(scheduledIso, 60),
            owner_name: assignee?.name ?? "",
          });
        } else {
          // 日程が未定に戻された場合は予定を削除する
          await events.remove(prev.event_id);
          await appointments.update(prev.id, { event_id: null });
        }
      } else if (scheduledIso) {
        const ev = await createEvent(eventTitle, scheduledIso, assignee?.name ?? "", branch?.address ?? "");
        await appointments.update(prev.id, { event_id: ev });
      }
      toast("アポイントを更新しました", "success");
    } else {
      const eventId = scheduledIso
        ? await createEvent(eventTitle, scheduledIso, assignee?.name ?? "", branch?.address ?? "")
        : null;
      await appointments.add({
        ...base,
        status: "scheduled",
        deal_id: null,
        event_id: eventId,
        business_unit_id: branch?.business_unit_id ?? defaultBusinessUnitId,
      });
      toast(
        scheduledIso
          ? "アポイントを登録し、スケジュールにも追加しました"
          : "アポイントを登録しました",
        "success"
      );
    }

    // 支店の最終接点日を進める（過去日を入力した場合は巻き戻さない）
    if (branch && values.received_at > branch.last_contact_at) {
      await branches.update(branch.id, {
        last_contact_at: values.received_at,
        updated_at: now,
      });
    }
    setFormState(null);
  };

  const createEvent = async (
    title: string,
    startIso: string,
    ownerName: string,
    location: string
  ): Promise<string> => {
    const row = await events.add({
      title,
      description: "銀行支店からの紹介アポイント",
      start_at: startIso,
      end_at: addMinutesIso(startIso, 60),
      all_day: false,
      category: "visit",
      location,
      owner_name: ownerName,
    });
    return row.id;
  };

  const changeStatus = async (a: Appointment, status: AppointmentStatus) => {
    if (a.status === status) return;
    await appointments.update(a.id, { status, updated_at: new Date().toISOString() });
    toast(`${APPOINTMENT_STATUSES[status].label} に変更しました`, "info");
  };

  const removeAppointment = async (a: Appointment) => {
    if (!confirm(`「${a.company_name}」のアポイントを削除しますか？`)) return;
    if (a.event_id && events.items.some((e) => e.id === a.event_id)) {
      await events.remove(a.event_id);
    }
    await appointments.remove(a.id);
    setDetailId(null);
    toast("アポイントを削除しました", "info");
  };

  /** アポから案件を起こす（銀行・支店の紐付けを引き継ぐ） */
  const createDeal = async (a: Appointment) => {
    const branch = branches.items.find((b) => b.id === a.branch_id);
    const now = new Date().toISOString();
    const deal = await deals.add({
      name: a.company_name,
      company: a.company_name,
      contact_name: "",
      // 銀行紹介から起こした案件は「商談予定」から始まる（1階の先頭）
      stage: "appointment",
      confidence_rank: "",
      amount: 0,
      probability: 10,
      expected_close: "",
      owner_name: a.assigned_name,
      owner_id: a.assigned_to,
      next_action: "商談実施",
      memo: [a.source_note, a.industry && `業種: ${a.industry}`, a.revenue_scale && `売上規模: ${a.revenue_scale}`]
        .filter(Boolean)
        .join("\n"),
      updated_at: now,
      bank_id: a.bank_id,
      branch_id: a.branch_id,
      appointment_id: a.id,
      organization_id: branch?.assigned_org_id ?? organizationId ?? null,
      business_unit_id: a.business_unit_id ?? defaultBusinessUnitId,
    });
    await appointments.update(a.id, { deal_id: deal.id, updated_at: now });
    setDetailId(null);
    toast("案件を作成しました。案件管理から進捗を更新できます", "success");
  };

  const hasBranches = branches.items.length > 0;

  return (
    <div>
      <PageHeader
        title="アポイント"
        description="銀行支店からの紹介を最小入力で登録し、支店の稼働に反映する"
        icon={<Phone className="h-5 w-5" />}
        actions={
          <Button size="sm" onClick={() => setFormState({ initial: null })} disabled={!hasBranches}>
            <Plus className="h-4 w-4" />
            アポを登録
          </Button>
        }
      />

      {!hasBranches ? (
        <EmptyState
          icon={<Phone className="h-10 w-10" />}
          title="先に銀行・支店を登録してください"
          description="アポイントは銀行の支店に紐づけて登録します"
          action={
            <Link
              href="/banks"
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-400 px-4 text-sm font-medium text-slate-900"
            >
              銀行・支店マスタへ
              <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <>
          {/* ---------- サマリー ---------- */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="今月のアポ"
              value={`${month.appointments}件`}
              sub={`${toMonth(today)} 受電分`}
              icon={<Phone className="h-5 w-5" />}
              accent="cyan"
            />
            <StatCard
              label="今月の成約"
              value={`${month.won}件`}
              sub={
                month.appointments > 0
                  ? `成約率 ${Math.round((month.won / month.appointments) * 100)}%`
                  : "アポなし"
              }
              icon={<Trophy className="h-5 w-5" />}
              accent="emerald"
            />
            <StatCard
              label="これからの商談"
              value={`${upcoming.length}件`}
              sub="予定日が今日以降"
              icon={<CalendarCheck className="h-5 w-5" />}
              accent="sky"
            />
            <StatCard
              label="結果未入力"
              value={`${followUps.length}件`}
              sub={`商談日から${settings.followUpDays}日以上経過`}
              icon={<AlertTriangle className="h-5 w-5" />}
              accent="amber"
            />
          </div>

          {/* ---------- フォロー要アラート ---------- */}
          {followUps.length > 0 && tab !== "followup" && (
            <button
              onClick={() => setTab("followup")}
              className="mt-4 flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-left transition-colors hover:bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
              <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
                商談日から{settings.followUpDays}日以上経過して結果が未入力のアポが
                <strong className="mx-1">{followUps.length}件</strong>あります
              </p>
              <ArrowRight className="h-4 w-4 shrink-0 text-amber-500" />
            </button>
          )}

          {/* ---------- タブ + フィルタ ---------- */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Tabs<TabKey>
              tabs={[
                { key: "all", label: "すべて", count: appointments.items.length },
                { key: "upcoming", label: "これから", count: upcoming.length },
                { key: "followup", label: "要フォロー", count: followUps.length },
                {
                  key: "won",
                  label: "受注",
                  count: appointments.items.filter((a) => a.status === "won").length,
                },
              ]}
              active={tab}
              onChange={setTab}
            />
            <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="企業名・支店名で検索…"
                className="w-full sm:w-56"
              />
              <Select
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
                className="w-full sm:w-40"
                aria-label="銀行で絞り込み"
              >
                <option value="all">すべての銀行</option>
                {banks.items.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
              <Select
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
                className="w-full sm:w-40"
                aria-label="担当者で絞り込み"
              >
                <option value="all">すべての担当者</option>
                {profiles.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* ---------- 一覧 ---------- */}
          <div className="mt-4 space-y-2">
            {filtered.length === 0 ? (
              <EmptyState
                icon={<Phone className="h-10 w-10" />}
                title={
                  appointments.items.length === 0
                    ? "アポイントがまだありません"
                    : "条件に一致するアポイントがありません"
                }
                description={
                  appointments.items.length === 0
                    ? "銀行から紹介の電話が来たら、その場で登録してください"
                    : "絞り込み条件を変えてください"
                }
                action={
                  appointments.items.length === 0 ? (
                    <Button onClick={() => setFormState({ initial: null })}>
                      <Plus className="h-4 w-4" />
                      アポを登録
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              filtered.map((a) => {
                const meta = APPOINTMENT_STATUSES[a.status];
                const follow = needsFollowUp(a, today, settings.followUpDays);
                return (
                  <Card
                    key={a.id}
                    hover
                    className="p-4"
                    onClick={() => setDetailId(a.id)}
                  >
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={meta.color}>{meta.label}</Badge>
                          {follow && (
                            <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" />
                              結果未入力
                            </Badge>
                          )}
                          {a.contact_role && (
                            <Badge className={CONTACT_ROLES[a.contact_role].color}>
                              {CONTACT_ROLES[a.contact_role].label}
                            </Badge>
                          )}
                          {a.deal_id && <Badge>案件化済み</Badge>}
                        </div>
                        <p className="mt-1.5 truncate font-semibold">{a.company_name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {bankNameOf(a.bank_id)} {branchNameOf(a.branch_id)}
                          {a.industry && ` ・ ${a.industry}`}
                          {a.revenue_scale && ` ・ ${a.revenue_scale}`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p
                          className={cn(
                            "flex items-center justify-end gap-1 text-sm font-semibold whitespace-nowrap",
                            follow && "text-amber-600 dark:text-amber-400"
                          )}
                        >
                          <CalendarPlus className="h-3.5 w-3.5" />
                          {a.scheduled_at ? formatDateTime(a.scheduled_at) : "日程未定"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          受電 {a.received_at ? formatDate(a.received_at) : "—"}
                          {a.assigned_name && ` ・ ${a.assigned_name}`}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ---------- モーダル ---------- */}
      {formState && (
        <AppointmentFormModal
          key={formState.initial?.id ?? "new"}
          initial={formState.initial}
          banks={banks.items}
          branches={branches.items}
          members={profiles.items}
          defaultAssignee={user.id}
          onClose={() => setFormState(null)}
          onSubmit={saveAppointment}
        />
      )}
      {detail && (
        <AppointmentDetailModal
          key={detail.id}
          appointment={detail}
          bankName={bankNameOf(detail.bank_id)}
          branchName={branchNameOf(detail.branch_id)}
          hasDeal={Boolean(detail.deal_id)}
          onClose={() => setDetailId(null)}
          onEdit={(a) => {
            setDetailId(null);
            setFormState({ initial: a });
          }}
          onDelete={removeAppointment}
          onChangeStatus={changeStatus}
          onCreateDeal={createDeal}
        />
      )}
    </div>
  );
}
