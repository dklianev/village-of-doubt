import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, Mail, MailCheck, Pencil, RefreshCw } from "lucide-react";

export type RecoveryIcons = Record<
  "header" | "success" | "send" | "edit" | "back" | "forward" | "submit" | "show" | "hide" | "retry",
  ReactNode
>;

const back = <ArrowLeft size={16} aria-hidden="true" />;
const forward = <ArrowRight size={18} aria-hidden="true" />;
const send = <Mail size={18} aria-hidden="true" />;
const key = <KeyRound strokeWidth={1.8} />;

// Pages render the SVGs on the server and import only their own client.
export const forgotPasswordIcons = {
  header: key,
  success: <Mail strokeWidth={1.8} />,
  send,
  edit: <Pencil size={18} aria-hidden="true" />,
  back,
};

export const resetPasswordIcons = {
  header: key,
  success: <Check strokeWidth={1.8} />,
  submit: <Check size={18} aria-hidden="true" />,
  show: <Eye size={20} aria-hidden="true" />,
  hide: <EyeOff size={20} aria-hidden="true" />,
  send,
  back,
  forward,
};

export const verifyEmailIcons = {
  header: <MailCheck strokeWidth={1.8} />,
  retry: <RefreshCw size={18} aria-hidden="true" />,
  send,
  back,
  forward,
};
