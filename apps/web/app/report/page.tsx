import type { Metadata } from "next";
import { ReportClient } from "@/components/report/ReportClient";

export const metadata: Metadata = {
  title: "Сигнал | Върколак и Мафия",
  description: "Подай сигнал за нарушение, неуместно поведение или авторски права.",
};

export default function ReportPage() {
  return (
    <main className="shell lighthouse-shell">
      <ReportClient />
    </main>
  );
}
