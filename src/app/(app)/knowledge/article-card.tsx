"use client";

// ナレッジ記事の一覧カード

import { Eye, Heart, Pin } from "lucide-react";
import { Avatar, Badge, Card } from "@/components/ui";
import { KNOWLEDGE_CATEGORIES } from "@/lib/constants";
import { cn, timeAgo } from "@/lib/utils";
import type { Knowledge } from "@/lib/types";
import { excerpt } from "./helpers";

export function ArticleCard({
  article,
  liked,
  authorColor,
  onOpen,
  onTagClick,
}: {
  article: Knowledge;
  liked: boolean;
  authorColor: string;
  onOpen: () => void;
  onTagClick: (tag: string) => void;
}) {
  const cat = KNOWLEDGE_CATEGORIES[article.category];
  return (
    <Card
      hover
      onClick={onOpen}
      className={cn(
        "group p-5",
        article.pinned &&
          "border-amber-300/80 ring-1 ring-amber-200/70 dark:border-amber-500/40 dark:ring-amber-500/15"
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {article.pinned && (
          <Pin className="h-4 w-4 shrink-0 fill-amber-400/30 text-amber-500 dark:text-amber-400" />
        )}
        <Badge className={cat.color}>{cat.label}</Badge>
        {article.tags.map((t) => (
          <button
            key={t}
            onClick={(e) => {
              e.stopPropagation();
              onTagClick(t);
            }}
            className="cursor-pointer rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-cyan-50 hover:text-cyan-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-cyan-500/15 dark:hover:text-cyan-300"
          >
            #{t}
          </button>
        ))}
      </div>

      <h3 className="mt-2.5 text-base leading-snug font-bold transition-colors group-hover:text-cyan-600 dark:group-hover:text-cyan-400">
        {article.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
        {excerpt(article.content)}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Avatar name={article.author_name} color={authorColor} size="xs" />
          <span className="font-medium">{article.author_name}</span>
          <span className="text-slate-300 dark:text-slate-600">・</span>
          <span>{timeAgo(article.updated_at)}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
          <span
            className={cn(
              "flex items-center gap-1",
              liked && "font-semibold text-rose-500 dark:text-rose-400"
            )}
          >
            <Heart className={cn("h-3.5 w-3.5", liked && "fill-current")} />
            {article.likes}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            {article.views}
          </span>
        </div>
      </div>
    </Card>
  );
}
