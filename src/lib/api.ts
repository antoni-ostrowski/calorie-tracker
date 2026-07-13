import { createServerFn } from "@tanstack/react-start";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/db";
import { days, entries, settings } from "~/db/schema";
import { env } from "~/env";

async function getOrCreateSettings() {
  let row = await db.query.settings.findFirst();
  if (!row) {
    const [created] = await db.insert(settings).values({}).returning();
    row = created;
  }
  return row;
}

export const getSettings = createServerFn({ method: "GET" }).handler(async () => {
  console.log("[getSettings] called");
  return getOrCreateSettings();
});

export const updateSettings = createServerFn({ method: "POST" })
  .inputValidator(z.object({ defaultCalorieGoal: z.number().min(500).max(20000) }))
  .handler(async ({ data }) => {
    console.log("[updateSettings] called", { defaultCalorieGoal: data.defaultCalorieGoal });
    const row = await getOrCreateSettings();
    const [updated] = await db
      .update(settings)
      .set({ defaultCalorieGoal: data.defaultCalorieGoal, updatedAt: new Date() })
      .where(eq(settings.id, row.id))
      .returning();
    return updated;
  });

export const getDayByDate = createServerFn({ method: "GET" })
  .inputValidator(z.object({ date: z.string() }))
  .handler(async ({ data }) => {
    console.log("[getDayByDate] called", { date: data.date });
    const day = await db.query.days.findFirst({
      where: eq(days.date, data.date),
      with: {
        entries: {
          orderBy: desc(entries.createdAt),
        },
      },
    });

    if (!day) {
      console.log("[getDayByDate] day not found, creating new day", { date: data.date });
      const { defaultCalorieGoal } = await getOrCreateSettings();
      const [newDay] = await db
        .insert(days)
        .values({ date: data.date, calorieGoal: defaultCalorieGoal })
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
    const allDays = await db.query.days.findMany({
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
    await db.update(days).set({ calorieGoal: data.calorieGoal }).where(eq(days.date, data.date));
    return { success: true };
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
      source: z.enum(["barcode", "search", "ai"]),
    }),
  )
  .handler(async ({ data }) => {
    console.log("[createEntry] called", {
      date: data.date,
      name: data.name,
      calories: data.calories,
      source: data.source,
    });
    let day = await db.query.days.findFirst({
      where: eq(days.date, data.date),
    });

    if (!day) {
      console.log("[createEntry] day not found, creating new day", { date: data.date });
      const { defaultCalorieGoal } = await getOrCreateSettings();
      const [newDay] = await db
        .insert(days)
        .values({ date: data.date, calorieGoal: defaultCalorieGoal })
        .returning();
      day = newDay;
    }

    const [entry] = await db
      .insert(entries)
      .values({
        dayId: day.id,
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        grams: data.grams,
        source: data.source,
      })
      .returning();

    console.log("[createEntry] created entry", { entryId: entry.id, dayId: day.id });
    return entry;
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    console.log("[deleteEntry] called", { id: data.id });
    await db.delete(entries).where(eq(entries.id, data.id));
    return { success: true };
  });

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

export const estimateWithAI = createServerFn({ method: "POST" })
  .inputValidator(z.object({ text: z.string(), imageDataUrl: z.string().optional() }))
  .handler(async ({ data }) => {
    console.log("[estimateWithAI] called", {
      text: data.text,
      hasImage: !!data.imageDataUrl,
      imageLength: data.imageDataUrl?.length,
    });

    console.log("[estimateWithAI] env", {
      apiUrl: env.OPENCODE_API_URL,
      hasKey: env.OPENCODE_API_KEY,
    });

    const systemPrompt =
      'You are a nutrition assistant. Estimate the calories and macros of the described meal. Respond ONLY with a JSON object in this exact format: {"name": "Meal name", "calories": number, "protein": number, "carbs": number, "fat": number, "grams": number, "confidence": "high|medium|low", "reasoning": "brief explanation"}. All numbers should be for the total meal amount described, not per 100g. Be reasonable and conservative in estimates.';

    const userContent = [] as any[];
    userContent.push({ type: "text", text: data.text });

    if (data.imageDataUrl) {
      const parsed = parseDataUrl(data.imageDataUrl);
      if (parsed) {
        userContent.push({
          type: "image",
          source: {
            type: "base64",
            media_type: parsed.mimeType,
            data: parsed.base64,
          },
        });
      } else {
        console.warn("[estimateWithAI] could not parse image data URL");
      }
    }

    const requestBody = {
      model: "minimax-m3",
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    };

    console.log(
      "[estimateWithAI] request body",
      JSON.stringify({
        ...requestBody,
        messages: requestBody.messages.map((m) => ({
          role: m.role,
          content: m.content.map((part: any) =>
            part.type === "image"
              ? { type: "image", source: { ...part.source, data: "[base64...]" } }
              : part,
          ),
        })),
      }),
    );

    const url = `${env.OPENCODE_API_URL}/messages`;
    console.log("[estimateWithAI] fetching", { url });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.OPENCODE_API_KEY,
        Authorization: `Bearer ${env.OPENCODE_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await res.text();
    console.log("[estimateWithAI] response", {
      status: res.status,
      statusText: res.statusText,
      preview: responseText.slice(0, 1000),
    });

    if (!res.ok) {
      throw new Error(
        `AI API error: ${res.status} ${res.statusText} — ${responseText.slice(0, 300)}`,
      );
    }

    let json;
    try {
      json = JSON.parse(responseText);
    } catch (parseErr) {
      console.error("[estimateWithAI] JSON parse failed", parseErr);
      throw new Error(`AI API returned non-JSON response: ${responseText.slice(0, 300)}`);
    }

    const contentBlocks = json.content || [];
    const textBlock = contentBlocks.find((block: any) => block.type === "text");
    const content = textBlock?.text || "";
    console.log("[estimateWithAI] message content preview", content.slice(0, 500));

    const parsed = extractJsonFromContent(content);
    console.log("[estimateWithAI] extracted JSON", parsed);

    const validated = aiEstimateResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[estimateWithAI] schema validation failed", validated.error.format());
      throw new Error(`AI response did not match expected format: ${validated.error.message}`);
    }

    console.log("[estimateWithAI] returning", validated.data);
    return validated.data;
  });
