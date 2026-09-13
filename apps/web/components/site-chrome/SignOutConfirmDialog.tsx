"use client";

import { Dialog } from "@werewolf/ui";
import { LogOut, X } from "lucide-react";

export function SignOutConfirmDialog({
  userName,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  userName: string;
  pending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) {
          onCancel();
        }
      }}
      title="Излизаш ли от масата?"
      description={`Здрасти, ${userName}. Сесията ще се затвори и ще се върнеш на началната страница.`}
      footer={
        <>
          <button type="button" className="signout-modal-cancel" onClick={onCancel} disabled={pending}>
            Отказ
          </button>
          <button type="button" className="signout-modal-confirm" onClick={onConfirm} disabled={pending}>
            {pending ? "Излизане..." : error ? "Опитай отново" : "Излизам"}
          </button>
        </>
      }
    >
      <div className="signout-modal-head">
        <button type="button" className="signout-modal-close" onClick={onCancel} aria-label="Затвори" disabled={pending}>
          <X aria-hidden strokeWidth={2} />
        </button>
        <span className="signout-modal-icon" aria-hidden>
          <LogOut strokeWidth={1.8} />
        </span>
      </div>
      {error ? <p className="signout-modal-error" role="alert">{error}</p> : null}
    </Dialog>
  );
}
