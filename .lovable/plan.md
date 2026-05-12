## Problem
The latest fallback fix is too aggressive: when role lookup is briefly unavailable after sign-in, the app treats that as a definitive failure and calls `signOut()`. That explains the sequence you see: sign-in succeeds, the button turns green, then a logout toast appears and the user stays on the login screen.

## Plan
1. **Remove automatic sign-out from role-resolution failures**
   - Update `src/routes/index.tsx`, `src/components/AuthGate.tsx`, and `src/components/ClientGate.tsx` so they no longer call `signOut()` just because role lookup failed.
   - Replace that behavior with a safe redirect/fallback state instead of destroying the valid login session.

2. **Make role loading retry instead of failing once**
   - Update `src/lib/auth.tsx` so `loadProfile()` retries `getCurrentUserAccess()` a few times after sign-in/session restore before declaring role lookup failed.
   - Clear `roleResolutionFailed` at the start of every sign-in/profile refresh so stale failure state cannot immediately kick the user back.
   - Keep cached roles usable while a fresh role check is in flight.

3. **Stop showing misleading logout notifications for system cleanup**
   - Adjust `signOut()` to support a silent/system sign-out option for internal recovery cases.
   - User-initiated logout will still show the normal success notification.

4. **Fix the auth server function so missing role rows don’t strand clients**
   - Update `src/server/auth.functions.ts` to return the real role when found.
   - If no role row exists, use an email/domain-safe fallback only where appropriate instead of defaulting every user to staff or returning no usable role.

5. **Validate the fix**
   - Check the relevant auth flow signals: no immediate logout after sign-in, role lookup has retries, and gates no longer trap users behind the splash/login screen.

## Technical notes
- The key regression is the new `roleResolutionFailed -> signOut()` path.
- The fix keeps the session intact and treats role resolution as recoverable, not as proof the credentials are invalid.