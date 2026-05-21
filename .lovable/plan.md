## Plan

Fix the attachment viewer so video files that exist in storage reliably play, and make missing-file cases clear instead of looking like a playback bug.

### What I found
- Recent uploaded MP4 attachments mostly do exist in storage and should be playable.
- Two older MP4 attachment records for **DJ Prince Music** point to storage objects that no longer exist, so those will correctly produce “File not found” until re-uploaded or cleaned up.
- The current video viewer relies directly on a short-lived signed storage URL inside `<video>`, which can still fail in browsers due to signed URL / range / CORS behavior.

### Changes to implement
1. **Route video playback through an app-controlled streaming endpoint**
   - Add a server route that accepts a signed token or file path request, verifies the user can access the attachment, and streams the file from private storage.
   - Support `Range` requests so MP4 metadata loading, seeking, and browser video playback work properly.

2. **Use the streaming endpoint for videos only**
   - Keep PDFs/images using the current preview behavior.
   - Update `SignedDocumentViewer` and `SignedQuoteFileViewer` so when the file is a video, the viewer receives a same-origin stream URL instead of a raw storage signed URL.

3. **Improve the viewer error state**
   - Distinguish between:
     - missing storage object: “File not found. Please re-upload this attachment.”
     - unsupported codec/browser playback issue: “Download or open in new tab.”
   - Keep download/open actions available when a URL exists.

4. **Clean stale attachment records**
   - For the two DJ Prince Music MP4 records whose storage files are missing, either hide them automatically in the UI or remove the stale database rows via migration/query if you approve cleanup.

### Validation
- Test with a recent MP4 attachment that exists in storage.
- Confirm the browser requests the stream endpoint successfully and the video plays inline.
- Confirm missing file records show a clear missing-file message instead of a generic playback error.