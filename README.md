# Ghostline — AI LinkedIn Ghostwriter

Profile-aware LinkedIn ideation, drafting, and visuals. You give it a LinkedIn URL; it extracts the profile, builds a voice model, generates post ideas, drafts the post in your format of choice, and optionally paints an image — storing everything in reusable JSON.

## Flow

```
LinkedIn URL → extract & store profile → generate ideas →
  pick an idea → pick a format (text / + hashtags / + image) →
  generate post (→ generate image) → saved to history
```

## Stack

- **Next.js 16** App Router + TypeScript + Tailwind v4
- **AI SDK v6** via **Vercel AI Gateway** — one key, swap between `openai/*` and `google/*` models per request
- **JSON file storage** in `/data` (profiles, ideas, posts) — modular `src/lib/storage.ts` so you can drop in Postgres / KV later
- **Image generation** writes PNGs to `/public/generated` and stores the public URL

## Getting started

```bash
cp .env.example .env.local        # add AI_GATEWAY_API_KEY
npm run dev
```

Open http://localhost:3000.

## Model switch

The header toggle selects the provider for the **next** request. Each saved post records which provider produced it. Routing map: [src/lib/ai.ts](src/lib/ai.ts).

| Provider | Text model | Image model |
| --- | --- | --- |
| OpenAI | `openai/gpt-4o-mini` | `openai/gpt-image-1` |
| Gemini | `google/gemini-2.5-flash` | `google/gemini-2.5-flash-image` |

## Profile extraction

LinkedIn blocks scraping, so extraction is **modular** — see [src/lib/profile-extractor.ts](src/lib/profile-extractor.ts). Two strategies ship:

1. **Raw-text grounding** — paste the profile's About / Experience; the LLM structures it faithfully.
2. **URL-only inference** — the LLM builds a plausible profile skeleton from the URL slug for the user to refine.

Swap in Proxycurl, BrightData, Apify, or a headless browser by implementing the same function signature — the rest of the pipeline is untouched.

## Architecture

```
src/
  app/
    page.tsx              # studio UI (profile → ideas → compose → history)
    api/
      profile/route.ts    # POST extract, GET list
      ideas/route.ts      # POST generate, GET list by profile
      post/route.ts       # POST generate (selects format)
      image/route.ts      # POST generate, attach to post
      history/route.ts    # GET saved posts
  components/
    ui.tsx                # Button / Card / Input / Badge / Spinner
    ModelToggle.tsx       # OpenAI ⇄ Gemini toggle
  lib/
    ai.ts                 # provider → model map + helpers
    profile-extractor.ts  # pluggable extraction
    storage.ts            # JSON storage (drop-in replaceable)
    types.ts              # Profile / Idea / Post / Tone
    utils.ts              # cn(), uid()
data/                     # JSON stores (created at first write)
public/generated/         # generated images
```

## Storage shape

`data/profiles.json`, `data/ideas.json`, `data/posts.json` — arrays of the types in [src/lib/types.ts](src/lib/types.ts). Each `GeneratedPost` carries its originating idea, content, hashtags, image URL, provider, and timestamp — everything needed to rehydrate without reprocessing the profile.

## Roadmap hooks (already modular)

- **Scheduling** — add `scheduledFor` to `GeneratedPost`; a cron route (`/api/cron/publish`) drains due posts.
- **A/B testing** — generate N variants per idea, store as siblings, track a `winnerId`.
- **Engagement prediction** — fine-tune the `estimatedEngagement` model on the user's historical posts.
- **Continuous style learning** — append approved posts into the tone prompt; when > 20 exist, distill into a persistent `styleSummary` on the profile.
- **Database** — replace `src/lib/storage.ts` with a driver for Neon / Upstash / any Vercel Marketplace store. No other file changes needed.
