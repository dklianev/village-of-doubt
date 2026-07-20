import { useMemo, type Dispatch } from "react";
import type { GameFamily, GameMode, RolePreset, TempoProfile } from "@werewolf/shared";
import type { AdvancedFlags, LobbyFormAction, LobbyFormState, LobbyStep } from "@/lib/lobby-form";

type CreateRecipe = {
  id: string;
  family: GameFamily;
  mode: GameMode;
  rolePreset: RolePreset;
  playerCount: number;
  step: LobbyStep;
  tempoProfile?: TempoProfile;
  advanced?: Partial<AdvancedFlags>;
  eyebrow: string;
  label: string;
  detail: string;
  roster: string;
  action: string;
  featured?: boolean;
};

const RECIPES: CreateRecipe[] = [
  {
    id: "werewolf-first-night",
    family: "werewolves",
    mode: "werewolves_classic",
    rolePreset: "beginner",
    playerCount: 6,
    step: 4,
    eyebrow: "първа игра",
    label: "Първа нощ",
    detail: "6 души, кратки фази и роли за една минута.",
    roster: "Селяни · Върколаци · Гадателка",
    action: "Готово за старт",
    featured: true,
  },
  {
    id: "werewolf-lovers-classic",
    family: "werewolves",
    mode: "werewolves_classic",
    rolePreset: "classic",
    playerCount: 12,
    step: 4,
    advanced: { loversEnabled: true },
    eyebrow: "препоръчано",
    label: "Класика с Влюбени",
    detail: "12 души. Купидон от първата нощ. Чист баланс.",
    roster: "Купидон · Вещица · Гадателка · Ловец",
    action: "Избери тази вечер",
    featured: true,
  },
  {
    id: "werewolf-big-box",
    family: "werewolves",
    mode: "werewolves_classic",
    rolePreset: "advanced",
    playerCount: 14,
    step: 2,
    advanced: { loversEnabled: true },
    eyebrow: "голяма кутия",
    label: "Село с тайни",
    detail: "Повече специални роли и място за опитни играчи да блъфират.",
    roster: "Купидон · Оракул · Ловец · Вещица",
    action: "Прегледай ролите",
  },
  {
    id: "mafia-first-table",
    family: "mafia",
    mode: "mafia_free",
    rolePreset: "free",
    playerCount: 6,
    step: 4,
    eyebrow: "първа маса",
    label: "Бърза Мафия",
    detail: "Малка маса с ясни роли за първи опит.",
    roster: "Граждани · Мафиоти · Комисар",
    action: "Готово за старт",
    featured: true,
  },
  {
    id: "mafia-sport",
    family: "mafia",
    mode: "mafia_sport",
    rolePreset: "sport",
    playerCount: 10,
    step: 4,
    tempoProfile: "sport_mafia",
    eyebrow: "официално",
    label: "Спортна Мафия",
    detail: "Точно 10 играчи и фиксирано темпо.",
    roster: "6 Граждани · Комисар · 2 Мафиоти · Дон",
    action: "Започни масата",
    featured: true,
  },
  {
    id: "mafia-large-table",
    family: "mafia",
    mode: "mafia_free",
    rolePreset: "free",
    playerCount: 12,
    step: 2,
    advanced: { maniacEnabled: true },
    eyebrow: "повече напрежение",
    label: "Голяма маса",
    detail: "Повече обвинения, повече алибита и една допълнителна заплаха.",
    roster: "Комисар · Доктор · Маниак · Мафия",
    action: "Прегледай ролите",
  },
];

export function QuickStartRow({
  state,
  dispatch,
}: {
  state: LobbyFormState;
  dispatch: Dispatch<LobbyFormAction>;
}) {
  const recipes = useMemo(
    () =>
      state.lockedFamily
        ? RECIPES.filter((recipe) => recipe.family === state.lockedFamily)
        : RECIPES.filter((recipe) => recipe.featured),
    [state.lockedFamily],
  );
  const activeRecipe = useMemo(
    () =>
      recipes.find(
        (recipe) =>
          recipe.mode === state.mode &&
          recipe.playerCount === state.playerCount &&
          recipe.rolePreset === state.rolePreset &&
          Boolean(recipe.advanced?.loversEnabled) === Boolean(state.advanced.loversEnabled),
      ),
    [recipes, state.advanced.loversEnabled, state.mode, state.playerCount, state.rolePreset],
  );

  return (
    <section className="create-recipes" aria-labelledby="create-recipes-title">
      <div className="create-recipes-heading">
        <p className="section-kicker">готови рецепти</p>
        <h2 id="create-recipes-title">Избери вечер, не настройка</h2>
        <p>
          Натискаш една карта и получаваш готова стая. После можеш да пипнеш детайлите, ако искаш.
        </p>
      </div>
      <div className="quick-start-row create-recipe-grid" aria-label="Готови рецепти за стая">
        {recipes.map((recipe) => (
          <button
            key={recipe.id}
            type="button"
            className="create-recipe-card"
            data-family={recipe.family}
            data-featured={recipe.featured ? "true" : "false"}
            data-active={activeRecipe?.id === recipe.id ? "true" : "false"}
            aria-pressed={activeRecipe?.id === recipe.id}
            onClick={() => dispatch({ type: "APPLY_TEMPLATE", template: recipe })}
          >
            <span className="create-recipe-eyebrow">{recipe.eyebrow}</span>
            <strong>{recipe.label}</strong>
            <span>{recipe.detail}</span>
            <small>{recipe.roster}</small>
            <b>{recipe.action}</b>
          </button>
        ))}
      </div>
    </section>
  );
}
