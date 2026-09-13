"use client";

// =============================================================
// 権限管理（経営層のみ）
//
// ロールの割当と、代理店ユーザーの所属組織の紐付け。
// ここでの変更は DB のポリシー（0006_roles_rls.sql）に直結する：
// role_key を変えるとそのユーザーが到達できる行が変わる。
// =============================================================

import { useState } from "react";
import { Mail, ShieldCheck, Trash2, TriangleAlert, UserPlus } from "lucide-react";
import { useCollection } from "@/lib/use-collection";
import { useUser } from "@/lib/use-user";
import { ROLES, ROLE_KEYS, isPartnerRole, normalizeRole, type RoleKey } from "@/lib/roles";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Avatar, Badge, Button, Card, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

/** profiles 行から現在のロールを解決する（role_key 未設定の旧データにも対応） */
function roleOf(p: { role_key?: string; access_level?: string }): RoleKey {
  if (p.role_key) return normalizeRole(p.role_key);
  return p.access_level === "executive" ? "executive" : "member";
}

export function RoleSettingsCard() {
  const profiles = useCollection("profiles");
  const organizations = useCollection("organizations");
  const invites = useCollection("user_invites");
  const { user } = useUser();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleKey>("member");
  const [inviteOrg, setInviteOrg] = useState("");

  const agencies = organizations.items.filter((o) => o.type === "agency");
  const pendingInvites = invites.items.filter((i) => !i.accepted_at);

  const changeRole = async (id: string, name: string, next: RoleKey) => {
    await profiles.update(id, {
      role_key: next,
      // 旧UIの経営層判定（access_level）も合わせて更新しておく
      access_level: next === "executive" ? "executive" : "member",
      // 本部ロールに戻したら組織の紐付けを外す
      ...(isPartnerRole(next) ? {} : { organization_id: null }),
    });
    toast(`${name}さんを「${ROLES[next].label}」に変更しました`, "success");
  };

  const changeOrg = async (id: string, name: string, orgId: string) => {
    await profiles.update(id, { organization_id: orgId === "" ? null : orgId });
    toast(`${name}さんの所属組織を更新しました`, "success");
  };

  const addInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    if (isPartnerRole(inviteRole) && inviteOrg === "") {
      toast("代理店ロールには所属組織の指定が必要です", "error");
      return;
    }
    const expires = new Date();
    expires.setDate(expires.getDate() + 14);
    await invites.add({
      email,
      role_key: inviteRole,
      organization_id: isPartnerRole(inviteRole) ? inviteOrg : null,
      invited_by: user?.name ?? "",
      note: "",
      accepted_at: null,
      expires_at: expires.toISOString(),
    });
    setInviteEmail("");
    toast(`${email} の招待を登録しました`, "success");
  };

  return (
    <>
      {/* ---------- ロールの割当 ---------- */}
      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-cyan-500" />
          <h2 className="font-bold">権限管理</h2>
          <Badge className={ROLES.executive.color}>経営のみ</Badge>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          ロールを変えると、そのユーザーが到達できるデータそのものが変わります
          （データベース側のポリシーで遮断）。代理店ロールには必ず所属組織を設定してください。
        </p>

        <div className="mb-4 grid gap-1.5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500 sm:grid-cols-2 dark:bg-slate-800/50 dark:text-slate-400">
          {ROLE_KEYS.map((key) => (
            <p key={key}>
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {ROLES[key].label}
              </span>
              ： {ROLES[key].description}
            </p>
          ))}
        </div>

        <div className="space-y-3">
          {profiles.items.map((p) => {
            const current = roleOf(p);
            const partner = isPartnerRole(current);
            const orphan = partner && !p.organization_id;
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800"
              >
                <Avatar name={p.name} color={p.color} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="truncate text-xs text-slate-400">{p.email || p.role}</p>
                </div>
                <Select
                  value={current}
                  onChange={(e) => changeRole(p.id, p.name, e.target.value as RoleKey)}
                  className="h-9 w-36 py-1 text-xs"
                >
                  {ROLE_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {ROLES[key].label}
                    </option>
                  ))}
                </Select>
                {partner && (
                  <Select
                    value={p.organization_id ?? ""}
                    onChange={(e) => changeOrg(p.id, p.name, e.target.value)}
                    className="h-9 w-40 py-1 text-xs"
                  >
                    <option value="">組織を選択…</option>
                    {agencies.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </Select>
                )}
                {orphan && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    組織未設定（何も見えません）
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* ---------- 招待 ---------- */}
      <Card className="p-6">
        <div className="mb-3 flex items-center gap-2.5">
          <UserPlus className="h-5 w-5 text-cyan-500" />
          <h2 className="font-bold">アカウント招待</h2>
          <Badge className={ROLES.executive.color}>経営のみ</Badge>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          ここに登録したメールアドレスでアカウントが作られたとき、指定したロールと所属組織が自動で適用されます。
          {isSupabaseConfigured() ? (
            <>
              {" "}
              Supabase ダッシュボードの <b>Authentication</b> で「新規サインアップ」を
              OFF にし、同じ画面の <b>Invite user</b> から招待メールを送ってください。
            </>
          ) : (
            <> ※デモモードでは招待の一覧管理のみ動作します。</>
          )}
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <Field label="メールアドレス" className="min-w-56 flex-1">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </Field>
          <Field label="ロール" className="w-40">
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as RoleKey)}
            >
              {ROLE_KEYS.map((key) => (
                <option key={key} value={key}>
                  {ROLES[key].label}
                </option>
              ))}
            </Select>
          </Field>
          {isPartnerRole(inviteRole) && (
            <Field label="所属組織" className="w-44">
              <Select value={inviteOrg} onChange={(e) => setInviteOrg(e.target.value)}>
                <option value="">選択…</option>
                {agencies.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Button size="sm" onClick={addInvite} disabled={inviteEmail.trim() === ""}>
            <Mail className="h-4 w-4" />
            招待を登録
          </Button>
        </div>

        {pendingInvites.length === 0 ? (
          <p className="text-sm text-slate-400">未使用の招待はありません。</p>
        ) : (
          <div className="space-y-2">
            {pendingInvites.map((i) => {
              const org = organizations.items.find((o) => o.id === i.organization_id);
              return (
                <div key={i.id} className="flex items-center gap-2.5 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-slate-300" />
                  <span className="min-w-0 flex-1 truncate">{i.email}</span>
                  <Badge className={ROLES[normalizeRole(i.role_key)].color}>
                    {ROLES[normalizeRole(i.role_key)].label}
                  </Badge>
                  {org && <span className="text-xs text-slate-400">{org.name}</span>}
                  <button
                    onClick={() => invites.remove(i.id)}
                    aria-label="招待を取り消す"
                    className="cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
