import { ArrowUp } from "lucide-react";

export function LegalReturnLink({ page }: { page: "privacy" | "terms" }) {
  return <a className="legal-return-link" href={`#${page}-contents`}>
    <ArrowUp size={16} aria-hidden="true" /> Към съдържанието
  </a>;
}
