export interface IngredientUnitConfig {
  unidad_medida: string;
  unidad_contenido?: string | null;
}

export interface RecipeUnitConfig {
  recipeUnit: string;
  orderUnit: string;
  displayFactor: number;
}

function normalizedUnit(unit: string): string {
  const normalized = unit.trim().toLowerCase();

  if (["g", "gr", "grs", "gs", "gramo", "gramos"].includes(normalized)) return "g";
  if (["ml", "mililitro", "mililitros"].includes(normalized)) return "ml";
  if (["u", "unidad", "unidades"].includes(normalized)) return "unidades";
  if (["doc", "docena", "docenas"].includes(normalized)) return "docenas";
  if (["l", "litro", "litros"].includes(normalized)) return "litros";
  if (["kg", "kilo", "kilos", "kilogramo", "kilogramos"].includes(normalized)) return "kg";

  return unit.trim();
}

export function getRecipeUnitConfig(ingredient: IngredientUnitConfig): RecipeUnitConfig {
  const orderUnit = normalizedUnit(ingredient.unidad_medida);

  if (orderUnit === "unidades" && ingredient.unidad_contenido) {
    return {
      recipeUnit: normalizedUnit(ingredient.unidad_contenido),
      orderUnit,
      displayFactor: 1,
    };
  }

  if (orderUnit === "kg") {
    return { recipeUnit: "g", orderUnit, displayFactor: 1000 };
  }

  if (orderUnit === "litros") {
    return { recipeUnit: "ml", orderUnit, displayFactor: 1000 };
  }

  if (orderUnit === "docenas") {
    return { recipeUnit: "unidades", orderUnit, displayFactor: 12 };
  }

  return { recipeUnit: orderUnit, orderUnit, displayFactor: 1 };
}

function stableNumber(value: number): number {
  return Number(value.toPrecision(12));
}

export function toRecipeQuantity(
  storedQuantity: number,
  ingredient: IngredientUnitConfig,
): number {
  return stableNumber(storedQuantity * getRecipeUnitConfig(ingredient).displayFactor);
}

export function toStoredQuantity(
  recipeQuantity: number,
  ingredient: IngredientUnitConfig,
): number {
  return stableNumber(recipeQuantity / getRecipeUnitConfig(ingredient).displayFactor);
}

export function formatContextQuantity(quantity: number | string, unit: string): string {
  const value = Number(quantity);
  const normalized = normalizedUnit(unit);
  let displayValue = value;
  let displayUnit = normalized;

  if (value >= 1000 && normalized === "g") {
    displayValue = value / 1000;
    displayUnit = "kg";
  } else if (value >= 1000 && ["ml", "cc"].includes(normalized)) {
    displayValue = value / 1000;
    displayUnit = "litros";
  }

  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 3,
  }).format(displayValue);
  return `${formatted} ${displayUnit}`;
}
