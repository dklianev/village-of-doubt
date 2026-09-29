import { ForgotPasswordClient } from "../ForgotPasswordClient";
import { ResetPasswordClient } from "../ResetPasswordClient";
import { VerifyEmailClient } from "../VerifyEmailClient";
import { forgotPasswordIcons, resetPasswordIcons, verifyEmailIcons } from "../RecoveryIcons";

export function ForgotPasswordForm() {
  return <ForgotPasswordClient icons={forgotPasswordIcons} />;
}

export function ResetPasswordForm() {
  return <ResetPasswordClient icons={resetPasswordIcons} />;
}

export function VerifyEmailForm() {
  return <VerifyEmailClient icons={verifyEmailIcons} />;
}
