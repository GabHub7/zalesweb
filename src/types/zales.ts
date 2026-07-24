// Core domain types for the Zales workflow automation platform.

import type { Node } from "@xyflow/react";

export type NodeCategory =
  | "trigger"
  | "ai"
  | "integration"
  | "transform"
  | "logic"
  | "memory"
  | "office";

export type NodeKind =
  // Triggers
  | "trigger.manual"
  | "trigger.schedule"
  | "trigger.webhook"
  | "trigger.email"
  | "trigger.whatsapp_gateway"
  | "trigger.whatsapp_meta"
  | "trigger.chat"
  | "trigger.social_message"
  // AI
  | "ai.agent"
  | "ai.chat"
  | "ai.memory"
  | "ai.tool"
  | "ai.image"
  | "ai.video"
  | "ai.vision"
  // Integrations
  | "integration.sheets"
  | "integration.telegram"
  | "integration.file"
  | "integration.http"
  | "integration.social"
  | "integration.social_reply"
  | "integration.leadfinder"
  | "integration.slack"
  | "integration.discord"
  | "integration.notion"
  | "integration.airtable"
  | "integration.email_send"
  | "integration.twilio_sms"
  | "integration.whatsapp_reply"
  | "integration.chat_reply"
  | "integration.supabase_storage"
  | "integration.media_upload"
  | "integration.google_maps_scraper"
  | "integration.youtube_upload"
  | "integration.tiktok_upload"
  | "integration.gamma_generate"
  // Office / RPA
  | "office.excel"
  | "office.word"
  | "office.pptx"
  // Transform
  | "transform.code"
  | "transform.json"
  | "transform.merge"
  | "transform.set"
  | "transform.filter"
  // Logic
  | "logic.if"
  | "logic.switch"
  | "logic.loop"
  | "logic.wait";

export type ExecutionStatus =
  | "idle"
  | "queued"
  | "running"
  | "success"
  | "error";

export interface AIModelConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface NodeParamSchema {
  key: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "slider" | "password" | "code" | "node_multiselect";
  placeholder?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: unknown;
}

export interface NodeDefinition {
  kind: NodeKind;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string; // lucide icon name
  hasInput: boolean;
  hasOutput: boolean;
  params: NodeParamSchema[];
}

export interface ZalesNodeData {
  kind: NodeKind;
  label: string;
  params: Record<string, unknown>;
  status: ExecutionStatus;
  lastOutput?: unknown;
  lastError?: string;
  [key: string]: unknown;
}

export interface RunLogEntry {
  id: string;
  nodeId: string;
  nodeLabel: string;
  status: ExecutionStatus;
  timestamp: number;
  durationMs?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export type ZalesNode = Node<ZalesNodeData>;
