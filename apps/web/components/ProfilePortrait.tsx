import { avatarPortraitStyle, getAvatarOption } from "@/lib/avatar-catalog";
import styles from "./ProfilePortrait.module.css";

interface ProfilePortraitProps {
  avatarId: unknown;
  className?: string;
  decorative?: boolean;
  muted?: boolean;
}

export function ProfilePortrait({
  avatarId,
  className,
  decorative = false,
  muted = false,
}: ProfilePortraitProps) {
  const option = getAvatarOption(avatarId);
  const classes = className ? `${styles.portrait} ${className}` : styles.portrait;

  return (
    <span
      className={classes}
      style={avatarPortraitStyle(option.id)}
      data-avatar-id={option.id}
      data-muted={muted || undefined}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : option.labelBg}
    />
  );
}
