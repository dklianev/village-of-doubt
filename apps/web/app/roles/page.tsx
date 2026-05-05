import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Роли | Върколак и Мафия",
  description: "Избери отделната страница с роли за Върколак или Мафия.",
};

export default function RolesPage() {
  redirect("/werewolf/roles");
}
