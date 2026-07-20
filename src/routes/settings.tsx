import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Minus, Plus, Save, Settings2, Target, Utensils } from "lucide-react";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  getSettings,
  updateDayGoal,
  updateSettings,
  getMeals,
  createMeal,
  updateMeal,
  deleteMeal,
} from "~/lib/api";
import { MealBuilderDialog } from "~/components/meal-builder-dialog";
import { toast } from "sonner";
import type { MealWithIngredients } from "~/db/schema";

const PRESETS = [1500, 1800, 2000, 2200, 2500, 3000];
const MIN = 500;
const MAX = 5000;
const STEP = 50;

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(2000);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealWithIngredients | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
  });

  const { data: meals, isLoading: mealsLoading } = useQuery({
    queryKey: ["meals"],
    queryFn: () => getMeals(),
  });

  const createMealMutation = useMutation({
    mutationFn: createMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setBuilderOpen(false);
      toast.success("Meal saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMealMutation = useMutation({
    mutationFn: updateMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setBuilderOpen(false);
      setEditingMeal(null);
      toast.success("Meal updated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMealMutation = useMutation({
    mutationFn: deleteMeal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meals"] });
      setBuilderOpen(false);
      setEditingMeal(null);
      toast.success("Meal deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (settings) setDraft(settings.defaultCalorieGoal);
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (goal: number) => {
      await updateSettings({ data: { defaultCalorieGoal: goal } });
      const today = format(new Date(), "yyyy-MM-dd");
      await updateDayGoal({ data: { date: today, calorieGoal: goal } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["day"] });
      toast.success("Daily goal saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const changed = settings ? draft !== settings.defaultCalorieGoal : false;

  const clamp = (n: number) => Math.min(MAX, Math.max(MIN, Math.round(n / STEP) * STEP));
  const bump = (delta: number) => setDraft((v) => clamp(v + delta));

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <PageHeader title="Settings" />

      <main className="flex-1 px-4 py-6">
        <div className="mb-6 flex items-center gap-3 text-muted-foreground">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Settings2 className="size-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Preferences</p>
            <p className="text-xs">Customize your daily target</p>
          </div>
        </div>

        <Card className="overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
          <CardContent className="p-6">
            <div className="mb-6 flex flex-col items-center text-center">
              <Target className="mb-3 size-6 text-primary" />
              <Label
                htmlFor="calorie-goal"
                className="mb-1 text-sm font-medium text-muted-foreground"
              >
                Daily calorie goal
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => bump(-STEP)}
                  disabled={isLoading || saveMutation.isPending}
                >
                  <Minus className="size-4" />
                </Button>
                <div className="relative">
                  <Input
                    id="calorie-goal"
                    type="number"
                    inputMode="numeric"
                    min={MIN}
                    max={MAX}
                    step={STEP}
                    value={draft}
                    onChange={(e) => setDraft(clamp(Number(e.target.value)))}
                    disabled={isLoading || saveMutation.isPending}
                    className="h-auto w-40 border-none bg-transparent px-0 py-0 text-center text-5xl font-bold tabular-nums tracking-tight text-foreground shadow-none focus-visible:ring-0"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-full"
                  onClick={() => bump(STEP)}
                  disabled={isLoading || saveMutation.isPending}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            <div className="mb-6">
              <input
                type="range"
                min={MIN}
                max={MAX}
                step={STEP}
                value={draft}
                onChange={(e) => setDraft(clamp(Number(e.target.value)))}
                disabled={isLoading || saveMutation.isPending}
                className="w-full accent-primary"
              />
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{MIN}</span>
                <span>{MAX}</span>
              </div>
            </div>

            <div className="mb-6">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Quick presets</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setDraft(p)}
                    disabled={isLoading || saveMutation.isPending}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      draft === p
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-foreground hover:bg-muted"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full rounded-xl"
              size="lg"
              onClick={() => saveMutation.mutate(draft)}
              disabled={!changed || saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Save goal
            </Button>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
          This becomes default for new days. Today’s goal updates too.
        </p>

        <div className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Utensils className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Meals</p>
                <p className="text-xs">Reusable ingredient combos</p>
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() => {
                setEditingMeal(null);
                setBuilderOpen(true);
              }}
            >
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </div>

          {mealsLoading ? (
            <div className="flex justify-center py-8">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : !meals || meals.length === 0 ? (
            <div className="rounded-2xl border bg-muted/30 p-6 text-center text-muted-foreground">
              <p className="text-sm">No meals yet</p>
              <p className="text-xs">Tap Add to build your first reusable meal</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {meals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => {
                    setEditingMeal(meal);
                    setBuilderOpen(true);
                  }}
                  className="rounded-xl border bg-card p-4 text-left hover:bg-muted"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{meal.name}</span>
                    <span className="text-sm font-semibold text-primary">
                      {Math.round(meal.calories)} kcal
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(meal.grams)}g · P {Math.round(meal.protein || 0)}g · C{" "}
                    {Math.round(meal.carbs || 0)}g · F {Math.round(meal.fat || 0)}g
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      <MealBuilderDialog
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initialMeal={editingMeal}
        isPending={
          createMealMutation.isPending ||
          updateMealMutation.isPending ||
          deleteMealMutation.isPending
        }
        onSave={(meal) => {
          if (editingMeal) {
            updateMealMutation.mutate({ data: { id: editingMeal.id, ...meal } });
          } else {
            createMealMutation.mutate({ data: meal });
          }
        }}
        onDelete={editingMeal ? (id) => deleteMealMutation.mutate({ data: { id } }) : undefined}
      />
    </div>
  );
}
