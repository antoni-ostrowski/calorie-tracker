import { createServerFn } from "@tanstack/react-start";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { spawn } from "child_process";
import { db } from "~/db";
import { days, entries, mealIngredients, meals, settings } from "~/db/schema";
import { getSessionOrThrow } from "~/lib/auth-functions";
import { decryptToken, encryptToken, maskToken } from "~/lib/crypto";
import type { MealWithIngredients } from "~/db/schema";

async function getOrCreateSettings(userId: string) {
  let row = await db.query.settings.findFirst({
    where: eq(settings.userId, userId),
  });
  if (!row) {
    const [created] = await db.insert(settings).values({ userId }).returning();
    row = created;
  }
  return row;
}

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  console.log("[getSettings] called");
  const session = await getSessionOrThrow();
  const row = await getOrCreateSettings(session.user.id);
  // Don't leak encrypted token to client
  const { aiApiKeyEncrypted: _omit, ...safe } = row as typeof row & {
    aiApiKeyEncrypted?: string | null;
  };
  return safe;
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(z.object({ defaultCalorieGoal: z.number().min(500).max(20000) }))
  .handler(async ({ data }) => {
    console.log("[updateSettings] called", { defaultCalorieGoal: data.defaultCalorieGoal });
    const session = await getSessionOrThrow();
    const row = await getOrCreateSettings(session.user.id);
    const [updated] = await db
      .update(settings)
      .set({ defaultCalorieGoal: data.defaultCalorieGoal, updatedAt: new Date() })
      .where(eq(settings.id, row.id))
      .returning();
    const { aiApiKeyEncrypted: _omit, ...safe } = updated as typeof updated & {
      aiApiKeyEncrypted?: string | null;
    };
    return safe;
  });

// --- AI Settings (per-user, encrypted at rest) ---
// Now via opencode CLI: only model + key are stored, no URLs.
// The CLI handles provider routing internally via `opencode run -m <fullModel>` and `OPENCODE_API_KEY` env.

export const getAiSettings = createServerFn({ method: "GET" }).handler(async () => {
  console.log("[getAiSettings] called");
  const session = await getSessionOrThrow();
  const row = await getOrCreateSettings(session.user.id);

  let hasApiKey = false;
  let maskedKey: string | null = null;
  if (row.aiApiKeyEncrypted) {
    try {
      const plain = decryptToken(row.aiApiKeyEncrypted);
      hasApiKey = !!plain;
      maskedKey = plain ? maskToken(plain) : null;
    } catch (e) {
      console.error("[getAiSettings] failed to decrypt token", e);
      hasApiKey = false;
    }
  }

  // Only model is per-user now; URL is gone — opencode CLI routes via model ID (e.g. opencode/mimo-v2.5-free)
  const model = row.aiModel || "opencode/mimo-v2.5-free";
  const source = row.aiApiKeyEncrypted ? "user" : "none";

  return {
    hasApiKey,
    maskedKey,
    model,
    source,
  };
});

export const updateAiSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      apiKey: z.string().optional(), // empty string means clear, undefined means leave unchanged
      model: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    console.log("[updateAiSettings] called", {
      hasApiKey: data.apiKey !== undefined ? (data.apiKey ? "***" : "(clear)") : "(unchanged)",
      model: data.model,
    });
    const session = await getSessionOrThrow();
    const row = await getOrCreateSettings(session.user.id);

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.apiKey !== undefined) {
      const trimmed = data.apiKey.trim();
      if (trimmed === "") {
        updates.aiApiKeyEncrypted = null;
      } else {
        if (trimmed.length < 8) {
          throw new Error("API key seems too short");
        }
        updates.aiApiKeyEncrypted = encryptToken(trimmed);
      }
    }

    if (data.model !== undefined) {
      const trimmed = data.model.trim();
      if (trimmed === "") {
        updates.aiModel = null;
      } else {
        if (trimmed.length > 120) throw new Error("Model name too long");
        // Full model ID as shown in `opencode models` (e.g. opencode/mimo-v2.5-free, opencode-go/mimo-v2.5)
        updates.aiModel = trimmed;
      }
    }

    // Keep aiApiUrl for backward compat but ignore it — opencode CLI doesn't need it
    if (row.aiApiUrl) {
      // leave as-is; no longer used
    }

    const [updated] = await db
      .update(settings)
      .set(updates)
      .where(eq(settings.id, row.id))
      .returning();

    let maskedKey: string | null = null;
    let hasApiKey = false;
    if (updated.aiApiKeyEncrypted) {
      try {
        const plain = decryptToken(updated.aiApiKeyEncrypted);
        hasApiKey = !!plain;
        maskedKey = plain ? maskToken(plain) : null;
      } catch {
        hasApiKey = false;
      }
    }

    return {
      hasApiKey,
      maskedKey,
      model: updated.aiModel || "opencode/mimo-v2.5-free",
      source: updated.aiApiKeyEncrypted ? "user" : "none",
    };
  });

