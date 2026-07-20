import type { Entry } from "~/db/schema";

export interface FoodItem {
  id?: number;
  name: string;
  kcal: number;
  protein: number;
  carb: number;
  fat: number;
  grams: number;
  photo?: string | null;
  date: string;
  note?: string | null;
  source?: Entry["source"];
}

export function macroPercents(item: Pick<FoodItem, "protein" | "carb" | "fat">) {
  const p = (item.protein || 0) * 4;
  const c = (item.carb || 0) * 4;
  const f = (item.fat || 0) * 9;
  const total = p + c + f;

  if (total <= 0) {
    return { protein: 0, carb: 0, fat: 0 };
  }

  return {
    protein: Math.round((p / total) * 100),
    carb: Math.round((c / total) * 100),
    fat: Math.round((f / total) * 100),
  };
}

export function entryToFoodItem(entry: Entry): FoodItem {
  return {
    id: entry.id,
    name: entry.name,
    kcal: Math.round(entry.calories || 0),
    protein: entry.protein || 0,
    carb: entry.carbs || 0,
    fat: entry.fat || 0,
    grams: entry.grams || 0,
    photo: entry.filePath ? `api/img/${entry.id}` : null,
    date: entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "",
    note: undefined,
    source: entry.source,
  };
}
