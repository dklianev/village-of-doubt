import { Eye, EyeOff, Volume2 } from "lucide-react";

export const CUE_MODES = [
  { value: "silent", label: "Тихо", icon: EyeOff },
  { value: "visual", label: "Визуално", icon: Eye },
  { value: "audio_vibration", label: "Звук и вибрация", icon: Volume2 },
] as const;
