import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModel, ImageModel } from "ai";
import type { AIProvider } from "./types";

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: "OpenAI",
  gemini: "Gemini",
};

export function resolveProvider(input: unknown): AIProvider {
  return input === "gemini" ? "gemini" : "openai";
}

export function textModelFor(provider: AIProvider): LanguageModel {
  if (provider === "gemini") return google("gemini-2.5-flash");
  return openai("gpt-4o-mini");
}

export function imageModelFor(provider: AIProvider): ImageModel {
  if (provider === "gemini") return google.image("gemini-2.5-flash-image");
  return openai.image("gpt-image-1");
}

export function providerConfigured(provider: AIProvider) {
  if (provider === "gemini") return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  return Boolean(process.env.OPENAI_API_KEY);
}
