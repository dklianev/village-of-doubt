"use client";

import { type ComponentProps, type FormEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { normalizeRoomCodeInput, ROOM_CODE_REGEX } from "@werewolf/shared";
import { createBrowserId } from "@/lib/browser-id";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  FRIENDS_STORAGE_KEY, MAX_FRIENDS, MAX_FRIEND_NAME, MAX_FRIEND_NOTE,
  friendNameKey, readFriends, writeFriends, type FriendItem, type FriendsSnapshot,
} from "@/components/friends/friends-storage";
import styles from "@/components/friends/Friends.module.css";

const EMPTY: FriendsSnapshot = { friends: [], raw: null, needsRecovery: false, unavailable: false };

function ActionButton({ icon, children, ...props }: ComponentProps<"button"> & { icon: ReactNode }) {
  // Firefox must not restore a stale disabled state before hydration on reload.
  return <button type="button" {...{ autoComplete: "off" }} className={styles.textButton} {...props}>{icon}{children}</button>;
}

export type FriendsIcons = Record<"ArrowDown" | "BookOpen" | "Check" | "Copy" | "LockKeyhole" | "Minus" | "Pencil" | "Plus" | "RefreshCw" | "Search" | "Sparkle" | "Trash2" | "Undo2" | "X", ReactNode>;

