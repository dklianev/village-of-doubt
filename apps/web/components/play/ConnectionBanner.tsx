import type { ConnectionStatus } from "@/lib/play/types";
import { WifiOff } from "lucide-react";
import "./ConnectionBanner.module.css";

export function ConnectionBanner({ status, message }: { status: ConnectionStatus; message: string }) {
  if (status === "connected") {
    return null;
  }

  const title: Record<ConnectionStatus, string> = {
    connecting: "Свързване със стаята",
    connected: "Свързан",
    reconnecting: "Връзката се възстановява",
    disconnected: "Напусна стаята",
    lost: "Връзката остана прекъсната",
    error: "Проблем със свързването",
    closed: "Стаята е затворена",
  };
  const urgent = status === "error" || status === "closed";

  return (
    <div
      className={`connection-banner connection-${status}`}
      role={urgent ? "alert" : "status"}
      aria-live={urgent ? "assertive" : "polite"}
      aria-busy={status === "connecting" || status === "reconnecting"}
    >
      <WifiOff size={20} aria-hidden />
      <div><strong>{title[status]}</strong><p>{message}</p></div>
    </div>
  );
}
