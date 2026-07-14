"use client";

// 名刺カード（グリッド表示用の1枚）

import { Building2, CalendarDays, CreditCard, Mail, Phone } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { Contact } from "@/lib/types";
import { Avatar, Badge, Card } from "@/components/ui";
import { companyColor, isNewContact } from "./shared";

export function ContactCard({
  contact,
  onClick,
  showCompany = true,
}: {
  contact: Contact;
  onClick: () => void;
  showCompany?: boolean;
}) {
  return (
    <Card hover onClick={onClick} className="flex flex-col p-4">
      {/* 会社名（会社別ビューではセクション見出しと重複するため省略可） */}
      {showCompany && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{contact.company}</span>
          </p>
          {isNewContact(contact) && (
            <Badge className="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              NEW
            </Badge>
          )}
        </div>
      )}

      {/* 氏名 */}
      <div className="flex items-center gap-3">
        <Avatar name={contact.name} color={companyColor(contact.company)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-bold">{contact.name}</p>
            {!showCompany && isNewContact(contact) && (
              <Badge className="bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
                NEW
              </Badge>
            )}
          </div>
          <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
            {contact.name_kana || " "}
          </p>
        </div>
      </div>

      {/* 役職・部署 */}
      <p className="mt-2.5 truncate text-xs text-slate-500 dark:text-slate-400">
        {[contact.department, contact.title].filter(Boolean).join(" / ") || "部署・役職 未登録"}
      </p>

      {/* タグ */}
      {contact.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {contact.tags.map((t) => (
            <Badge
              key={t}
              className="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
            >
              #{t}
            </Badge>
          ))}
        </div>
      )}

      {/* フッター: 連絡手段の有無 + 交換日 */}
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
        <Mail className={cn("h-3.5 w-3.5", presence(Boolean(contact.email)))} />
        <Phone
          className={cn("h-3.5 w-3.5", presence(Boolean(contact.phone || contact.mobile)))}
        />
        <CreditCard className={cn("h-3.5 w-3.5", presence(Boolean(contact.card_image_url)))} />
        <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
          <CalendarDays className="h-3.5 w-3.5" />
          {contact.exchanged_at ? formatDate(contact.exchanged_at) : "—"}
        </span>
      </div>
    </Card>
  );
}

/** 連絡手段の登録有無をアイコン色で示す */
function presence(has: boolean): string {
  return has ? "text-emerald-500" : "text-slate-200 dark:text-slate-700";
}
