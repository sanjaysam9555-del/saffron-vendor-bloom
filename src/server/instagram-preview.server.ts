import Firecrawl from "@mendable/firecrawl-js";
import { z } from "zod";
import { normalizeInstagramHandle } from "@/lib/instagram";

export const instagramPreviewSchema = z.object({
  display_name: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  followers_text: z.string().nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
  post_thumbnails: z.array(z.string().url()).nullable().optional(),
});

export type InstagramScrapeResult =
  | {
      status: "ok";
      handle: string;
      profile_url: string;
      avatar_url: string | null;
      display_name: string | null;
      bio: string | null;
      followers_text: string | null;
      post_thumbnails: string[];
    }
  | { status: "not_found"; handle: string; profile_url: string; error?: string }
  | { status: "error"; handle: string | null; profile_url: string | null; error: string };

export async function scrapeInstagramProfile(
  rawHandle: string | null | undefined,
): Promise<InstagramScrapeResult> {
  const handle = normalizeInstagramHandle(rawHandle);
  if (!handle) {
    return { status: "error", handle: null, profile_url: null, error: "No Instagram handle" };
  }
  const profileUrl = `https://www.instagram.com/${handle}/`;

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return { status: "error", handle, profile_url: profileUrl, error: "FIRECRAWL_API_KEY not configured" };
  }

  try {
    const firecrawl = new Firecrawl({ apiKey });
    const result = await firecrawl.scrape(profileUrl, {
      formats: [
        {
          type: "json",
          prompt:
            "Extract the public Instagram profile data. Return display_name (the name shown at the top, not the handle), bio (the profile bio text), followers_text (e.g. '12.4K followers' as displayed), avatar_url (the profile picture URL), and post_thumbnails as an array of the first 3 most recent post image URLs. If the profile is private, blocked, or unavailable, return null for all fields.",
          schema: {
            type: "object",
            properties: {
              display_name: { type: ["string", "null"] },
              bio: { type: ["string", "null"] },
              followers_text: { type: ["string", "null"] },
              avatar_url: { type: ["string", "null"] },
              post_thumbnails: { type: ["array", "null"], items: { type: "string" } },
            },
          },
        },
      ],
      onlyMainContent: false,
      waitFor: 2500,
    });

    const raw = (result as { json?: unknown; data?: { json?: unknown } }).json
      ?? (result as { data?: { json?: unknown } }).data?.json;

    const parsed = instagramPreviewSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        status: "error",
        handle,
        profile_url: profileUrl,
        error: `Invalid scrape payload: ${parsed.error.message.slice(0, 200)}`,
      };
    }

    const data = parsed.data;
    const thumbs = (data.post_thumbnails ?? []).filter(Boolean).slice(0, 3);

    // If we got nothing useful, treat as not_found rather than ok
    if (!data.avatar_url && !data.display_name && thumbs.length === 0) {
      return {
        status: "not_found",
        handle,
        profile_url: profileUrl,
        error: "Profile is private, blocked, or empty",
      };
    }

    return {
      status: "ok",
      handle,
      profile_url: profileUrl,
      avatar_url: data.avatar_url ?? null,
      display_name: data.display_name ?? null,
      bio: data.bio ?? null,
      followers_text: data.followers_text ?? null,
      post_thumbnails: thumbs,
    };
  } catch (error) {
    return {
      status: "error",
      handle,
      profile_url: profileUrl,
      error: error instanceof Error ? error.message.slice(0, 300) : "Unknown scrape error",
    };
  }
}