export const testAiConnection = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string().default("test") }))
  .handler(async ({ data }) => {
    console.log("[testAiConnection] called");
    const session = await getSessionOrThrow();
    const config = await resolveAiConfig(session.user.id);
    const result = await callAiViaOpencode({
      apiKey: config.apiKey,
      model: config.model,
      text: data.text || "Estimate: one apple",
      imageDataUrl: undefined,
    });
    return {
      success: true as const,
      preview: result.content.slice(0, 200),
      parsedPreview: JSON.stringify(result.parsed).slice(0, 500),
    };
  });

async function resolveAiConfig(userId: string): Promise<{
  apiKey: string | null;
  model: string;
  source: "user" | "none";
}> {
  const row = await getOrCreateSettings(userId);
  let apiKey: string | null = null;
  let source: "user" | "none" = "none";

  if (row.aiApiKeyEncrypted) {
    try {
      const decrypted = decryptToken(row.aiApiKeyEncrypted);
      if (decrypted) {
        apiKey = decrypted;
        source = "user";
      }
    } catch (e) {
      console.error("[resolveAiConfig] decrypt failed", e);
    }
  }

  const model = row.aiModel || "opencode/mimo-v2.5-free";
  return { apiKey, model, source };
}

export const getDayByDate = createServerFn({ method: "GET" })
  .inputValidator(z.object({ date: z.string() }))
  .handler(async ({ data }) => {
    console.log("[getDayByDate] called", { date: data.date });
    const session = await getSessionOrThrow();
    const userId = session.user.id;

    const day = await db.query.days.findFirst({
      where: and(eq(days.userId, userId), eq(days.date, data.date)),
      with: {
        entries: {
          orderBy: desc(entries.createdAt),
        },
      },
    });

    if (!day) {
      console.log("[getDayByDate] day not found, creating new day", { date: data.date });
      const { defaultCalorieGoal } = await getOrCreateSettings(userId);
      const [newDay] = await db
        .insert(days)
        .values({ userId, date: data.date, calorieGoal: defaultCalorieGoal })
        .returning();
      return { ...newDay, entries: [] };
    }

    console.log("[getDayByDate] found day", { dayId: day.id, entriesCount: day.entries?.length });
    return day;
  });

export const getDayHistory = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().default(30) }))
  .handler(async ({ data }) => {
    console.log("[getDayHistory] called", { limit: data.limit });
    const session = await getSessionOrThrow();
    const allDays = await db.query.days.findMany({
      where: eq(days.userId, session.user.id),
      orderBy: desc(days.date),
      limit: data.limit,
      with: {
        entries: true,
      },
    });
    console.log("[getDayHistory] found days", { count: allDays.length });
    return allDays;
  });

export const updateDayGoal = createServerFn({ method: "POST" })
  .inputValidator(z.object({ date: z.string(), calorieGoal: z.number().min(500).max(20000) }))
  .handler(async ({ data }) => {
    console.log("[updateDayGoal] called", { date: data.date, calorieGoal: data.calorieGoal });
    const session = await getSessionOrThrow();
    await db
      .update(days)
      .set({ calorieGoal: data.calorieGoal })
      .where(and(eq(days.userId, session.user.id), eq(days.date, data.date)));
    return { success: true };
  });

const ingredientSchema = z.object({
  name: z.string().min(1),
  calories: z.number().min(0),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  grams: z.number().min(0),
  source: z.enum(["barcode", "search"]),
});

