import { describe, expect, it } from "vitest";
import { FAQ_DATA } from "@/lib/faq-data";

describe("FAQ production contact copy", () => {
  it("does not expose placeholder addresses or internal publishing notes", () => {
    const serialized = JSON.stringify(FAQ_DATA);

    expect(serialized).not.toMatch(/example\.com/i);
    expect(serialized).not.toMatch(/заменете преди публикуване/i);
    expect(serialized).toContain("support@senkite.com");
    expect(serialized).toContain("privacy@senkite.com");
  });

  it("describes reconnect without promising that an expired turn can be recovered", () => {
    const serialized = JSON.stringify(FAQ_DATA);

    expect(serialized).toContain("мястото ти, ролята и текущата фаза");
    expect(serialized).toContain("Ако таймерът вече е изтекъл");
    expect(serialized).not.toContain("Не пропускаш ходове");
  });

  it("matches current game limits, room lifetime, and product policy", () => {
    const serialized = JSON.stringify(FAQ_DATA);

    expect(serialized).toContain("Свободна Мафия започва от 4 души, а Върколак — от 6");
    expect(serialized).toContain("90 секунди");
    expect(serialized).toContain("до 5 минути");
    expect(serialized).toContain("38 роли");
    expect(serialized).toContain("контролира всяко следващо гласуване");
    expect(serialized).not.toContain("Минимум 5");
    expect(serialized).not.toContain("никога платена стена");
  });

  it("avoids internal roadmap language, anglicisms, and legal overclaims", () => {
    const serialized = JSON.stringify(FAQ_DATA);

    for (const staleCopy of [
      "ревюират",
      "равностойна стъпка",
      "публична пътна карта",
      "под 30 секунди",
      "Игрова статистика се пази анонимно",
      "специален „на живо“ темпо",
    ]) {
      expect(serialized).not.toContain(staleCopy);
    }
  });
});
