import { Instagram } from "lucide-react";

interface VendorSignupSuccessProps {
  vendorName: string;
}

export function VendorSignupSuccess({ vendorName }: VendorSignupSuccessProps) {
  return (
    <div className="vendor-success-card animate-scale-in rounded-2xl border border-[var(--border)] bg-white p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center sm:h-28 sm:w-28">
        <svg
          className="vendor-success-check h-full w-full"
          viewBox="0 0 80 80"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle
            className="vendor-success-check__circle"
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="var(--terracotta)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            className="vendor-success-check__tick"
            d="M24 41.5 L36 53 L57 30"
            fill="none"
            stroke="var(--terracotta)"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <h2 className="font-display text-3xl font-semibold text-[var(--charcoal)] sm:text-4xl">
        Thank you{vendorName ? `, ${vendorName}` : ""}!
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-[var(--charcoal)]/70 sm:text-base">
        We've received your details. Our team will review your profile and reach out shortly.
      </p>
      <p className="mx-auto mt-4 max-w-md text-sm text-[var(--charcoal)]/65 sm:text-base">
        While you're here, follow us on Instagram for updates and inspiration.
      </p>

      <div className="mt-8 flex items-center justify-center">
        <a
          href="https://instagram.com/the_saffronevents"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--terracotta)] px-5 py-2.5 text-sm font-medium text-[var(--cream)] transition-all hover:-translate-y-0.5 hover:bg-[var(--terracotta)]/90"
        >
          <Instagram className="h-4 w-4" />
          Follow @the_saffronevents on Instagram
        </a>
      </div>
    </div>
  );
}
