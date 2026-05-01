import { Link } from "@tanstack/react-router";

interface VendorSignupSuccessProps {
  onSubmitAnother: () => void;
  vendorName: string;
}

export function VendorSignupSuccess({ onSubmitAnother, vendorName }: VendorSignupSuccessProps) {
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

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          onClick={onSubmitAnother}
          className="inline-flex items-center justify-center rounded-md bg-[var(--terracotta)] px-5 py-2.5 text-sm font-medium text-[var(--cream)] transition-all hover:-translate-y-0.5 hover:bg-[var(--terracotta)]/90"
        >
          Submit another vendor
        </button>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--charcoal)]/75 transition-colors hover:border-[var(--terracotta)] hover:text-[var(--terracotta)]"
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
