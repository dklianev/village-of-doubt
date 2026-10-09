import { ArrowDown, BookOpen, Check, Copy, LockKeyhole, Minus, Pencil, Plus, RefreshCw, Search, Sparkle, Trash2, Undo2, X } from "lucide-react";
import { FriendsClient } from "@/components/friends-client";

export function FriendsBook() {
  return <FriendsClient icons={{
    ArrowDown: <ArrowDown aria-hidden />,
    BookOpen: <BookOpen aria-hidden />,
    Check: <Check aria-hidden />,
    Copy: <Copy aria-hidden />,
    LockKeyhole: <LockKeyhole aria-hidden />,
    Minus: <Minus aria-hidden />,
    Pencil: <Pencil aria-hidden />,
    Plus: <Plus aria-hidden />,
    RefreshCw: <RefreshCw aria-hidden />,
    Search: <Search aria-hidden />,
    Sparkle: <Sparkle aria-hidden />,
    Trash2: <Trash2 aria-hidden />,
    Undo2: <Undo2 aria-hidden />,
    X: <X aria-hidden />,
  }} />;
}