export const createEntry = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      date: z.string(),
      name: z.string().min(1),
      calories: z.number().min(0),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      grams: z.number().min(0).default(100),
      source: z.enum(["barcode", "search", "ai", "meal"]),
      aiDetails: z.record(z.string(), z.any()).optional(),
      mealDetails: z
        .object({
          ingredients: z.array(ingredientSchema),
        })
        .optional(),
      photoStr: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    console.log("[createEntry] called", {
      date: data.date,
      name: data.name,
      calories: data.calories,
      source: data.source,
    });
    const session = await getSessionOrThrow();
    const userId = session.user.id;

    let day = await db.query.days.findFirst({
      where: and(eq(days.userId, userId), eq(days.date, data.date)),
    });

    if (!day) {
      console.log("[createEntry] day not found, creating new day", { date: data.date });
      const { defaultCalorieGoal } = await getOrCreateSettings(userId);
      const [newDay] = await db
        .insert(days)
        .values({ userId, date: data.date, calorieGoal: defaultCalorieGoal })
        .returning();
      day = newDay;
    }

    let filePath = "";
    try {
      if (data.photoStr) {
        filePath = await savePhoto(data.photoStr, data.name);
      }
    } catch (e) {
      console.error("[createEntry] failed to save photo: ", e);
    }

    const [entry] = await db
      .insert(entries)
      .values({
        userId,
        dayId: day.id,
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        grams: data.grams,
        source: data.source,
        aiDetails: data.aiDetails ? JSON.stringify(data.aiDetails) : undefined,
        mealDetails: data.mealDetails ? JSON.stringify(data.mealDetails) : undefined,
        filePath,
      })
      .returning();

    console.log("[createEntry] created entry", { entryId: entry.id, dayId: day.id });

    return entry;
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    console.log("[deleteEntry] called", { id: data.id });
    const session = await getSessionOrThrow();
    await db
      .delete(entries)
      .where(and(eq(entries.id, data.id), eq(entries.userId, session.user.id)));
    return { success: true };
  });

export const duplicateEntry = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    console.log("[duplicateEntry] called", { id: data.id });
    const session = await getSessionOrThrow();
    const userId = session.user.id;
    const entry = await db.query.entries.findFirst({
      where: and(eq(entries.id, data.id), eq(entries.userId, userId)),
    });

    if (!entry) {
      throw new Error("Entry not found");
    }

    let filePath = "";
    if (entry.filePath) {
      try {
        const buffer = await fs.readFile(entry.filePath);
        const ext = path.extname(entry.filePath) || ".jpg";
        const baseName = entry.name
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9-_]/g, "");
        const fileName = `${Date.now()}-${baseName}-copy${ext}`;
        const outDir = path.resolve("data/photos");
        await fs.mkdir(outDir, { recursive: true });
        filePath = path.join(outDir, fileName);
        await fs.writeFile(filePath, buffer);
      } catch (e) {
        console.error("[duplicateEntry] failed to copy entry photo: ", e);
      }
    }

    const [newEntry] = await db
      .insert(entries)
      .values({
        userId,
        dayId: entry.dayId,
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        grams: entry.grams,
        source: entry.source,
        aiDetails: entry.aiDetails,
        mealDetails: entry.mealDetails,
        filePath,
      })
      .returning();

    console.log("[duplicateEntry] created entry", { entryId: newEntry.id, dayId: entry.dayId });
    return newEntry;
  });

interface IngredientInput {
  name: string;
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  grams: number;
  source: "barcode" | "search";
}

function totalsFromIngredients(ingredients: IngredientInput[]) {
  return ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein: acc.protein + (i.protein || 0),
      carbs: acc.carbs + (i.carbs || 0),
      fat: acc.fat + (i.fat || 0),
      grams: acc.grams + (i.grams || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  );
}

export const getMeals = createServerFn({ method: "GET" }).handler(async () => {
  console.log("[getMeals] called");
  const session = await getSessionOrThrow();
  const rows = await db.query.meals.findMany({
    where: eq(meals.userId, session.user.id),
    with: {
      ingredients: {
        orderBy: (mealIngredients, { asc }) => [asc(mealIngredients.id)],
      },
    },
    orderBy: (meals, { desc }) => [desc(meals.createdAt)],
  });
  console.log("[getMeals] found meals", { count: rows.length });
  return rows as MealWithIngredients[];
});

