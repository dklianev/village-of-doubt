import type { Metadata } from "next";
import { ForgotPasswordClient } from "@/components/auth/ForgotPasswordClient";
import { forgotPasswordIcons } from "@/components/auth/RecoveryIcons";
import { AuthRecoveryStage } from "@/components/auth/AuthRecoveryStage";

export const metadata: Metadata = {
  title: "Забравена парола",
  description: "Възстанови достъпа до профила си в Сенките.",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthRecoveryStage scene="forgot-password">
      <ForgotPasswordClient icons={forgotPasswordIcons} />
    </AuthRecoveryStage>
  );
}
