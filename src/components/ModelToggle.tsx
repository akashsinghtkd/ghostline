"use client";
import type { AIProvider } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ModelToggle({
  provider,
  onChange,
}: {
  provider: AIProvider;
  onChange: (p: AIProvider) => void;
}) {
  const options: { value: AIProvider; label: string }[] = [
    { value: "openai", label: "OpenAI" },
    { value: "gemini", label: "Gemini" },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1 text-xs dark:border-zinc-800 dark:bg-zinc-900">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-3 py-1.5 font-medium transition-colors",
            provider === o.value
              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
