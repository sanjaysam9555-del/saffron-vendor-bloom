## Update vendor signup success card

After a vendor successfully submits the signup form, the success card currently shows two buttons: "Submit another vendor" and "Back to homepage". We'll remove both and replace them with an Instagram follow call-to-action pointing to `@the_saffronevents`.

### Changes

**`src/components/vendor/VendorSignupSuccess.tsx`**
- Remove the "Submit another vendor" button and the "Back to homepage" `Link`.
- Remove the now-unused `onSubmitAnother` prop and the `Link` import from `@tanstack/react-router`.
- Add a friendly line below the existing copy: "While you're here, follow us on Instagram for updates and inspiration."
- Add a single CTA button (anchor with `target="_blank"` and `rel="noopener noreferrer"`) linking to `https://instagram.com/the_saffronevents`.
  - Styled with the existing terracotta primary look used by the previous primary button.
  - Includes a small Instagram icon (from `lucide-react`, already used in the project) and the label "Follow @the_saffronevents on Instagram".

**`src/routes/vendor-signup.tsx`**
- Remove the `onSubmitAnother` prop being passed into `<VendorSignupSuccess />`.
- Remove the now-unused reset handler if it isn't referenced elsewhere (keep the `submitted` state since the success card still depends on it).

### Out of scope
- No changes to the checkmark animation, headline, or card layout/spacing.
- No changes to the form, duplicate detection, or submission flow.
- No new routes, dependencies, or backend changes.
