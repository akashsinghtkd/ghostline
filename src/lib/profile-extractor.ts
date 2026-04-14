import { generateObject } from "ai";
import { z } from "zod";
import { textModelFor } from "./ai";
import { uid } from "./utils";
import type { AIProvider, LinkedInProfile } from "./types";

const ProfileSchema = z.object({
  name: z.string(),
  headline: z.string(),
  location: z.string().nullable(),
  about: z.string(),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      duration: z.string().nullable(),
      description: z.string().nullable(),
    }),
  ),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
    }),
  ),
  skills: z.array(z.string()),
  activity: z.array(z.string()),
  tone: z.object({
    voice: z.string(),
    formality: z.enum(["casual", "balanced", "formal"]),
    themes: z.array(z.string()),
    audience: z.string(),
    industry: z.string(),
  }),
});

function slugFromUrl(url: string) {
  const m = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return m ? decodeURIComponent(m[1]).replace(/[-_]/g, " ") : url;
}

/**
 * Modular profile extraction. Strategy order:
 *  1. If `rawText` is provided (user pasted the public profile body), use it as ground truth.
 *  2. Otherwise infer a plausible structured profile from the URL slug using an LLM.
 *
 * In production this is where you'd plug in Proxycurl, BrightData, or Apify.
 * The function signature stays stable so the rest of the pipeline doesn't change.
 */
export async function extractProfile({
  url,
  rawText,
  provider,
}: {
  url: string;
  rawText?: string;
  provider: AIProvider;
}): Promise<LinkedInProfile> {
  const model = textModelFor(provider);
  const slug = slugFromUrl(url);

  const system = `You are a LinkedIn profile parser and brand-voice analyst.
Return a complete structured profile. If raw profile text is supplied, ground every field in it.
If only the URL/slug is supplied, infer a realistic, professional placeholder profile that the user can refine — do NOT invent specific employer names that look like real companies; prefer generic descriptors like "Series B fintech" or "global consulting firm".
Always derive the tone block: voice (1 sentence), formality, 3-6 recurring themes, primary audience, industry.`;

  const prompt = rawText
    ? `LinkedIn URL: ${url}\n\nRaw profile text:\n"""${rawText.slice(0, 12_000)}"""`
    : `LinkedIn URL: ${url}\nSlug interpretation: ${slug}\nNo raw text supplied — infer a realistic professional profile from the slug only.`;

  const { object } = await generateObject({
    model,
    schema: ProfileSchema,
    system,
    prompt,
  });

  const now = new Date().toISOString();
  const stripNull = <T>(v: T | null): T | undefined => (v === null ? undefined : v);
  return {
    id: uid("prof"),
    url,
    name: object.name,
    headline: object.headline,
    location: stripNull(object.location),
    about: object.about,
    experience: object.experience.map((e) => ({
      title: e.title,
      company: e.company,
      duration: stripNull(e.duration),
      description: stripNull(e.description),
    })),
    education: object.education.map((e) => ({
      school: e.school,
      degree: stripNull(e.degree),
      field: stripNull(e.field),
    })),
    skills: object.skills,
    activity: object.activity,
    focusTags: [],
    ideaFormats: [],
    goals: [],
    tone: object.tone,
    createdAt: now,
    updatedAt: now,
  };
}
