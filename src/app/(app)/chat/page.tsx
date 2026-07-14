"use client";

// =============================================================
// チャット — チームのチャンネル型メッセージング
// 左: チャンネル一覧 / 右: メッセージ（realtime購読）
// モバイルは一覧⇄メッセージを切替表示
// =============================================================

import { useMemo, useState } from "react";
import { PageSkeleton } from "@/components/ui";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { cn } from "@/lib/utils";
import { ChannelSidebar } from "./channel-sidebar";
import { MessageArea } from "./message-area";
import { ChannelFormModal, type ChannelFormValues } from "./channel-form-modal";

export default function ChatPage() {
  const {
    items: channels,
    loading: channelsLoading,
    add: addChannel,
    remove: removeChannel,
  } = useCollection("channels");
  const {
    items: messages,
    loading: messagesLoading,
    add: addMessage,
    remove: removeMessage,
  } = useCollection("messages", { realtime: true });
  const { user } = useUser();

  // ユーザーが明示的に選んだID。未選択/無効なら先頭チャンネルにフォールバック（effect不要）
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"channels" | "messages">("channels");
  const [createOpen, setCreateOpen] = useState(false);

  const activeId = useMemo(() => {
    if (pickedId && channels.some((c) => c.id === pickedId)) return pickedId;
    return channels[0]?.id ?? null;
  }, [pickedId, channels]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of messages) c[m.channel_id] = (c[m.channel_id] ?? 0) + 1;
    return c;
  }, [messages]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === activeId) ?? null,
    [channels, activeId]
  );

  const channelMessages = useMemo(
    () => messages.filter((m) => m.channel_id === activeId),
    [messages, activeId]
  );

  if (channelsLoading || messagesLoading) return <PageSkeleton />;

  const handleSelect = (id: string) => {
    setPickedId(id);
    setMobileView("messages");
  };

  const handleSend = (content: string) => {
    if (!activeId) return;
    void addMessage({
      channel_id: activeId,
      author_name: user?.name ?? "名無し",
      content,
    });
  };

  const handleCreateChannel = async (v: ChannelFormValues) => {
    const created = await addChannel(v);
    setPickedId(created.id);
    setMobileView("messages");
  };

  const handleDeleteChannel = async () => {
    if (!selectedChannel) return;
    if (
      !confirm(
        `「${selectedChannel.name}」チャンネルを削除しますか？\nチャンネル内のメッセージもすべて削除されます。`
      )
    )
      return;
    const target = selectedChannel.id;
    await Promise.all(
      messages.filter((m) => m.channel_id === target).map((m) => removeMessage(m.id))
    );
    await removeChannel(target);
    setMobileView("channels");
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* 左: チャンネル一覧 */}
      <div
        className={cn(
          "h-full w-full lg:w-72 lg:shrink-0",
          mobileView === "messages" ? "hidden lg:block" : "block"
        )}
      >
        <ChannelSidebar
          channels={channels}
          counts={counts}
          selectedId={activeId}
          onSelect={handleSelect}
          onCreate={() => setCreateOpen(true)}
        />
      </div>

      {/* 右: メッセージ */}
      <div
        className={cn(
          "h-full min-w-0 flex-1",
          mobileView === "channels" ? "hidden lg:block" : "block"
        )}
      >
        <MessageArea
          channel={selectedChannel}
          messages={channelMessages}
          user={user}
          onSend={handleSend}
          onDeleteMessage={(id) => removeMessage(id)}
          onDeleteChannel={handleDeleteChannel}
          onBack={() => setMobileView("channels")}
        />
      </div>

      <ChannelFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateChannel}
      />
    </div>
  );
}
