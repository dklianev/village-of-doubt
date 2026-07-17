"use client";

import { FormEvent, useEffect, useState } from "react";
import { Pill } from "@werewolf/ui/server";
import { BookOpen, Check, Copy, Trash2, UserPlus, Users } from "lucide-react";
import { ProfilePortrait } from "@/components/ProfilePortrait";
import { avatarIdForUser } from "@/lib/avatar-catalog";
import { copyTextToClipboard } from "@/lib/clipboard";
import { safeLocalStorage } from "@/lib/safe-storage";
import "@/components/friends/LegacyFriends.module.css";

interface FriendItem {
  id: string;
  name: string;
  note: string;
}

const FRIENDS_STORAGE_KEY = "werewolf-mafia-friends-v1";

export function FriendsClient() {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setFriends(safeLocalStorage.getJson<FriendItem[]>(FRIENDS_STORAGE_KEY) ?? []);
    setIsReady(true);
  }, []);

  function persist(nextFriends: FriendItem[]) {
    setFriends(nextFriends);
    setSelectedIds((prev) => new Set(nextFriends.filter((friend) => prev.has(friend.id)).map((friend) => friend.id)));
    safeLocalStorage.setJson(FRIENDS_STORAGE_KEY, nextFriends);
  }

  function addFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setMessage("Въведи име с поне 2 символа.");
      return;
    }
    if (friends.some((friend) => friend.name.toLocaleLowerCase("bg-BG") === cleanName.toLocaleLowerCase("bg-BG"))) {
      setMessage("Този човек вече е в гостовата книга.");
      return;
    }

    persist([{ id: crypto.randomUUID(), name: cleanName, note: note.trim() }, ...friends]);
    setName("");
    setNote("");
    setMessage("Името е добавено в гостовата книга.");
  }

  function removeFriend(id: string) {
    persist(friends.filter((friend) => friend.id !== id));
  }

  function toggleFriend(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function copyInvite(targets?: FriendItem[]) {
    const selectedFriends = friends.filter((friend) => selectedIds.has(friend.id));
    const targetList = targets ?? (selectedFriends.length > 0 ? selectedFriends : friends);
    const names = targetList.map((friend) => friend.name).join(", ");
    const prefix = names ? `${names}, ` : "";
    const text = `${prefix}${window.location.origin} — избери Върколак или Мафия и ми прати кода на стаята.`;
    try {
      await copyTextToClipboard(text);
      setMessage(targetList.length > 0 ? "Поканата за групата е копирана." : "Поканата е копирана.");
    } catch {
      setMessage("Не успяхме да копираме. Опитай ръчно.");
    }
  }

  const selectedCount = selectedIds.size;
  const reservedLabel = friends.length === 1 ? "1 запазено място" : `${friends.length} запазени места`;
  const selectedLabel = selectedCount === 1 ? "1 избран гост" : `${selectedCount} избрани гости`;

  return (
    <section className="friends-board" aria-label="Гостова книга">
      <div className="friends-ledger-spine" aria-hidden>
        <span />
        <strong>Гостова книга</strong>
        <span />
      </div>
      <div className="friends-layout">
        <form className="friend-form" onSubmit={addFriend} aria-labelledby="friend-form-title">
          <header className="friend-form-head">
            <span className="friend-ledger-mark" aria-hidden>
              <BookOpen strokeWidth={1.7} />
            </span>
            <div>
              <p className="friends-kicker">писалище на домакина</p>
              <h2 id="friend-form-title">Запиши познат за следващата вечер</h2>
            </div>
          </header>
          <div className="friend-form-fields">
            <label>
              <span>Име</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Например: Ники"
                autoComplete="off"
              />
            </label>
            <label>
              <span>Бележка</span>
              <input
                className="input"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Играе силно като Комисар"
                autoComplete="off"
              />
            </label>
          </div>
          <div className="friend-actions">
            <Pill className="friend-action" intent="primary" size="md" shimmer type="submit">
              <UserPlus aria-hidden strokeWidth={1.9} />
              <span>Добави в гостовата книга</span>
            </Pill>
            <Pill
              className="friend-action"
              intent="secondary"
              size="md"
              type="button"
              onClick={() => copyInvite([])}
            >
              <Copy aria-hidden strokeWidth={1.9} />
              <span>Копирай обща покана</span>
            </Pill>
          </div>
          <p className="friend-privacy-note">Записите остават само в този браузър.</p>
          {message ? (
            <p className="friend-message" role="status" aria-live="polite">
              {message}
            </p>
          ) : null}
        </form>

        <section className="friend-list" aria-label="Запазени места">
          <div className="friend-list-head">
            <div>
              <p className="friends-kicker">масата за вечерта</p>
              <h2>
                {!isReady ? "Подреждаме местата" : friends.length > 0 ? "Компанията е вписана" : "Свободни места"}
              </h2>
            </div>
            <div className="friend-list-status" aria-live="polite">
              <span>{isReady ? reservedLabel : "Проверяваме гостовата книга"}</span>
              {isReady && selectedCount > 0 ? <strong>{selectedLabel}</strong> : null}
            </div>
          </div>

          {!isReady ? (
            <div className="friends-list-loading" role="status">
              <span className="sr-only">Зареждаме запазените места...</span>
              {Array.from({ length: 3 }, (_, index) => (
                <span className="friends-skeleton friends-skeleton-row" aria-hidden key={index} />
              ))}
            </div>
          ) : friends.length > 0 ? (
            <>
              <div className="friend-ledger" role="list">
                {friends.map((friend, index) => {
                  const isSelected = selectedIds.has(friend.id);
                  return (
                    <article
                      key={friend.id}
                      className="friend-card"
                      data-selected={isSelected}
                      role="listitem"
                    >
                      <span className="friend-seat-number" aria-hidden>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <button
                        type="button"
                        className="friend-select"
                        onClick={() => toggleFriend(friend.id)}
                        aria-label={isSelected ? `Отмени ${friend.name}` : `Избери ${friend.name}`}
                        aria-pressed={isSelected}
                      >
                        <span className="friend-avatar" aria-hidden>
                          <ProfilePortrait avatarId={avatarIdForUser(friend.id)} decorative />
                        </span>
                        <span className="friend-selection-mark" aria-hidden>
                          {isSelected ? <Check strokeWidth={2.1} /> : null}
                        </span>
                      </button>
                      <div className="friend-card-copy">
                        <h3>{friend.name}</h3>
                        <p>{friend.note || "Без бележка."}</p>
                      </div>
                      <button
                        type="button"
                        className="friend-remove"
                        onClick={() => removeFriend(friend.id)}
                        aria-label={`Премахни ${friend.name}`}
                      >
                        <Trash2 aria-hidden strokeWidth={1.9} />
                      </button>
                    </article>
                  );
                })}
              </div>
              <div className="friend-invite-bar">
                <div>
                  <Users aria-hidden strokeWidth={1.8} />
                  <span>{selectedCount > 0 ? "Подбрана компания" : "Цялата компания"}</span>
                </div>
                <Pill
                  className="friend-action"
                  intent="primary"
                  size="md"
                  shimmer
                  type="button"
                  onClick={() => copyInvite()}
                >
                  <Copy aria-hidden strokeWidth={1.9} />
                  <span>{selectedCount > 0 ? `Покани избрани (${selectedCount})` : "Покани цялата група"}</span>
                </Pill>
              </div>
            </>
          ) : (
            <div className="friends-empty">
              <div className="friends-empty-table" aria-hidden>
                {Array.from({ length: 6 }, (_, index) => (
                  <span key={index} data-seat={index + 1} data-testid="empty-seat" />
                ))}
                <div>
                  <small>запазена маса</small>
                  <strong>06</strong>
                </div>
              </div>
              <div className="friends-empty-copy">
                <p className="friends-kicker">първото име отваря вечерта</p>
                <h2>Масата още чака своята компания</h2>
                <p>Добави хората, които каниш най-често, и остави кратка бележка за стила им.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
