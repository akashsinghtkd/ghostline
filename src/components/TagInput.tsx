"use client";
import { useState } from "react";
import { Input } from "./ui";

export function TagInput({
  label,
  tags,
  suggestions = [],
  placeholder = "Add a tag and press Enter",
  emptyHint,
  onChange,
}: {
  label: string;
  tags: string[];
  suggestions?: string[];
  placeholder?: string;
  emptyHint?: string;
  onChange: (tags: string[]) => void | Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  async function commit(next: string[]) {
    setSaving(true);
    try {
      await onChange(next);
    } finally {
      setSaving(false);
    }
  }

  async function add(raw: string) {
    const t = raw.trim().replace(/^#/, "");
    if (!t) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    await commit([...tags, t]);
    setInput("");
  }

  async function remove(t: string) {
    await commit(tags.filter((x) => x !== t));
  }

  const available = suggestions
    .filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()))
    .slice(0, 8);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</span>
        <span className="text-xs text-zinc-400">
          {saving ? "Saving…" : `${tags.length} active`}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => remove(t)}
            className="group inline-flex items-center gap-1 rounded-full bg-zinc-900 px-3 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            title="Remove"
          >
            {t}
            <span className="opacity-60 group-hover:opacity-100">×</span>
          </button>
        ))}
        {tags.length === 0 && emptyHint && (
          <span className="text-xs text-zinc-400">{emptyHint}</span>
        )}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(input);
          }
        }}
        placeholder={placeholder}
        className="h-9 text-xs"
      />
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {available.map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              className="rounded-full border border-dashed border-zinc-300 px-2.5 py-0.5 text-xs text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:hover:border-white dark:hover:text-white"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const FOCUS_TAG_SUGGESTIONS = [
  "Full-stack developer",
  "Freelance / consulting",
  "React / Next.js",
  "Node.js",
  "TypeScript",
  "Web development",
  "SaaS building",
  "AI / ML",
  "DevOps",
  "Mobile",
  "UX design",
  "Open source",
  "Developer tools",
  "Cloud / infra",
  "Startup founder",
];

export const GOAL_SUGGESTIONS = [
  "Attract freelance clients",
  "Grow reach / followers",
  "Show technical expertise",
  "Share case studies & results",
  "Build in public",
  "Generate inbound leads",
  "Thought leadership",
  "Teach / educate peers",
  "Get hired (full-time)",
  "Signal availability",
];

export const IDEA_FORMAT_SUGGESTIONS = [
  "Problem-solving",
  "User story",
  "Comparison / vs",
  "How-to tutorial",
  "Contrarian take",
  "Lessons learned",
  "Behind the scenes",
  "Case study",
  "Data-driven",
  "Personal anecdote",
  "Myth busting",
  "Framework / mental model",
  "Listicle",
  "Before / after",
];
