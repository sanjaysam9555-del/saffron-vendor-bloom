Root cause: Instagram CDN is returning `Cross-Origin-Resource-Policy: same-origin`, so the browser blocks direct `<img>` loads with `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`. Removing `crossOrigin` was not enough.

Plan:
1. Add a public image proxy route under `/api/public/instagram-image` that:
   - Accepts an encoded Instagram CDN image URL.
   - Allows only `cdninstagram.com` / `fbcdn.net` image hosts.
   - Fetches the image server-side and returns it with safe cache headers and an image content type.
2. Update `VendorInstagramPreview.tsx` so avatar and post thumbnail URLs are rendered through that proxy instead of directly from Instagram.
3. Keep the current UI fallback behavior, so broken/private/expired image URLs still fail gracefully.
4. Verify in preview that image requests now hit the local proxy and that display pictures + post thumbnails render in the vendor cards/detail view.