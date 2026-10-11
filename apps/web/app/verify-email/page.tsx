import type { Metadata } from "next";
import { VerifyEmailClient } from "@/components/auth/VerifyEmailClient";
import { verifyEmailIcons } from "@/components/auth/RecoveryIcons";
import { AuthRecoveryStage } from "@/components/auth/AuthRecoveryStage";

export const metadata: Metadata = {
  title: "Потвърди имейла си",
  description: "Потвърди имейла си и продължи към Сенките.",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <AuthRecoveryStage scene="verify-email">
      <VerifyEmailClient icons={verifyEmailIcons} />
    </AuthRecoveryStage>
  );
}
