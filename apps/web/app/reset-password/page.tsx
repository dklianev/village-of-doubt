import type { Metadata } from "next";
import { ResetPasswordClient } from "@/components/auth/ResetPasswordClient";
import { resetPasswordIcons } from "@/components/auth/RecoveryIcons";
import { AuthRecoveryStage } from "@/components/auth/AuthRecoveryStage";

export const metadata: Metadata = {
  title: "Нова парола",
  description: "Избери нова парола за профила си в Сенките.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthRecoveryStage scene="reset-password">
      <ResetPasswordClient icons={resetPasswordIcons} />
    </AuthRecoveryStage>
  );
}
