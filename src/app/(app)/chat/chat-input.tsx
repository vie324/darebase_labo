"use client";

import { useState, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button, Textarea } from "@/components/ui";

export function ChatInput({
  channelName,
  onSend,
}: {
  channelName: string;
  onSend: (content: string) => void;
}) {
  const [text, setText] = useState("");

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter=送信 / Shift+Enter=改行。IME変換確定中(日本語入力)は送信しない。
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-slate-200/80 p-3 dark:border-slate-800">
      <div className="flex items-end gap-2">
        {/* 共通Textareaの min-h-24 / resize-y を inline style で確実に上書き */}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={`#${channelName} へメッセージ… (Enter送信 / Shift+Enter改行)`}
          rows={1}
          className="flex-1 py-2.5"
          style={{ minHeight: "2.75rem", maxHeight: "10rem", resize: "none" }}
        />
        <Button
          onClick={submit}
          disabled={!text.trim()}
          aria-label="送信"
          className="h-11 w-11 shrink-0"
          style={{ paddingLeft: 0, paddingRight: 0 }}
        >
          <Send className="h-[18px] w-[18px]" />
        </Button>
      </div>
    </div>
  );
}