export const createMeal = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      ingredients: z.array(ingredientSchema).min(1),
      photoStr: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    console.log("[createMeal] called", { name: data.name, ingredients: data.ingredients.length });
    const session = await getSessionOrThrow();
    const userId = session.user.id;
    const totals = totalsFromIngredients(data.ingredients);

    let filePath = "";
    try {
      if (data.photoStr) {
        filePath = await savePhoto(data.photoStr, data.name);
      }
    } catch (e) {
      console.error("[createMeal] failed to save photo: ", e);
    }

    const [meal] = await db
      .insert(meals)
      .values({
        userId,
        name: data.name,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        grams: totals.grams,
        filePath,
      })
      .returning();

    await db.insert(mealIngredients).values(
      data.ingredients.map((i) => ({
        userId,
        mealId: meal.id,
        name: i.name,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        grams: i.grams,
        source: i.source,
      })),
    );

    return meal;
  });

export const updateMeal = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number(),
      name: z.string().min(1),
      ingredients: z.array(ingredientSchema).min(1),
      photoStr: z.string().optional().nullable(),
    }),
  )
  .handler(async ({ data }) => {
    console.log("[updateMeal] called", { id: data.id, name: data.name });
    const session = await getSessionOrThrow();
    const userId = session.user.id;
    const totals = totalsFromIngredients(data.ingredients);

    const existing = await db.query.meals.findFirst({
      where: and(eq(meals.id, data.id), eq(meals.userId, userId)),
    });
    if (!existing) {
      throw new Error("Meal not found");
    }

    let filePath = existing.filePath ?? "";
    if (data.photoStr === null) {
      filePath = "";
    } else if (data.photoStr) {
      try {
        filePath = await savePhoto(data.photoStr, data.name);
      } catch (e) {
        console.error("[updateMeal] failed to save photo: ", e);
      }
    }

    await db
      .update(meals)
      .set({
        name: data.name,
        calories: totals.calories,
        protein: totals.protein,
        carbs: totals.carbs,
        fat: totals.fat,
        grams: totals.grams,
        filePath,
      })
      .where(and(eq(meals.id, data.id), eq(meals.userId, userId)));

    await db.delete(mealIngredients).where(eq(mealIngredients.mealId, data.id));
    await db.insert(mealIngredients).values(
      data.ingredients.map((i) => ({
        userId,
        mealId: data.id,
        name: i.name,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
        grams: i.grams,
        source: i.source,
      })),
    );

    return { success: true };
  });

export const deleteMeal = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    console.log("[deleteMeal] called", { id: data.id });
    const session = await getSessionOrThrow();
    await db.delete(meals).where(and(eq(meals.id, data.id), eq(meals.userId, session.user.id)));
    return { success: true };
  });

