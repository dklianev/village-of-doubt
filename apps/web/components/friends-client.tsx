"use client";

import { FormEvent, useEffect, useState } from "react";
import { Check, Copy, Trash2, UserPlus, Users } from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";
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

  useEffect(() => {
    const raw = window.localStorage.getItem(FRIENDS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    try {
      setFriends(JSON.parse(raw) as FriendItem[]);
    } catch {
      setFriends([]);
    }
  }, []);

  function persist(nextFriends: FriendItem[]) {
    setFriends(nextFriends);
    setSelectedIds((prev) => new Set(nextFriends.filter((friend) => prev.has(friend.id)).map((friend) => friend.id)));
    window.localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(nextFriends));
  }

  function addFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setMessage("Въведи име с поне 2 символа.");
      return;
    }
    if (friends.some((friend) => friend.name.toLocaleLowerCase("bg-BG") === cleanName.toLocaleLowerCase("bg-BG"))) {
      setMessage("Този приятел вече е в списъка.");
      return;
    }

    persist([{ id: crypto.randomUUID(), name: cleanName, note: note.trim() }, ...friends]);
    setName("");
    setNote("");
    setMessage("Приятелят е добавен локално.");
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

  return (
    <section className="friends-board">
      <div className="friends-layout">
        <form className="friend-form" onSubmit={addFriend}>
          <p className="friends-kicker">локален списък</p>
          <h2>Добави човек за следващата стая</h2>
          <label>
            <span>Име</span>
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например: Ники"
            />
          </label>
          <label>
            <span>Бележка</span>
            <input
              className="input"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Играе силно като Комисар"
            />
          </label>
          <div className="friend-actions">
            <button className="btn btn-primary" type="submit">
              <UserPlus aria-hidden strokeWidth={1.9} />
              <span>Добави</span>
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => copyInvite([])}>
              <Copy aria-hidden strokeWidth={1.9} />
              <span>Копирай покана</span>
            </button>
          </div>
          {message ? <p className="friend-message">{message}</p> : null}
        </form>

        <div className="friend-list" aria-label="Твоята група">
          <div className="friend-list-head">
            <div>
              <p className="friends-kicker">твоята група</p>
              <h2>{friends.length > 0 ? `${friends.length} души са наблизо` : "Списъкът още чака"}</h2>
            </div>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => copyInvite()}
              disabled={friends.length === 0}
            >
              <Users aria-hidden strokeWidth={1.9} />
              <span>{selectedCount > 0 ? `Покани избрани (${selectedCount})` : "Покани цялата група"}</span>
            </button>
          </div>

          {friends.length > 0 ? (
            friends.map((friend) => (
              <article key={friend.id} className="friend-card" data-selected={selectedIds.has(friend.id)}>
                <button
                  type="button"
                  className="friend-select"
                  onClick={() => toggleFriend(friend.id)}
                  aria-label={selectedIds.has(friend.id) ? `Отмени ${friend.name}` : `Избери ${friend.name}`}
                >
                  {selectedIds.has(friend.id) ? <Check aria-hidden strokeWidth={2.1} /> : null}
                </button>
                <span className="friend-avatar" aria-hidden>
                  {friend.name.trim().charAt(0).toLocaleUpperCase("bg-BG")}
                </span>
                <div className="friend-card-copy">
                  <strong>{friend.name}</strong>
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
            ))
          ) : (
            <div className="friends-empty">
              <h2>Така ще изглежда списъкът ти</h2>
              <p>Добави хората, които най-често каниш. Бележките помагат да помниш стила им.</p>
              <div className="friends-empty-preview" aria-hidden>
                {["Мила", "Петко", "Ники"].map((example) => (
                  <span key={example}>
                    <strong>{example[0]}</strong>
                    <em>{example}</em>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
