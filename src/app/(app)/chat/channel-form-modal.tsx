"use client";

import { useState, type FormEvent } from "react";
import { Button, Field, Input, Modal } from "@/components/ui";

export interface ChannelFormValues {
  name: string;
  description: string;
  emoji: string;
}

export function ChannelFormModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: ChannelFormValues) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("💬");

  // 閉じるときに毎回リセット（開くたびに空の状態から始まる）
  const close = () => {
    setName("");
    setDescription("");
    setEmoji("💬");
    onClose();
  };

  const canSubmit = name.trim().length > 0;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    void onSubmit({
      name: name.trim(),
      description: description.trim(),
      emoji: emoji.trim() || "💬",
    });
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="チャンネルを作成"
      onSubmit={submit}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            キャンセル
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            作成
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-4">
          <Field label="絵文字">
            <Input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              maxLength={4}
              className="w-16 text-center text-xl"
              placeholder="💬"
            />
          </Field>
          <Field label="チャンネル名" required className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 新規開拓"
              autoFocus
              required
            />
          </Field>
        </div>
        <Field label="説明">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="このチャンネルの用途を一言で"
          />
        </Field>
      </div>
    </Modal>
  );
}
