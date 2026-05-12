import { normalizeInstagramHandle } from "@/lib/instagram";

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

function formatFollowers(n: unknown): string | null {
  if (typeof n !== "number" || !isFinite(n) || n < 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M followers`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K followers`;
  return `${n} followers`;
}

type ApifyProfileItem = {
  username?: string;
  fullName?: string | null;
  biography?: string | null;
  followersCount?: number | null;
  profilePicUrl?: string | null;
  profilePicUrlHD?: string | null;
  private?: boolean | null;
  error?: string | null;
  latestPosts?: Array<{ displayUrl?: string | null; type?: string | null }> | null;
};

export async function scrapeInstagramProfile(
  rawHandle: string | null | undefined,
): Promise<InstagramScrapeResult> {
  const handle = normalizeInstagramHandle(rawHandle);
  if (!handle) {
    return { status: "error", handle: null, profile_url: null, error: "No Instagram handle" };
  }
  const profileUrl = `https://www.instagram.com/${handle}/`;

  const token = process.env.APIFY_API_TOKEN;
  if (!token) {
    return { status: "error", handle, profile_url: profileUrl, error: "APIFY_API_TOKEN not configured" };
  }

  try {
    const url = `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}&timeout=90`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [handle] }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        status: "error",
        handle,
        profile_url: profileUrl,
        error: `Apify ${res.status}: ${body.slice(0, 250)}`,
      };
    }

    const items = (await res.json()) as ApifyProfileItem[];
    const item = Array.isArray(items) ? items[0] : null;

    if (!item) {
      return { status: "not_found", handle, profile_url: profileUrl, error: "No data returned" };
    }

    if (item.error) {
      const msg = String(item.error).toLowerCase();
      if (msg.includes("not found") || msg.includes("does not exist")) {
        return { status: "not_found", handle, profile_url: profileUrl, error: item.error };
      }
      return { status: "error", handle, profile_url: profileUrl, error: String(item.error).slice(0, 300) };
    }

    const avatarUrl = item.profilePicUrlHD || item.profilePicUrl || null;
    const displayName = item.fullName ?? null;
    const bio = item.biography ?? null;
    const followersText = formatFollowers(item.followersCount);
    const thumbs = (item.latestPosts ?? [])
      .map((p) => p?.displayUrl)
      .filter((u): u is string => typeof u === "string" && u.length > 0)
      .slice(0, 3);

    if (item.private) {
      return {
        status: "ok",
        handle,
        profile_url: profileUrl,
        avatar_url: avatarUrl,
        display_name: displayName,
        bio,
        followers_text: followersText,
        post_thumbnails: [],
      };
    }

    if (!avatarUrl && !displayName && thumbs.length === 0) {
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
      avatar_url: avatarUrl,
      display_name: displayName,
      bio,
      followers_text: followersText,
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
