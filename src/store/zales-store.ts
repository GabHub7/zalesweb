"use client";

import { create } from "zustand";
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  Edge,
  EdgeChange,
  NodeChange,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { NodeKind, RunLogEntry, ExecutionStatus, ZalesNode } from "@/types/zales";
import { NODE_REGISTRY } from "@/lib/node-registry";
import { apiUrl } from "@/lib/api-base";
import { persistThemeCookie } from "@/lib/theme-cookie";

export type { ZalesNode };

interface ZalesState {
  nodes: ZalesNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  theme: "light" | "dark";
  runLog: RunLogEntry[];
  isRunning: boolean;
  currentWorkflowId: string | null;
  currentWorkflowName: string;
  isDirty: boolean;
  isSaving: boolean;

  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addNode: (kind: NodeKind, position: { x: number; y: number }) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  updateNodeParam: (id: string, key: string, value: unknown) => void;
  updateNodeLabel: (id: string, label: string) => void;
  setNodeStatus: (id: string, status: ExecutionStatus) => void;

  toggleTheme: () => void;

  appendLog: (entry: RunLogEntry) => void;
  clearLog: () => void;
  setRunning: (running: boolean) => void;

  resetWorkflow: () => void;
  loadWorkflow: (id: string, name: string, nodes: ZalesNode[], edges: Edge[]) => void;
  setWorkflowName: (name: string) => void;
  markSaved: (id: string) => void;
  saveWorkflow: () => Promise<void>;
  userSettings: Record<string, string>;
  fetchUserSettings: () => Promise<boolean>;
  saveUserSettings: (settings: Record<string, string>) => Promise<boolean>;
}

function initialTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export const useZalesStore = create<ZalesState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  theme: initialTheme(),
  runLog: [],
  isRunning: false,
  currentWorkflowId: null,
  currentWorkflowName: "Untitled workflow",
  isDirty: false,
  isSaving: false,
  userSettings: {},

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as ZalesNode[], isDirty: true });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges), isDirty: true });
  },
  onConnect: (connection) => {
    set({
      edges: addEdge(
        { ...connection, type: "zalesEdge" },
        get().edges
      ),
      isDirty: true,
    });
  },

  addNode: (kind, position) => {
    const def = NODE_REGISTRY[kind];
    const defaultParams: Record<string, unknown> = {};
    for (const p of def.params) {
      if (p.defaultValue !== undefined) defaultParams[p.key] = p.defaultValue;
    }
    const id = nanoid(8);
    const newNode: ZalesNode = {
      id,
      type: "zalesNode",
      position,
      data: {
        kind,
        label: def.label,
        params: defaultParams,
        status: "idle",
      },
    };
    set({ nodes: [...get().nodes, newNode], selectedNodeId: id, isDirty: true });
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: get().selectedNodeId === id ? null : get().selectedNodeId,
      isDirty: true,
    });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeParam: (id, key, value) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, params: { ...n.data.params, [key]: value } } }
          : n
      ),
      isDirty: true,
    });
  },

  updateNodeLabel: (id, label) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      ),
      isDirty: true,
    });
  },

  setNodeStatus: (id, status) => {
    set({
      nodes: get().nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, status } } : n
      ),
    });
  },

  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    persistThemeCookie(next);
    set({ theme: next });
  },

  appendLog: (entry) => set({ runLog: [...get().runLog, entry] }),
  clearLog: () => set({ runLog: [] }),
  setRunning: (running) => set({ isRunning: running }),

  resetWorkflow: () =>
    set({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      runLog: [],
      currentWorkflowId: null,
      currentWorkflowName: "Untitled workflow",
      isDirty: false,
    }),

  loadWorkflow: (id, name, nodes, edges) =>
    set({
      currentWorkflowId: id,
      currentWorkflowName: name,
      nodes,
      edges,
      selectedNodeId: null,
      runLog: [],
      isDirty: false,
    }),

  setWorkflowName: (name) => set({ currentWorkflowName: name, isDirty: true }),

  markSaved: (id) => set({ currentWorkflowId: id, isDirty: false }),

  saveWorkflow: async () => {
    const { currentWorkflowId, currentWorkflowName, nodes, edges } = get();
    set({ isSaving: true });
    try {
      if (currentWorkflowId) {
        const res = await fetch(apiUrl(`/api/workflows/${currentWorkflowId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: currentWorkflowName, nodes, edges }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
        set({ isDirty: false });
      } else {
        const res = await fetch(apiUrl("/api/workflows"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name: currentWorkflowName, nodes, edges }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
        const created = await res.json();
        set({ currentWorkflowId: created.id, isDirty: false });
      }
    } finally {
      set({ isSaving: false });
    }
  },

  fetchUserSettings: async () => {
    try {
      const res = await fetch(apiUrl("/api/user/settings"), { credentials: "include" });
      if (res.ok) {
        const settings = await res.json();
        set({ userSettings: settings });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  saveUserSettings: async (settings) => {
    try {
      const res = await fetch(apiUrl("/api/user/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        const updated = await res.json();
        set({ userSettings: updated });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },
}));