export const createMealEntry = createServerFn({ method: "POST" })
  .inputValidator(
    z
      .object({
        id: z.number(),
        date: z.string(),
        grams: z.number().min(1).optional(),
        ingredients: z.array(ingredientSchema).min(1).optional(),
      })
      .refine((d) => d.grams !== undefined || (d.ingredients && d.ingredients.length > 0), {
        message: "Either grams or ingredients must be provided",
      }),
  )
  .handler(async ({ data }) => {
    console.log("[createMealEntry] called", {
      id: data.id,
      date: data.date,
      grams: data.grams,
      hasIngredients: !!data.ingredients,
    });
    const session = await getSessionOrThrow();
    const userId = session.user.id;

    const meal = await db.query.meals.findFirst({
      where: and(eq(meals.id, data.id), eq(meals.userId, userId)),
      with: {
        ingredients: true,
      },
    });

    if (!meal) {
      throw new Error("Meal not found");
    }

    let day = await db.query.days.findFirst({
      where: and(eq(days.userId, userId), eq(days.date, data.date)),
    });

    if (!day) {
      const { defaultCalorieGoal } = await getOrCreateSettings(userId);
      const [newDay] = await db
        .insert(days)
        .values({ userId, date: data.date, calorieGoal: defaultCalorieGoal })
        .returning();
      day = newDay;
    }

    let calories: number;
    let protein: number;
    let carbs: number;
    let fat: number;
    let entryGrams: number;
    let snapshotIngredients: {
      name: string;
      grams: number;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      source: "barcode" | "search";
    }[];

    if (data.ingredients && data.ingredients.length > 0) {
      const totals = totalsFromIngredients(data.ingredients);
      calories = Math.round(totals.calories);
      protein = Math.round(totals.protein * 10) / 10;
      carbs = Math.round(totals.carbs * 10) / 10;
      fat = Math.round(totals.fat * 10) / 10;
      entryGrams = Math.round(totals.grams * 10) / 10;
      snapshotIngredients = data.ingredients.map((i) => ({
        name: i.name,
        grams: Math.round(i.grams * 10) / 10,
        calories: Math.round(i.calories),
        protein: Math.round((i.protein || 0) * 10) / 10,
        carbs: Math.round((i.carbs || 0) * 10) / 10,
        fat: Math.round((i.fat || 0) * 10) / 10,
        source: i.source,
      }));
    } else {
      const grams = data.grams as number;
      const ratio = meal.grams > 0 ? grams / meal.grams : 0;
      calories = Math.round(meal.calories * ratio);
      protein = Math.round((meal.protein || 0) * ratio * 10) / 10;
      carbs = Math.round((meal.carbs || 0) * ratio * 10) / 10;
      fat = Math.round((meal.fat || 0) * ratio * 10) / 10;
      entryGrams = grams;
      snapshotIngredients = meal.ingredients.map((i) => ({
        name: i.name,
        grams: Math.round(i.grams * ratio * 10) / 10,
        calories: Math.round(i.calories * ratio),
        protein: Math.round((i.protein || 0) * ratio * 10) / 10,
        carbs: Math.round((i.carbs || 0) * ratio * 10) / 10,
        fat: Math.round((i.fat || 0) * ratio * 10) / 10,
        source: i.source,
      }));
    }

    let filePath = "";
    if (meal.filePath) {
      try {
        const buffer = await fs.readFile(meal.filePath);
        const ext = path.extname(meal.filePath) || ".jpg";
        const baseName = meal.name
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-zA-Z0-9-_]/g, "");
        const fileName = `${Date.now()}-${baseName}-meal${ext}`;
        const outDir = path.resolve("data/photos");
        await fs.mkdir(outDir, { recursive: true });
        filePath = path.join(outDir, fileName);
        await fs.writeFile(filePath, buffer);
      } catch (e) {
        console.error("[createMealEntry] failed to copy meal photo: ", e);
      }
    }

    const [entry] = await db
      .insert(entries)
      .values({
        userId,
        dayId: day.id,
        name: meal.name,
        calories,
        protein,
        carbs,
        fat,
        grams: entryGrams,
        source: "meal",
        mealDetails: JSON.stringify({ ingredients: snapshotIngredients }),
        filePath,
      })
      .returning();

    return entry;
  });

async function savePhoto(photoStr: string, name: string): Promise<string> {
  const mimeMatch = photoStr.match(/^data:image\/(\w+);base64,/);
  const ext = mimeMatch?.[1] ?? "jpg";
  const baseName = name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "");
  const fileName = `${Date.now()}-${baseName}.${ext}`;
  const outDir = path.resolve("data/photos");
  await fs.mkdir(outDir, { recursive: true });
  const filePath = path.join(outDir, fileName);
  const cleanBase64 = photoStr.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(cleanBase64, "base64");
  await fs.writeFile(filePath, imageBuffer);
  return filePath;
}

const aiEstimateResponseSchema = z.object({
  name: z.string(),
  calories: z.number(),
  protein: z.number().optional(),
  carbs: z.number().optional(),
  fat: z.number().optional(),
  grams: z.number().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  reasoning: z.string().optional(),
});

function extractJsonFromContent(content: string): unknown {
  console.log("[extractJsonFromContent] raw content preview", content.slice(0, 500));
  const withoutThink = content.replace(/<think>[\s\S]*?<\/think>/g, "");
  console.log(
    "[extractJsonFromContent] content after stripping think tags preview",
    withoutThink.slice(0, 500),
  );
  const matches = withoutThink.match(/\{[\s\S]*\}/g);
  if (!matches || matches.length === 0) {
    throw new Error("AI response did not contain valid JSON");
  }
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(matches[i]);
    } catch {
      continue;
    }
  }
  throw new Error("AI response contained JSON-like text but it could not be parsed");
}

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

export const lookupBarcode = createServerFn({ method: "GET" })
  .inputValidator(z.object({ barcode: z.string() }))
  .handler(async ({ data }) => {
    console.log("[lookupBarcode] called", { barcode: data.barcode });
    const url = `https://world.openfoodfacts.org/api/v2/product/${data.barcode}.json`;
    console.log("[lookupBarcode] fetching", { url });
    const res = await fetch(url);
    const responseText = await res.text();
    console.log("[lookupBarcode] response", {
      status: res.status,
      statusText: res.statusText,
      preview: responseText.slice(0, 500),
    });

    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      throw new Error(`Open Food Facts returned non-JSON response: ${responseText.slice(0, 200)}`);
    }

    if (json.status !== 1 || !json.product) {
      throw new Error("Product not found");
    }

    const product = json.product;
    const nutriments = product.nutriments || {};

    return {
      name: product.product_name || "Unknown Product",
      caloriesPer100g: nutriments["energy-kcal_100g"] || nutriments.energy_kcal_100g || 0,
      proteinPer100g: nutriments.proteins_100g || 0,
      carbsPer100g: nutriments.carbohydrates_100g || 0,
      fatPer100g: nutriments.fat_100g || 0,
    };
  });

