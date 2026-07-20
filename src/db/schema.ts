import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

export const days = sqliteTable("days", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  calorieGoal: integer("calorie_goal").notNull().default(2000),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const daysRelations = relations(days, ({ many }) => ({
  entries: many(entries),
}));

export const settings = sqliteTable("settings", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  defaultCalorieGoal: integer("default_calorie_goal").notNull().default(2000),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const settingsRelations = relations(settings, ({ many }) => ({
  days: many(days),
}));

export const entries = sqliteTable("entries", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  dayId: integer("day_id")
    .notNull()
    .references(() => days.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  calories: real("calories").notNull(),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  grams: real("grams").notNull().default(100),
  source: text("source", {
    enum: ["barcode", "search", "ai", "meal"],
  }).notNull(),
  aiDetails: text("ai_details"),
  mealDetails: text("meal_details"),
  filePath: text("file_path"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const entriesRelations = relations(entries, ({ one }) => ({
  day: one(days, {
    fields: [entries.dayId],
    references: [days.id],
  }),
}));

export const meals = sqliteTable("meals", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  calories: real("calories").notNull(),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  grams: real("grams").notNull().default(100),
  filePath: text("file_path"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const mealsRelations = relations(meals, ({ many }) => ({
  ingredients: many(mealIngredients),
}));

export const mealIngredients = sqliteTable("meal_ingredients", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  mealId: integer("meal_id")
    .notNull()
    .references(() => meals.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  calories: real("calories").notNull(),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  grams: real("grams").notNull().default(100),
  source: text("source", {
    enum: ["barcode", "search"],
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const mealIngredientsRelations = relations(mealIngredients, ({ one }) => ({
  meal: one(meals, {
    fields: [mealIngredients.mealId],
    references: [meals.id],
  }),
}));

export const insertDaySchema = createInsertSchema(days).omit({ id: true, createdAt: true });
export const selectDaySchema = createSelectSchema(days);
export const insertEntrySchema = createInsertSchema(entries).omit({ id: true, createdAt: true });
export const selectEntrySchema = createSelectSchema(entries);
export const insertSettingsSchema = createInsertSchema(settings).omit({
  id: true,
  updatedAt: true,
});
export const selectSettingsSchema = createSelectSchema(settings);
export const insertMealSchema = createInsertSchema(meals).omit({ id: true, createdAt: true });
export const selectMealSchema = createSelectSchema(meals);
export const insertMealIngredientSchema = createInsertSchema(mealIngredients).omit({
  id: true,
  createdAt: true,
});
export const selectMealIngredientSchema = createSelectSchema(mealIngredients);

export type Day = typeof days.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type InsertDay = typeof days.$inferInsert;
export type InsertEntry = typeof entries.$inferInsert;
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = typeof settings.$inferInsert;
export type Meal = typeof meals.$inferSelect;
export type InsertMeal = typeof meals.$inferInsert;
export type MealIngredient = typeof mealIngredients.$inferSelect;
export type InsertMealIngredient = typeof mealIngredients.$inferInsert;

export type MealWithIngredients = Meal & { ingredients: MealIngredient[] };
