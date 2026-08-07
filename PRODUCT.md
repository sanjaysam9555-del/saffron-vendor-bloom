# Product

## Register

product

## Users

Saffron Events' own staff planners (admins and employees) are the primary day-to-day users, managing 500+ vendors across 14+ categories and many concurrent weddings. They work from a desk during office hours, but also check and update things from a phone between vendor calls or while on site visits, so every admin workflow has to hold up on mobile, not just desktop. Couples (clients) are a secondary but meaningful audience through the `/client` portal, checking their own wedding's vendors, quotes, tasks, and payments without having to ask staff directly.

## Product Purpose

Saffron Planning Studio replaces a messy, inconsistent Google Sheet that staff used to track 500+ vendors across 14 categories with no unified view. It exists so staff can add, search, filter, and manage vendors, projects, quotes, tasks, and payments in one place, and so couples can check their own wedding's status without asking. Success looks like three things together: staff never touch the old spreadsheet again, coordination overhead drops (less time chasing vendor status, quotes, and tasks across scattered channels), and clients come away from the portal feeling informed and reassured about their wedding, not confused.

## Brand Personality

Elegant, warm, and trustworthy, with a touch of editorial luxury: a premium boutique studio feel, not a cold enterprise tool. This should read consistently across the product, but weighted differently by surface. The internal `/admin` tooling can lean more toward efficient and precise, since staff need speed and clarity, especially under deadline pressure. The couple-facing `/client` portal deserves brand-level polish and warmth: it's effectively the client's window into the studio's craft and taste, not just a status page.

## Anti-references

No strict anti-reference called out. The existing terracotta/cream/charcoal identity, paired with Cormorant Garamond display type, is the right direction: keep extending it rather than reinventing it. General product-register instincts still apply by default: don't let it drift into reading like a generic, indistinguishable SaaS admin panel.

## Design Principles

1. **Admin efficiency, client warmth.** Same visual language throughout, but `/admin` optimizes for staff speed and information density, while `/client` optimizes for reassurance and clarity for a non-expert, emotionally invested audience.
2. **Mobile is not an afterthought.** Staff work in the field, not just at a desk. Every admin surface needs to hold up on a phone, not just degrade gracefully.
3. **One role, one truth.** Never let ambiguity into who's staff vs. client, what stage a task, quote, or payment is in, or what a number means. Wedding logistics have zero tolerance for confusion.
4. **Extend the existing identity, don't reinvent it.** Terracotta / cream / charcoal + Cormorant Garamond / Jost is the established brand. New surfaces should feel like they were always part of it.
5. **Show the couple the craft, not the machinery.** The client portal should feel like a curated, editorial view into their wedding, not a raw export of the internal database.

## Accessibility & Inclusion

Standard WCAG AA baseline: solid color contrast, adequate touch targets, full keyboard operability, and honoring `prefers-reduced-motion`. No specific known accessibility needs beyond that baseline today.

## Notes

A separate, standalone marketing site (e.g. planwithsaffron.in) exists or is planned outside this codebase. This repository stays scoped to product: the internal admin tool and the client portal. The public login page's SEO metadata should stay accurate for that reason, but no marketing/landing surface belongs inside this app.