export const searchFood = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string() }))
  .handler(async ({ data }) => {
    console.log("[searchFood] called", { query: data.query });
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(data.query)}&pageSize=10&api_key=DEMO_KEY&dataType=Foundation,SR%20Legacy`;
    console.log("[searchFood] fetching", { url });
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    const responseText = await res.text();
    console.log("[searchFood] response", {
      status: res.status,
      statusText: res.statusText,
      preview: responseText.slice(0, 500),
    });

    if (!res.ok) {
      throw new Error(
        `USDA API request failed: ${res.status} ${res.statusText} — ${responseText.slice(0, 200)}`,
      );
    }

    let json;
    try {
      json = JSON.parse(responseText);
    } catch {
      throw new Error(`USDA API returned non-JSON response: ${responseText.slice(0, 200)}`);
    }

    const foods = json.foods || [];

    return foods.map((food: any) => {
      const nutrients = food.foodNutrients || [];
      const getNutrient = (name: string) =>
        nutrients.find((n: any) => n.nutrientName?.toLowerCase().includes(name.toLowerCase()))
          ?.value || 0;

      return {
        name: food.description,
        caloriesPer100g: getNutrient("Energy") || getNutrient("energy"),
        proteinPer100g: getNutrient("Protein"),
        carbsPer100g: getNutrient("Carbohydrate, by difference") || getNutrient("Carbohydrate"),
        fatPer100g: getNutrient("Total lipid (fat)") || getNutrient("fat"),
      };
    });
  });

// System prompt used for all AI providers
const AI_SYSTEM_PROMPT = `
 You are a nutrition assistant. Estimate the calories and macros of the described meal.
 You estimate nutrition for one meal from text and/or an image.
 
 Return ONLY one valid JSON object:
 {"name":"short meal name","calories":number,"protein":number,"carbs":number,"fat":number,"grams":number,"confidence":"high|medium|low","reasoning":"brief explanation of visible foods and portion assumptions"}
 
 Rules:
 - Estimate the total amount the user describes or shows, not per 100g.
 - Identify only foods supported by the image or user text. Never invent brands, ingredients, sauces, oils, or cooking methods.
 - If details are uncertain, use typical assumptions and lower confidence.
 - Estimate portions conservatively. Do not inflate precision.
 - For mixed dishes, estimate visible components separately, then add them.
 - grams means estimated edible food weight, excluding plates, packaging, and bones.
 - If no image or text gives enough information, make a broad typical estimate and set confidence to low.
 - Use whole numbers for calories and grams. Use numbers, never strings.
 - Keep reasoning brief. Do not include hidden reasoning.
 - Do not include markdown, code fences, or extra text outside the JSON object.
 `;

function extractTextFromOpencodeStream(stdout: string): string {
  const texts: string[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      // opencode run --format json emits {type:"text", part:{type:"text", text:"..."}}
      if (obj.type === "text" && obj.part?.text) {
        texts.push(obj.part.text);
      } else if (obj.part?.type === "text" && obj.part?.text) {
        texts.push(obj.part.text);
      } else if (typeof obj.text === "string" && obj.type !== "tool_use") {
        texts.push(obj.text);
      }
    } catch {
      // not JSON, maybe plain text
      if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
        // try extract json later
        texts.push(trimmed);
      }
    }
  }
  // Join all text parts; last one is usually the final answer
  return texts.join("\n");
}

async function runOpencodeCli(
  args: string[],
  env: Record<string, string>,
  timeoutMs = 60000,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("opencode", args, {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    }, timeoutMs);

    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(
          new Error(
            `opencode run timed out after ${timeoutMs}ms. stdout: ${stdout.slice(0, 500)} stderr: ${stderr.slice(0, 500)}`,
          ),
        );
      } else {
        resolve({ stdout, stderr, exitCode: code });
      }
    });
  });
}

async function callAiViaOpencode(opts: {
  apiKey: string | null;
  model: string;
  text: string;
  imageDataUrl?: string;
}): Promise<{ content: string; raw: unknown; parsed: unknown }> {
  const prompt = `${AI_SYSTEM_PROMPT}\n\nUser request: ${opts.text}\n\nRemember: Return ONLY the JSON object, no markdown.`;
  const args: string[] = ["run", "-m", opts.model, "--format", "json"];
  let tmpImagePath: string | null = null;

  try {
    if (opts.imageDataUrl) {
      const parsed = parseDataUrl(opts.imageDataUrl);
      if (parsed) {
        const ext = parsed.mimeType.split("/")[1] || "jpg";
        const tmpFile = path.join(
          os.tmpdir(),
          `ai-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`,
        );
        await fs.writeFile(tmpFile, Buffer.from(parsed.base64, "base64"));
        tmpImagePath = tmpFile;
        // opencode run supports -f / --file to attach file to message
        // Use -- separator before prompt so prompt isn't mistaken for file when -f is present
        args.push("-f", tmpFile);
      } else {
        console.warn(
          "[callAiViaOpencode] could not parse image data URL, proceeding without image",
        );
      }
    }

    args.push("--", prompt);

    const env: Record<string, string> = {};
    if (opts.apiKey) {
      env.OPENCODE_API_KEY = opts.apiKey;
    }
    // Ensure opencode can find itself via PATH (Docker sets /root/.opencode/bin)
    // No need to set other envs; just pass API key.

    console.log("[callAiViaOpencode] spawning", `opencode ${args.slice(0, 4).join(" ")} ...`, {
      model: opts.model,
      hasKey: !!opts.apiKey,
      hasImage: !!tmpImagePath,
    });

    const { stdout, stderr, exitCode } = await runOpencodeCli(args, env);

    console.log(
      "[callAiViaOpencode] exit",
      exitCode,
      "stdout len",
      stdout.length,
      "stderr len",
      stderr.length,
    );
    if (stderr) console.log("[callAiViaOpencode] stderr preview", stderr.slice(0, 1000));
    console.log("[callAiViaOpencode] stdout preview", stdout.slice(0, 1000));

    if (exitCode !== 0 && !stdout.trim()) {
      throw new Error(
        `opencode run failed (exit ${exitCode}): ${stderr.slice(0, 1000) || "no output"}`,
      );
    }

    const content = extractTextFromOpencodeStream(stdout);
    console.log("[callAiViaOpencode] extracted text preview", content.slice(0, 500));

    if (!content.trim()) {
      // Fallback: try raw stdout as content
      const fallback = stdout.trim();
      if (!fallback)
        throw new Error(`opencode run produced no text output. stderr: ${stderr.slice(0, 500)}`);
      const parsedFallback = extractJsonFromContent(fallback);
      return { content: fallback, raw: stdout, parsed: parsedFallback };
    }

    const parsed = extractJsonFromContent(content);
    return { content, raw: stdout, parsed };
  } finally {
    if (tmpImagePath) {
      try {
        await fs.unlink(tmpImagePath);
      } catch {}
    }
  }
}

export const estimateWithAI = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string(), imageDataUrl: z.string().optional() }))
  .handler(async ({ data }) => {
    console.log("[estimateWithAI] called", {
      text: data.text,
      hasImage: !!data.imageDataUrl,
      imageLength: data.imageDataUrl?.length,
    });

    const session = await getSessionOrThrow();
    const config = await resolveAiConfig(session.user.id);

    console.log("[estimateWithAI] resolved config", {
      model: config.model,
      hasKey: !!config.apiKey,
    });

    if (!config.model) {
      throw new Error(
        "AI not configured. Go to Settings → AI Configuration and set model (e.g. opencode/mimo-v2.5-free). Token is set there if your model requires it.",
      );
    }

    const { parsed } = await callAiViaOpencode({
      apiKey: config.apiKey,
      model: config.model,
      text: data.text,
      imageDataUrl: data.imageDataUrl,
    });

    console.log("[estimateWithAI] extracted JSON", parsed);

    const validated = aiEstimateResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[estimateWithAI] schema validation failed", validated.error.format());
      throw new Error(`AI response did not match expected format: ${validated.error.message}`);
    }

    console.log("[estimateWithAI] returning", validated.data);
    return validated.data;
  });
