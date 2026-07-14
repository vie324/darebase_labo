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

export const DEMO_DATA: { [K in TableName]: TableMap[K][] } = {
  profiles: DEMO_TEAM,
  events: DEMO_EVENTS,
  deals: DEMO_DEALS,
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
};

export { DEMO_TEAM };
