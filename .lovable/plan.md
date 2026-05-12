## Problem

Data is being fetched and stored correctly — the database has valid `avatar_url` and `post_thumbnails` for vendors (verified via direct query). Name, bio, and follower count render because they are plain text, but the images fail to load and `SafeImg` hides them via its `onError` fallback.

## Root cause

In `src/components/vendor/VendorInstagramPreview.tsx`, the `SafeImg` component sets:

```tsx
crossOrigin="anonymous"
```

Instagram's CDN (`scontent-*.cdninstagram.com`) does **not** return `Access-Control-Allow-Origin` headers. When the browser sees `crossOrigin="anonymous"`, it makes a CORS request and rejects the response, firing `onError` — which causes `SafeImg` to render `null`. That is why every image disappears while text fields remain.

The existing `referrerPolicy="no-referrer"` is correct and necessary (Instagram blocks hotlinks with a referrer). We just must not opt into CORS for these images.

## Fix

Remove the `crossOrigin="anonymous"` attribute from `SafeImg` in `src/components/vendor/VendorInstagramPreview.tsx`. Keep `referrerPolicy="no-referrer"`, `loading="lazy"`, and the `onError` fallback as-is.

That single change restores the avatar and the 3 post thumbnails in both the card strip and the detail drawer. No backend, schema, or scraper changes needed.

## Verification

After the edit, open a vendor detail drawer for a vendor that already has a cached `ok` preview — avatar and post tiles should appear immediately (no need to refresh the preview).
