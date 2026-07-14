"use client";

// イベントの詳細 / 日別一覧 / 作成・編集モーダル

import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Clock,
  FileText,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import type { CalendarEvent, EventCategory } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn, formatTime } from "@/lib/utils";
import {
  Avatar,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import {
  byStart,
  formatRange,
  occursOn,
  ownerColor,
  toLocalInput,
  WEEKDAYS,
} from "./helpers";

export type EventInput = Omit<CalendarEvent, "id" | "created_at">;

// ---------- 詳細モーダル ----------
export function EventDetailModal({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cat = EVENT_CATEGORIES[event.category];
  return (
    <Modal open onClose={onClose} title="予定の詳細">
      <div className="space-y-4">
        <div>
          <Badge className={cat.chip}>
            <span className={cn("h-1.5 w-1.5 rounded-full", cat.dot)} />
            {cat.label}
          </Badge>
          <h3 className="mt-2 text-xl leading-snug font-bold">{event.title}</h3>
        </div>

        <div className="space-y-2.5 text-sm">
          <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
            <Clock className="h-4 w-4 shrink-0 text-slate-400" />
            {formatRange(event)}
          </div>
          {event.location && (
            <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              {event.location}
            </div>
          )}
          <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-300">
            <Avatar
              name={event.owner_name}
              color={ownerColor(event.owner_name)}
              size="xs"
            />
            {event.owner_name}
          </div>
          {event.description && (
            <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p className="leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="danger" size="sm" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            削除
          </Button>
          <Button variant="secondary" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            編集
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- 日別一覧モーダル ----------
export function DayModal({
  day,
  events,
  onClose,
  onEventClick,
  onCreate,
}: {
  day: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onEventClick: (ev: CalendarEvent) => void;
  onCreate: () => void;
}) {
  const dayEvents = useMemo(
    () => events.filter((e) => occursOn(e, day)).sort(byStart),
    [events, day]
  );
  const title = `${day.getMonth() + 1}/${day.getDate()}（${WEEKDAYS[day.getDay()]}）の予定`;

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="space-y-2">
        {dayEvents.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            この日の予定はありません
          </p>
        )}
        {dayEvents.map((ev) => {
          const cat = EVENT_CATEGORIES[ev.category];
          return (
            <button
              key={ev.id}
              onClick={() => onEventClick(ev)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition-colors hover:border-cyan-200 hover:bg-cyan-50/40 dark:border-slate-800 dark:hover:border-cyan-500/30 dark:hover:bg-cyan-500/5"
            >
              <span className={cn("h-9 w-1 shrink-0 rounded-full", cat.dot)} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {ev.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-400 dark:text-slate-500">
                  {ev.all_day
                    ? "終日"
                    : `${formatTime(ev.start_at)} 〜 ${formatTime(ev.end_at)}`}
                  {ev.location && ` ・ ${ev.location}`}
                </span>
              </span>
              <Badge className={cat.chip}>{cat.label}</Badge>
            </button>
          );
        })}
        <div className="pt-2">
          <Button variant="secondary" className="w-full" onClick={onCreate}>
            <CalendarPlus className="h-4 w-4" />
            この日に予定を作成
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------- 作成・編集モーダル ----------
export function EventFormModal({
  event,
  defaultDate,
  defaultOwner,
  memberNames,
  onClose,
  onSubmit,
}: {
  event: CalendarEvent | null;
  defaultDate: Date | null;
  defaultOwner: string;
  memberNames: string[];
  onClose: () => void;
  onSubmit: (values: EventInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [category, setCategory] = useState<EventCategory>(
    event?.category ?? "visit"
  );
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [location, setLocation] = useState(event?.location ?? "");
  const [owner, setOwner] = useState(event?.owner_name || defaultOwner);
  const [start, setStart] = useState(() => {
    if (event) return toLocalInput(event.start_at);
    const base = defaultDate ? new Date(defaultDate) : new Date();
    if (defaultDate) {
      base.setHours(10, 0, 0, 0);
    } else {
      base.setMinutes(0, 0, 0);
      base.setHours(base.getHours() + 1);
    }
    return toLocalInput(base.toISOString());
  });
  const [end, setEnd] = useState(() => {
    if (event) return toLocalInput(event.end_at);
    const d = new Date(start);
    d.setHours(d.getHours() + 1);
    return toLocalInput(d.toISOString());
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }
    if (!start) {
      setError("開始日時を入力してください");
      return;
    }
    let startIso: string;
    let endIso: string;
    if (allDay) {
      const sd = start.slice(0, 10);
      const edRaw = (end || start).slice(0, 10);
      const ed = edRaw < sd ? sd : edRaw;
      startIso = new Date(`${sd}T00:00`).toISOString();
      endIso = new Date(`${ed}T23:59`).toISOString();
    } else {
      const s = new Date(start);
      const e = end ? new Date(end) : new Date(s.getTime() + 3_600_000);
      if (isNaN(e.getTime()) || e.getTime() < s.getTime()) {
        setError("終了日時は開始日時以降にしてください");
        return;
      }
      startIso = s.toISOString();
      endIso = e.toISOString();
    }
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        start_at: startIso,
        end_at: endIso,
        all_day: allDay,
        category,
        location: location.trim(),
        owner_name: owner,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={event ? "予定を編集" : "予定を作成"}>
      <div className="space-y-4">
        <Field label="タイトル" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 株式会社〇〇 訪問商談"
            autoFocus
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="カテゴリ">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as EventCategory)}
            >
              {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((key) => (
                <option key={key} value={key}>
                  {EVENT_CATEGORIES[key].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="担当者">
            <Select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {memberNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-cyan-600"
          />
          終日の予定
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="開始" required>
            <Input
              type={allDay ? "date" : "datetime-local"}
              value={allDay ? start.slice(0, 10) : start}
              onChange={(e) =>
                setStart(
                  allDay && e.target.value
                    ? `${e.target.value}T00:00`
                    : e.target.value
                )
              }
            />
          </Field>
          <Field label="終了">
            <Input
              type={allDay ? "date" : "datetime-local"}
              value={allDay ? end.slice(0, 10) : end}
              onChange={(e) =>
                setEnd(
                  allDay && e.target.value
                    ? `${e.target.value}T23:59`
                    : e.target.value
                )
              }
            />
          </Field>
        </div>

        <Field label="場所">
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例: 先方オフィス / Zoom"
          />
        </Field>

        <Field label="説明">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="アジェンダや持ち物、参加者などのメモ"
          />
        </Field>

        {error && (
          <p className="text-sm font-medium text-rose-500 dark:text-rose-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "保存中…" : event ? "更新する" : "作成する"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
