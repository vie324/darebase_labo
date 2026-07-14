"use client";

import { useEffect, useRef } from "react";
import { ArrowLeft, MessageSquare, Trash2 } from "lucide-react";
import { Avatar, EmptyState } from "@/components/ui";
import { cn, formatTime } from "@/lib/utils";
import type { Channel, ChatMessage } from "@/lib/types";
import type { CurrentUser } from "@/lib/use-user";
import { authorColor, dayDividerLabel, dayKey, linkify } from "./helpers";
import { ChatInput } from "./chat-input";

const GROUP_GAP_MS = 5 * 60 * 1000; // 5分以内の連続発言はまとめる

function DateDivider({ label }: { label: string }) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      <span className="rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function MessageRow({
  message,
  isMe,
  showHeader,
  grouped,
  onDelete,
}: {
  message: ChatMessage;
  isMe: boolean;
  showHeader: boolean;
  grouped: boolean;
  onDelete: () => void;
}) {
  const time = formatTime(message.created_at);

  if (isMe) {
    return (
      <div className={cn("group flex w-full justify-end", grouped ? "mt-0.5" : "mt-3")}>
        <div className="flex max-w-[82%] flex-col items-end sm:max-w-[75%]">
          {showHeader && (
            <span className="mr-1 mb-0.5 text-[11px] text-slate-400 dark:text-slate-500">
              {time}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onDelete}
              aria-label="メッセージを削除"
              className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:hover:bg-rose-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <div
              className={cn(
                "min-w-0 whitespace-pre-wrap break-words bg-gradient-to-br from-cyan-500 to-cyan-600 px-3.5 py-2 text-sm leading-relaxed text-white shadow-sm shadow-cyan-500/20",
                showHeader ? "rounded-2xl rounded-tr-md" : "rounded-2xl"
              )}
            >
              {linkify(message.content, true)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("group flex w-full gap-2.5", grouped ? "mt-0.5" : "mt-3")}>
      <div className="w-9 shrink-0">
        {showHeader ? (
          <Avatar name={message.author_name} color={authorColor(message.author_name)} size="sm" />
        ) : (
          <span className="block text-center text-[10px] leading-9 text-transparent transition-colors group-hover:text-slate-400 dark:group-hover:text-slate-500">
            {time}
          </span>
        )}
      </div>
      <div className="flex min-w-0 max-w-[82%] flex-col items-start sm:max-w-[75%]">
        {showHeader && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {message.author_name}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{time}</span>
          </div>
        )}
        <div
          className={cn(
            "min-w-0 whitespace-pre-wrap break-words bg-slate-100 px-3.5 py-2 text-sm leading-relaxed text-slate-700 dark:bg-slate-800 dark:text-slate-200",
            showHeader ? "rounded-2xl rounded-tl-md" : "rounded-2xl"
          )}
        >
          {linkify(message.content)}
        </div>
      </div>
    </div>
  );
}

export function MessageArea({
  channel,
  messages,
  user,
  onSend,
  onDeleteMessage,
  onDeleteChannel,
  onBack,
}: {
  channel: Channel | null;
  messages: ChatMessage[];
  user: CurrentUser | null;
  onSend: (content: string) => void;
  onDeleteMessage: (id: string) => void;
  onDeleteChannel: () => void;
  onBack: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // チャンネル切替・新規メッセージ・初期表示で最下部へ
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [channel?.id, messages]);

  if (!channel) {
    return (
      <div className="card flex h-full items-center justify-center overflow-hidden p-6">
        <EmptyState
          icon={<MessageSquare className="h-10 w-10" />}
          title="チャンネルがありません"
          description="左上の＋から最初のチャンネルを作成しましょう"
        />
      </div>
    );
  }

  const sorted = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));

  return (
    <div className="card flex h-full flex-col overflow-hidden">
      {/* チャンネルヘッダー */}
      <div className="flex items-center gap-2.5 border-b border-slate-200/80 px-3 py-3 sm:px-4 dark:border-slate-800">
        <button
          onClick={onBack}
          aria-label="チャンネル一覧へ戻る"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg dark:bg-slate-800">
          {channel.emoji || "#"}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold">{channel.name}</h2>
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">
            {channel.description || `${sorted.length}件のメッセージ`}
          </p>
        </div>
        <button
          onClick={onDeleteChannel}
          aria-label="チャンネルを削除"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/15"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* メッセージ一覧 */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2 sm:px-4">
        {sorted.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={<MessageSquare className="h-10 w-10" />}
              title="まだメッセージがありません"
              description={`#${channel.name} で会話を始めましょう`}
            />
          </div>
        ) : (
          <>
            {sorted.map((m, i) => {
              const prev = sorted[i - 1];
              const showDivider = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
              const isMe = m.author_name === user?.name;
              const gap = prev
                ? new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()
                : Infinity;
              const grouped =
                !!prev &&
                !showDivider &&
                prev.author_name === m.author_name &&
                gap < GROUP_GAP_MS;
              return (
                <div key={m.id}>
                  {showDivider && <DateDivider label={dayDividerLabel(m.created_at)} />}
                  <MessageRow
                    message={m}
                    isMe={isMe}
                    showHeader={!grouped}
                    grouped={grouped}
                    onDelete={() => onDeleteMessage(m.id)}
                  />
                </div>
              );
            })}
            <div ref={bottomRef} className="h-1" />
          </>
        )}
      </div>

      {/* 入力欄 */}
      <ChatInput channelName={channel.name} onSend={onSend} />
    </div>
  );
}
