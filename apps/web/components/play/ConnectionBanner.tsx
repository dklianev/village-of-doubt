import type { ConnectionStatus } from "@/lib/play/types";

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
  };

  return (
    <div
      className={`connection-banner connection-${status} mb-6 p-4 text-[#fff6e5]`}
      role={status === "error" ? "alert" : "status"}
      aria-live={status === "error" ? "assertive" : "polite"}
      aria-busy={status === "connecting" || status === "reconnecting"}
    >
      <strong className="block">{title[status]}</strong>
      <span className="mt-1 block text-sm text-[#ead9ba]">{message}</span>
    </div>
  );
}
