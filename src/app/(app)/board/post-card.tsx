"use client";

// 掲示板の一覧カード
// - pinned: リング＋ピンアイコンで最上部固定を強調
// - announce: 左ボーダーのアクセントで目立たせる

import { Heart, MessageCircle, Pin } from "lucide-react";
import { Avatar, Badge, Card } from "@/components/ui";
import { POST_CATEGORIES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import type { BoardPost } from "@/lib/types";
import { excerpt } from "./helpers";

export function PostCard({
  post,
  liked,
  authorColor,
  onOpen,
}: {
  post: BoardPost;
  liked: boolean;
  authorColor: string;
  onOpen: () => void;
}) {
  const cat = POST_CATEGORIES[post.category];
  const isAnnounce = post.category === "announce";

  return (
    <Card
      hover
      onClick={onOpen}
      className={cn(
        "group p-5",
        isAnnounce &&
          "border-l-4 border-l-rose-400 dark:border-l-rose-500/70",
        post.pinned &&
          "ring-1 ring-amber-200/70 dark:ring-amber-500/20"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {post.pinned && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
            <Pin className="h-3 w-3 fill-amber-400/40" />
            ピン留め
          </span>
        )}
        <Badge className={cat.color}>{cat.label}</Badge>
      </div>

      <h3 className="mt-2.5 text-base leading-snug font-bold transition-colors group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
        {post.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {excerpt(post.content)}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Avatar name={post.author_name} color={authorColor} size="xs" />
          <span className="font-medium">{post.author_name}</span>
          <span className="text-slate-300 dark:text-slate-600">・</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span
            className={cn(
              "flex items-center gap-1",
              liked && "font-semibold text-rose-500 dark:text-rose-400"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
            {post.likes}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" />
            {post.comments.length}
          </span>
        </div>
      </div>
    </Card>
  );
}
