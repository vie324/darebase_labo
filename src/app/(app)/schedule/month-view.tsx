"use client";

// 月間カレンダービュー（自作グリッド）

import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { CalendarEvent } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/constants";
import { cn, formatTime } from "@/lib/utils";
import { eventsOn, WEEKDAYS, weekdayColor } from "./helpers";

const MAX_CHIPS = 3;

export function MonthView({
  cursor,
  today,
  events,
  onDayClick,
  onEventClick,
}: {
  cursor: Date;
  today: Date;
  events: CalendarEvent[];
  onDayClick: (day: Date) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor)),
    end: endOfWeek(endOfMonth(cursor)),
  });

  return (
    <div className="scrollbar-thin overflow-x-auto pb-1">
      <div className="card min-w-[640px] overflow-hidden">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 border-b border-slate-200/80 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={cn("py-2 text-center text-xs font-bold", weekdayColor(i))}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 日グリッド */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const inMonth = isSameMonth(day, cursor);
            const isToday = isSameDay(day, today);
            const dayEvents = eventsOn(events, day);
            const shown = dayEvents.slice(0, MAX_CHIPS);
            const rest = dayEvents.length - shown.length;
            const dow = day.getDay();
            const lastRow = idx >= days.length - 7;
            return (
              <div
                key={day.toISOString()}
                onClick={() => onDayClick(day)}
                className={cn(
                  "min-h-28 cursor-pointer border-slate-100 p-1.5 transition-colors hover:bg-cyan-50/50 dark:border-slate-800 dark:hover:bg-cyan-500/5",
                  !lastRow && "border-b",
                  idx % 7 !== 6 && "border-r",
                  isToday && "bg-cyan-50/70 dark:bg-cyan-500/10"
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday
                        ? "bg-cyan-500 text-slate-900 shadow-sm shadow-cyan-500/30"
                        : !inMonth
                          ? "text-slate-300 dark:text-slate-600"
                          : dow === 0
                            ? "text-rose-500 dark:text-rose-400"
                            : dow === 6
                              ? "text-sky-600 dark:text-sky-400"
                              : "text-slate-700 dark:text-slate-200"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-bold text-cyan-500 dark:text-cyan-400">
                      今日
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {shown.map((ev) => {
                    const cat = EVENT_CATEGORIES[ev.category];
                    return (
                      <button
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(ev);
                        }}
                        title={ev.title}
                        className={cn(
                          "block w-full cursor-pointer truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium transition-opacity hover:opacity-70",
                          cat.chip,
                          !inMonth && "opacity-50"
                        )}
                      >
                        {!ev.all_day && (
                          <span className="mr-1 opacity-70">
                            {formatTime(ev.start_at)}
                          </span>
                        )}
                        {ev.title}
                      </button>
                    );
                  })}
                  {rest > 0 && (
                    <p className="px-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                      他{rest}件
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
