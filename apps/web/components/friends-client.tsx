"use client";

import { FormEvent, useEffect, useState } from "react";

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

  async function copyInvite() {
    const text = `${window.location.origin} — избери Върколак или Мафия и ми прати кода на стаята.`;
    await navigator.clipboard?.writeText(text);
    setMessage("Поканата е копирана.");
  }

  return (
    <section className="paper-card mt-6 rounded-[2rem] p-6">
      <div className="friends-layout">
        <form className="friend-form" onSubmit={addFriend}>
          <p className="section-kicker text-[#842f2b]">локален списък</p>
          <h2>Добави човек за следващата стая</h2>
          <label>
            <span>Име</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Например: Ники" />
          </label>
          <label>
            <span>Бележка</span>
            <input className="input" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Играе силно като Комисар" />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" type="submit">
              Добави
            </button>
            <button className="btn btn-secondary" type="button" onClick={copyInvite}>
              Копирай покана
            </button>
          </div>
          {message ? <p className="friend-message">{message}</p> : null}
        </form>

        <div className="friend-list">
          {friends.length > 0 ? (
            friends.map((friend) => (
              <article key={friend.id} className="friend-card">
                <div>
                  <strong>{friend.name}</strong>
                  <p>{friend.note || "Без бележка."}</p>
                </div>
                <button type="button" onClick={() => removeFriend(friend.id)} aria-label={`Премахни ${friend.name}`}>
                  махни
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state-card utility-empty compact">
              <span aria-hidden="true" />
              <h2>Списъкът е празен</h2>
              <p>Добави хората, които най-често каниш. Данните стоят само в този браузър.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
