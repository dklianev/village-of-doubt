import type { ChatChannel } from "@werewolf/shared";
import { TypingIndicator } from "@/components/play/TypingIndicator";
import { privateChannelBg } from "@/lib/play/copy";
import type { PrivateChatMessage, TypingNotice } from "@/lib/play/types";

export function PrivateChatPanel({
  channel,
  messages,
  value,
  setValue,
  sendPrivateChat,
  typingNotices,
}: {
  channel: ChatChannel;
  messages: PrivateChatMessage[];
  value: string;
  setValue: (value: string) => void;
  sendPrivateChat: (channel: ChatChannel) => void;
  typingNotices: TypingNotice[];
}) {
  return (
    <section className="ritual-panel mt-8 rounded-[2rem] p-6">
      <p className="section-kicker">{privateChannelBg(channel)}</p>
      <h2 className="mt-2 text-3xl font-black">Таен канал</h2>
      <div className="mt-4 grid gap-2 text-sm">
        {messages.slice(-6).map((message) => (
          <p key={`${message.createdAt}-${message.senderUserId}`} className="rounded-xl bg-[#f4e8d1]/10 px-3 py-2">
            <strong>{message.senderName}:</strong> {message.message}
          </p>
        ))}
        <TypingIndicator notices={typingNotices} compact />
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="input w-full"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Съобщение само за този канал..."
        />
        <button className="btn btn-primary" type="button" onClick={() => sendPrivateChat(channel)}>
          Изпрати
        </button>
      </div>
    </section>
  );
}
