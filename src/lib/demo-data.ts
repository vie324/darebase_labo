// デモモード用シードデータの集約。
// 各モジュールのシードは src/lib/demo/ 配下で管理する。

import type { TableMap, TableName } from "./types";
import { DEMO_TEAM } from "./demo/team";
import { DEMO_EVENTS } from "./demo/events";
import { DEMO_DEALS, DEMO_DEAL_ACTIVITIES } from "./demo/deals";
import { DEMO_TASKS } from "./demo/tasks";
import { DEMO_CONTACTS } from "./demo/contacts";
import { DEMO_KNOWLEDGE } from "./demo/knowledge";
import { DEMO_DOCUMENTS } from "./demo/documents";
import { DEMO_SCRIPTS, DEMO_ROLEPLAY_SESSIONS } from "./demo/roleplay";
import { DEMO_TRAININGS } from "./demo/trainings";
import { DEMO_CHANNELS, DEMO_MESSAGES } from "./demo/chat";
import { DEMO_POSTS } from "./demo/posts";
import { DEMO_POLLS } from "./demo/polls";
import { DEMO_MEETING_LOGS } from "./demo/meetings";
import { DEMO_CANDIDATES } from "./demo/recruiting";
import { DEMO_ATTENDANCE, DEMO_EVALUATIONS, DEMO_EXPENSES } from "./demo/backoffice";
import {
  DEMO_ALLIANCE_APPOINTMENTS,
  DEMO_ALLIANCE_BANKS,
  DEMO_ALLIANCE_BRANCHES,
  DEMO_ALLIANCE_DEALS,
  DEMO_ALLIANCE_ORGANIZATIONS,
  DEMO_ALLIANCE_UNIT,
  DEMO_DEAL_PRODUCTS,
  DEMO_PRODUCTS,
} from "./demo/alliance";
import {
  DEMO_COMMISSION_RATES,
  DEMO_INVOICES,
  DEMO_INVOICE_PAYMENTS,
  DEMO_LINE_GROUPS,
  DEMO_MAKER_STATEMENTS,
  DEMO_PARTNERS,
  DEMO_STATEMENT_LINES,
} from "./demo/billing";
import {
  DEMO_APPOINTMENTS,
  DEMO_BANKS,
  DEMO_BRANCHES,
  DEMO_BRANCH_ACTIVITIES,
  DEMO_BUSINESS_UNITS,
  DEMO_ORGANIZATIONS,
} from "./demo/banking";

export const DEMO_DATA: { [K in TableName]: TableMap[K][] } = {
  profiles: DEMO_TEAM,
  events: DEMO_EVENTS,
  deals: [...DEMO_DEALS, ...DEMO_ALLIANCE_DEALS],
  deal_activities: DEMO_DEAL_ACTIVITIES,
  tasks: DEMO_TASKS,
  contacts: DEMO_CONTACTS,
  knowledge: DEMO_KNOWLEDGE,
  documents: DEMO_DOCUMENTS,
  scripts: DEMO_SCRIPTS,
  roleplay_sessions: DEMO_ROLEPLAY_SESSIONS,
  trainings: DEMO_TRAININGS,
  channels: DEMO_CHANNELS,
  messages: DEMO_MESSAGES,
  posts: DEMO_POSTS,
  schedule_polls: DEMO_POLLS,
  partners: DEMO_PARTNERS,
  commission_rates: DEMO_COMMISSION_RATES,
  maker_statements: DEMO_MAKER_STATEMENTS,
  statement_lines: DEMO_STATEMENT_LINES,
  invoices: DEMO_INVOICES,
  invoice_payments: DEMO_INVOICE_PAYMENTS,
  line_groups: DEMO_LINE_GROUPS,
  business_units: [...DEMO_BUSINESS_UNITS, DEMO_ALLIANCE_UNIT],
  organizations: [...DEMO_ORGANIZATIONS, ...DEMO_ALLIANCE_ORGANIZATIONS],
  banks: [...DEMO_BANKS, ...DEMO_ALLIANCE_BANKS],
  branches: [...DEMO_BRANCHES, ...DEMO_ALLIANCE_BRANCHES],
  appointments: [...DEMO_APPOINTMENTS, ...DEMO_ALLIANCE_APPOINTMENTS],
  branch_activities: DEMO_BRANCH_ACTIVITIES,
  // 設定は「未保存 = 既定値」として扱うため、シードは置かない（settings.ts 参照）
  app_settings: [],
  user_invites: [],
  meeting_logs: DEMO_MEETING_LOGS,
  candidates: DEMO_CANDIDATES,
  attendance_records: DEMO_ATTENDANCE,
  expenses: DEMO_EXPENSES,
  evaluations: DEMO_EVALUATIONS,
  products: DEMO_PRODUCTS,
  deal_products: DEMO_DEAL_PRODUCTS,
};

export { DEMO_TEAM };
