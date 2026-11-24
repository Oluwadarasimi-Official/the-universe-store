import Link from "next/link";
export default function Disclosure({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div className="notice disclosure-inline" role="note">
      <span aria-hidden="true">ⓘ</span>
      <span>{compact ? "We may earn a commission from qualifying purchases via links on this page, at no extra cost to you." : text}{" "}<Link href="/affiliate-disclosure">Learn more</Link>.</span>
    </div>
  );
}
