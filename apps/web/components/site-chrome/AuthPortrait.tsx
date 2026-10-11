import { ProfilePortrait } from "@/components/ProfilePortrait";
import { avatarIdForUser } from "@/lib/avatar-catalog";

export default function AuthPortrait({ userId, avatarId }: { userId: string; avatarId?: unknown }) {
  return <ProfilePortrait avatarId={avatarIdForUser(userId, avatarId)} decorative />;
}