export function FriendsClient({ icons: { ArrowDown, BookOpen, Check, Copy, LockKeyhole, Minus, Pencil, Plus, RefreshCw, Search, Sparkle, Trash2, Undo2, X } }: { icons: FriendsIcons }) {
  const [snapshot, setSnapshot] = useState(EMPTY);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [editBaseline, setEditBaseline] = useState<FriendItem | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<{ friend: FriendItem; index: number; selected: boolean } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [inviteKind, setInviteKind] = useState<"room" | "site">("room");
  const [code, setCode] = useState("");
  const [origin, setOrigin] = useState("");
  const ready = origin !== "";
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const nameInput = useRef<HTMLInputElement>(null);
  const inviteInput = useRef<HTMLTextAreaElement>(null);
  const inviteHeading = useRef<HTMLHeadingElement>(null);
  const allCheckbox = useRef<HTMLInputElement>(null);
  const undoButton = useRef<HTMLButtonElement>(null);
  const keepDraftButton = useRef<HTMLButtonElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  const formTrigger = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyAttempt = useRef(0);
  const friends = snapshot.friends;
  const editingId = editBaseline?.id ?? null;
  const savedEdit = friends.find((friend) => friend.id === editingId);
  const editConflict = editBaseline !== null && !snapshot.unavailable && !snapshot.needsRecovery
    && (!savedEdit || savedEdit.name !== editBaseline.name || savedEdit.note !== editBaseline.note);
  const draftChanged = name !== (editBaseline?.name ?? "") || note !== (editBaseline?.note ?? "");
  const pendingEdit = friends.find((friend) => friend.id === pendingEditId);
  const query = friendNameKey(search);
  const visibleFriends = friends.filter((friend) => friendNameKey(`${friend.name} ${friend.note}`).includes(query));
  const selectedFriends = friends.filter((friend) => selectedIds.has(friend.id));
  const selectedLabel = selectedFriends.length === 1 ? "1 избрано име" : `${selectedFriends.length} избрани имена`;
  const allVisibleSelected = visibleFriends.length > 0 && visibleFriends.every((friend) => selectedIds.has(friend.id));
  const full = friends.length >= MAX_FRIENDS;
  const validCode = ROOM_CODE_REGEX.test(code);
  const prefix = selectedFriends.length ? `${selectedFriends.map((friend) => friend.name).join(", ")},\n` : "";
  const invite = !origin ? "" : inviteKind === "site"
    ? `${prefix}ела да играем в Сенките.\n${origin}`
    : validCode ? `${prefix}ела на масата в Сенките.\nКод: ${code}\n${origin}/lobby/${encodeURIComponent(code)}` : "";

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!formOpen || !dialog) return;
    dialog.showModal();
    // Activity keeps the draft and DOM, but must release the native top layer.
    return () => dialog.close();
  }, [formOpen]);

  useEffect(() => {
    setSnapshot(readFriends());
    setOrigin(window.location.origin);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== FRIENDS_STORAGE_KEY && event.key !== null) return;
      setSnapshot(readFriends());
      setSelectedIds(new Set());
      setMessage("");
      setError("Списъкът е променен в друг раздел. Провери записите, преди да запазиш черновата.");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (allCheckbox.current) allCheckbox.current.indeterminate = !allVisibleSelected && visibleFriends.some((friend) => selectedIds.has(friend.id));
  }, [allVisibleSelected, selectedIds, visibleFriends]);

  useEffect(() => {
    copyAttempt.current += 1;
    setCopyState("idle");
  }, [invite]);

  useEffect(() => {
    if (removed) undoButton.current?.focus();
  }, [removed]);

  useEffect(() => {
    if (formOpen) {
      (pendingEditId ? keepDraftButton.current : nameInput.current)?.focus();
    } else if (formTrigger.current) {
      const trigger = formTrigger.current;
      (trigger.isConnected && !trigger.disabled ? trigger : addButton.current)?.focus();
      formTrigger.current = null;
    }
  }, [formOpen, pendingEditId]);

  function openForm(trigger: HTMLButtonElement) {
    formTrigger.current = trigger;
    setFormOpen(true);
  }

  function persist(next: FriendItem[], recover = false) {
    setError("");
    setMessage("");
    const result = writeFriends(next, snapshot, recover);
    if (result !== "saved") {
      if (result === "changed") {
        setSnapshot(readFriends());
        setSelectedIds(new Set());
      }
      setError(result === "changed" ? "Списъкът е променен в друг раздел. Провери записите и опитай отново."
        : result === "recovery" ? "Първо възстанови валидните записи. Оригиналните данни не са променени."
        : result === "backup" ? "Вече има различно резервно копие. Не променихме нито него, нито текущите данни."
        : "Браузърът не успя да запази промяната. Черновата е тук. Опитай отново.");
      return false;
    }
    setSnapshot({ friends: next, raw: JSON.stringify(next), needsRecovery: false, unavailable: false });
    setSelectedIds((previous) => new Set(next.filter((friend) => previous.has(friend.id)).map((friend) => friend.id)));
    return true;
  }

  function saveFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (pendingEditId || editConflict) return;
    const cleanName = name.trim();
    if (cleanName.length < 2 || cleanName.length > MAX_FRIEND_NAME || note.length > MAX_FRIEND_NOTE) {
      setError(`Името трябва да е от 2 до ${MAX_FRIEND_NAME} символа, а бележката до ${MAX_FRIEND_NOTE}.`);
      return;
    }
    if (friends.some((friend) => friend.id !== editingId && friendNameKey(friend.name) === friendNameKey(cleanName))) {
      setError("Това име вече е в гостовата книга.");
      return;
    }
    if (editingId && !savedEdit) {
      setError("Този запис вече е премахнат. Откажи редакцията, за да добавиш ново име.");
      return;
    }
    if (!editingId && full) { setError(`Гостовата книга е пълна (${MAX_FRIENDS} записа).`); return; }
    const friend = { id: editingId ?? createBrowserId("guest"), name: cleanName, note: note.trim() };
    if (!persist(editingId ? friends.map((item) => item.id === editingId ? friend : item) : [friend, ...friends])) return;
    loadDraft(null);
    setMessage(editingId ? "Промяната е запазена в този браузър." : "Името е добавено в гостовата книга.");
    setFormOpen(false);
  }

  function loadDraft(friend: FriendItem | null) {
    // The edit baseline must survive Activity hide/show and storage refreshes.
    setEditBaseline(friend);
    setPendingEditId(null);
    setName(friend?.name ?? "");
    setNote(friend?.note ?? "");
    setError("");
    setMessage("");
    nameInput.current?.focus();
  }

  function requestEdit(friend: FriendItem) {
    if (friend.id === editingId) {
      setPendingEditId(null);
      nameInput.current?.focus();
    } else if (draftChanged) {
      setPendingEditId(friend.id);
    } else {
      loadDraft(friend);
    }
  }

  function removeFriend(friend: FriendItem) {
    const index = friends.findIndex((item) => item.id === friend.id);
    if (!persist(friends.filter((item) => item.id !== friend.id))) return;
    setRemoved({ friend, index, selected: selectedIds.has(friend.id) });
    setMessage(`${friend.name} е премахнат от гостовата книга.`);
  }

  function undoRemove() {
    if (!removed) return;
    if (full || friends.some((friend) => friend.id === removed.friend.id || friendNameKey(friend.name) === friendNameKey(removed.friend.name))) {
      setError("Освободи място или промени повтарящото се име, преди да възстановиш записа.");
      return;
    }
    const next = [...friends];
    next.splice(Math.min(removed.index, next.length), 0, removed.friend);
    if (!persist(next)) return;
    if (removed.selected) setSelectedIds((previous) => new Set([...previous, removed.friend.id]));
    setMessage(`${removed.friend.name} е възстановен в гостовата книга.`);
    setRemoved(null);
    addButton.current?.focus();
  }

  async function copyInvite() {
    if (!invite) return;
    const attempt = ++copyAttempt.current;
    setCopyState("copying");
    try {
      await copyTextToClipboard(invite);
      if (copyAttempt.current === attempt) setCopyState("copied");
    } catch {
      if (copyAttempt.current !== attempt) return;
      setCopyState("failed");
      inviteInput.current?.focus();
      inviteInput.current?.select();
    }
  }

  const storageNotices = <>
        {snapshot.needsRecovery ? <div className={styles.warning} role="alert">
          <p>Има невалидни, повтарящи се или прекалено дълги записи. Показани са до {MAX_FRIENDS} валидни имена. Оригиналът е непроменен.</p>
          <ActionButton icon={RefreshCw} onClick={() => {
            if (persist(friends, true)) setMessage("Валидните записи са възстановени. Оригиналът е запазен като локално резервно копие.");
          }}>Възстанови с резервно копие</ActionButton>
        </div> : null}
        {snapshot.unavailable ? <div className={styles.warning} role="alert">
          <p>Гостовата книга не е достъпна в този браузър. Не можем да потвърдим запазените данни.</p>
          <ActionButton icon={RefreshCw} onClick={() => setSnapshot(readFriends())}>Провери отново</ActionButton>
        </div> : null}
        {error && !(formOpen && editConflict) ? <p className={styles.error} role="alert">{error}</p> : null}
  </>;

  return (
    <div className={styles.workspace} aria-busy={!ready}>
      <div className={styles.notices}>
        {!formOpen ? storageNotices : null}
        {message ? <p className={styles.message} role="status">{message}</p> : null}
        {removed ? <div className={styles.undo}>
          <span>Премахнато име: {removed.friend.name}</span>
          <ActionButton icon={Undo2} ref={undoButton} onClick={undoRemove}>Върни записа</ActionButton>
        </div> : null}
      </div>

      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="friend-form-title" onCancel={(event) => {
        event.preventDefault(); setFormOpen(false);
      }} onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:enabled, input:enabled, textarea:enabled");
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.target === (event.shiftKey ? first : last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }} onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) setFormOpen(false);
      }}>
      <form className={styles.form} onSubmit={saveFriend} aria-labelledby="friend-form-title" autoComplete="off">
        <header className={styles.dialogHeading}>
          <h2 id="friend-form-title">{Pencil}{editingId ? "Редактирай запис" : "Ново име"}</h2>
          <ActionButton icon={X} className={styles.closeButton} aria-label="Затвори" title="Затвори" onClick={() => setFormOpen(false)} />
        </header>
        {formOpen ? storageNotices : null}
        {pendingEditId ? <section className={styles.warning} aria-label="Незапазена чернова">
          <p role="status">{pendingEdit ? `Имаш незапазена чернова. Да я изхвърлим и да отворим записа на ${pendingEdit.name}?` : "Избраният запис вече е премахнат. Черновата ти е запазена."}</p>
          <div className={styles.actions}>
            <ActionButton icon={Undo2} ref={keepDraftButton} onClick={() => {
              setPendingEditId(null); nameInput.current?.focus();
            }}>Остани в черновата</ActionButton>
            {pendingEdit ? <ActionButton icon={Trash2} onClick={() => loadDraft(pendingEdit)}>Изхвърли черновата</ActionButton> : null}
          </div>
        </section> : null}
        {editConflict ? <section className={styles.warning} aria-label="Конфликт при редакция">
          <p role="alert">{savedEdit ? "Записът е променен в друг раздел. Черновата ти е запазена. Сравни я със запазения запис, преди да продължиш." : "Записът е премахнат. Черновата ти е запазена и можеш да я добавиш като ново име."}</p>
          {savedEdit ? <>
            <dl className={styles.conflictRecord}>
              <dt>Запазено име</dt><dd>{savedEdit.name}</dd>
              <dt>Запазена бележка</dt><dd>{savedEdit.note || "Без бележка"}</dd>
            </dl>
            <p>Ако продължиш с черновата, при следващото запазване тя ще замени показания запис.</p>
            <div className={styles.actions}>
              <ActionButton icon={Pencil} onClick={() => {
                setEditBaseline(savedEdit); setError(""); nameInput.current?.focus();
              }}>Продължи с черновата</ActionButton>
              <ActionButton icon={RefreshCw} onClick={() => loadDraft(savedEdit)}>Използвай запазения запис</ActionButton>
            </div>
          </> : <ActionButton icon={Plus} onClick={() => {
            setEditBaseline(null); setError(""); nameInput.current?.focus();
          }}>Добави като ново име</ActionButton>}
        </section> : null}
        <div className={styles.fields}>
          <label htmlFor="friend-name">Име</label>
          <input id="friend-name" ref={nameInput} className={styles.input} value={name} onChange={(event) => setName(event.target.value)} maxLength={MAX_FRIEND_NAME} autoComplete="off" placeholder="Например: Мила" required minLength={2} disabled={!ready} />
          <label htmlFor="friend-note">Бележка <span className={styles.optional}>(по избор)</span></label>
          <textarea id="friend-note" className={styles.input} value={note} onChange={(event) => setNote(event.target.value)} maxLength={MAX_FRIEND_NOTE} rows={2} placeholder="Обича да е разказвач" disabled={!ready} />
        </div>
        <div className={styles.actions}>
          <ActionButton icon={editingId ? Check : Plus} className="btn btn-primary" type="submit" disabled={!ready || snapshot.needsRecovery || snapshot.unavailable || editConflict || pendingEditId !== null || (!editingId && full)}>
            {editingId ? "Запази промените" : "Добави име"}
          </ActionButton>
          {editingId ? <ActionButton icon={X} onClick={() => loadDraft(null)}>Откажи редакцията</ActionButton> : null}
        </div>
        {full ? <p className={styles.small}>Гостовата книга е пълна: {MAX_FRIENDS} записа.</p> : null}
      </form>
      </dialog>

      <section className={styles.list} aria-labelledby="friend-list-title">
        <header className={styles.listHeader}>
          <div className={styles.headerTitle}>
            <h2 id="friend-list-title">Твоята компания</h2>
            <span className={styles.count}>{ready ? friends.length === 1 ? "1 име" : `${friends.length} имена` : "..."}</span>
          </div>
          <ActionButton icon={Plus} ref={addButton} className={styles.addButton} aria-label="Добави име" title="Добави име" disabled={!ready} onClick={(event) => openForm(event.currentTarget)}>Добави име</ActionButton>
        </header>
        {!ready ? <p className={styles.empty} role="status">Зареждаме гостовата книга...</p>
          : friends.length === 0 ? <div className={styles.empty}>
            {BookOpen}
            <h3>{snapshot.needsRecovery || snapshot.unavailable ? "Няма достъпни записи" : "Още няма вписани имена"}</h3>
            <p>Компанията започва с едно познато лице.</p>
          </div> : <>
            <div className={styles.search}>
              {Search}
              <input aria-label="Търси по име или бележка" type="search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={MAX_FRIEND_NOTE} placeholder="Име или бележка" />
            </div>
            <div className={styles.selection}>
              <label><span className={styles.checkbox}><input ref={allCheckbox} type="checkbox" checked={allVisibleSelected} disabled={visibleFriends.length === 0} onChange={() => setSelectedIds((previous) => {
                const next = new Set(previous);
                for (const friend of visibleFriends) { if (allVisibleSelected) next.delete(friend.id); else next.add(friend.id); }
                return next;
              })} />{Check}{Minus}</span>Избери видимите</label>
              <div className={styles.selectionActions}>
                <span aria-live="polite">{selectedFriends.length > 0 ? selectedLabel : visibleFriends.length === 1 ? "1 име" : `${visibleFriends.length} имена`}</span>
                <ActionButton icon={ArrowDown} disabled={selectedFriends.length === 0} aria-controls="friend-invite-title" onClick={() => {
                  inviteHeading.current?.focus({ preventScroll: true });
                  inviteHeading.current?.scrollIntoView({ block: "start", behavior: "instant" });
                }}>Към поканата</ActionButton>
              </div>
            </div>
            <ul className={styles.entries}>
              {visibleFriends.map((friend) => <li key={friend.id} className={styles.entry} data-selected={selectedIds.has(friend.id)}>
                <span className={styles.checkbox}><input type="checkbox" aria-label={`Избери ${friend.name}`} checked={selectedIds.has(friend.id)} onChange={() => setSelectedIds((previous) => {
                  const next = new Set(previous); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next;
                })} />{Check}</span>
                <span className={styles.monogram} aria-hidden>{Array.from(friend.name.trim())[0]?.toLocaleUpperCase("bg-BG")}</span>
                <div className={styles.entryCopy}><h3>{friend.name}</h3>{friend.note ? <p>{friend.note}</p> : null}</div>
                <ActionButton icon={Pencil} className={styles.iconButton} aria-label={`Редактирай ${friend.name}`} title={`Редактирай ${friend.name}`} onClick={(event) => { openForm(event.currentTarget); requestEdit(friend); }} />
                <ActionButton icon={Trash2} className={styles.iconButton} aria-label={`Премахни ${friend.name}`} title={`Премахни ${friend.name}`} disabled={snapshot.needsRecovery} onClick={() => removeFriend(friend)} />
              </li>)}
            </ul>
            {visibleFriends.length === 0 ? <div className={styles.empty}><h3>Няма съвпадения</h3><ActionButton icon={X} onClick={() => setSearch("")}>Изчисти търсенето</ActionButton></div> : null}
          </>}
        <footer className={styles.privacy}>{LockKeyhole}Само в този браузър</footer>
      </section>

      <section className={styles.invitation} aria-labelledby="friend-invite-title">
        <h2 id="friend-invite-title" ref={inviteHeading} tabIndex={-1}>Покана<span className={styles.ornament}>{Sparkle}</span></h2>
        <fieldset className={styles.segmented}>
          <legend className="sr-only">Вид покана</legend>
          <label><input type="radio" name="invite-kind" checked={inviteKind === "room"} onChange={() => setInviteKind("room")} />Към стая</label>
          <label><input type="radio" name="invite-kind" checked={inviteKind === "site"} onChange={() => setInviteKind("site")} />Към сайта</label>
        </fieldset>
        {inviteKind === "room" ? <label className={styles.codeLabel}>Код на стаята
          <input className={styles.input} value={code} onChange={(event) => setCode(normalizeRoomCodeInput(event.target.value))} disabled={!ready} maxLength={512} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="6 символа" aria-describedby={code && !validCode ? "friend-code-error" : undefined} aria-invalid={Boolean(code && !validCode)} />
          <span className={styles.ornament}>{Sparkle}</span>
        </label> : null}
        {inviteKind === "room" && code && !validCode ? <p className={styles.error} id="friend-code-error">Кодът трябва да е от 6 символа.</p> : null}
        <p className="sr-only">{selectedFriends.length ? `За ${selectedLabel}` : "Обща покана без имена"}{inviteKind === "site" ? ". Без код за стая." : "."}</p>
        {invite ? <div className={styles.inviteField} data-invite={invite}><textarea className={`${styles.input} ${styles.inviteText}`} aria-label="Текст на поканата" readOnly ref={inviteInput} value={invite} rows={4} onFocus={(event) => event.target.select()} /></div>
          : <p className={styles.invitePreview}>{prefix ? `${prefix}ела да играем в Сенките.` : "Ела да играем в Сенките."}</p>}
        <ActionButton icon={copyState === "copied" ? Check : Copy} className="btn btn-primary" onClick={copyInvite} disabled={!invite || copyState === "copying"}>
          {copyState === "copying" ? "Копираме..." : "Копирай поканата"}
        </ActionButton>
        {copyState === "copied" ? <p className={styles.small} role="status">Поканата е копирана.</p> : null}
        {copyState === "failed" ? <p className={styles.error} role="alert">Копирането не успя. Текстът е маркиран за ръчно копиране.</p> : null}
      </section>
    </div>
  );
}
