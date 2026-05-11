import type { GameFamily } from "@werewolf/shared";

const WEREWOLF_ROOM_NAMES = [
  "Тайното кафене",
  "Седмият час",
  "Под мъглата на Витоша",
  "Среднощната ливада",
  "Селото на Иван",
  "Каменният кладенец",
  "Гласове край огъня",
  "Последният фенер",
  "Съветът на площада",
  "Старата воденица",
  "Пътеката към гората",
  "Къщата с жълтите пердета",
];

const MAFIA_ROOM_NAMES = [
  "Сделка в дъжда",
  "Кафенето на Стефан",
  "Тих квартал",
  "Папка #404",
  "Среднощна София",
  "Задната маса",
  "Синият телефон",
  "Последният трамвай",
  "Клубът без табела",
  "Куфарът на гарата",
  "Договор на салфетка",
  "Офисът след полунощ",
];

export function randomRoomName(family: GameFamily): string {
  const pool = family === "mafia" ? MAFIA_ROOM_NAMES : WEREWOLF_ROOM_NAMES;
  return pool[Math.floor(Math.random() * pool.length)] ?? (family === "mafia" ? "Частна маса" : "Частно село");
}
