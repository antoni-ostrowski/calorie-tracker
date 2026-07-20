import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import { ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { Progress } from "~/components/ui/progress";
import { toast } from "sonner";
import { getDayByDate, deleteEntry, duplicateEntry } from "~/lib/api";
import { cn } from "~/lib/utils";
import { FoodCard } from "~/components/food-card";
import { entryToFoodItem } from "~/lib/food";
import type { Entry } from "~/db/schema";

function getDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const SOURCE_LABELS: Record<Entry["source"], string> = {
  ai: "AI Estimation",
  barcode: "Barcode Scanned",
  search: "Manually Searched",
  meal: "Saved Meal",
};

function IndexPage() {
  const { date: urlDate } = Route.useSearch();
  const [currentDate, setCurrentDate] = useState(() => {
    if (urlDate) {
      const d = new Date(urlDate + "T00:00:00");
      return isNaN(d.getTime()) ? new Date() : d;
    }
    return new Date();
  });
  const dateStr = getDateString(currentDate);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: day, isLoading } = useQuery({
    queryKey: ["day", dateStr],
    queryFn: () => getDayByDate({ data: { date: dateStr } }),
  });

  const removeEntryMutation = useMutation({
    mutationFn: deleteEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      toast.success("Entry removed");
    },
    onError: (err) => toast.error(err.message),
  });

  const duplicateEntryMutation = useMutation({
    mutationFn: duplicateEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      toast.success("Entry duplicated");
    },
    onError: (err) => toast.error(err.message),
  });

  const totalCalories = day?.entries?.reduce((sum, e) => sum + (e.calories || 0), 0) || 0;
  const totalProtein = day?.entries?.reduce((sum, e) => sum + (e.protein || 0), 0) || 0;
  const totalCarbs = day?.entries?.reduce((sum, e) => sum + (e.carbs || 0), 0) || 0;
  const totalFat = day?.entries?.reduce((sum, e) => sum + (e.fat || 0), 0) || 0;
  const goal = day?.calorieGoal || 2000;
  const progress = Math.min((totalCalories / goal) * 100, 100);
  const remaining = Math.max(goal - totalCalories, 0);

  const goToPrevDay = () => setCurrentDate((d) => subDays(d, 1));
  const goToNextDay = () => setCurrentDate((d) => addDays(d, 1));
  const goToToday = () => {
    navigate({ to: "/", search: {} });
    setCurrentDate(new Date());
  };
  const isToday = dateStr === getDateString(new Date());

  return (
    <div
      className={cn(
        "mx-auto flex h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)] max-w-md flex-col overflow-hidden",
        isToday ? "bg-background" : "bg-muted/50",
      )}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        style={{ paddingTop: "max(env(safe-area-inset-top), 2.5rem)" }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={goToPrevDay}
            className="flex size-10 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>

          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-muted-foreground">
              {isToday ? "Today" : format(currentDate, "EEEE")}
            </span>
            <span className="text-lg font-bold">{format(currentDate, "MMM d")}</span>
            {!isToday && (
              <button
                onClick={goToToday}
                className="mt-0.5 text-[10px] font-semibold text-primary hover:underline"
              >
                Jump to today
              </button>
            )}
          </div>

          <button
            onClick={goToNextDay}
            className="flex size-10 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </header>

      {/* Calorie Progress */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl bg-primary/10 p-4">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Consumed</p>
              <p className="text-3xl font-bold text-primary">{Math.round(totalCalories)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p
                className={`text-xl font-semibold ${remaining <= 0 ? "text-destructive" : "text-foreground"}`}
              >
                {Math.round(remaining)}
              </p>
            </div>
          </div>
          <Progress value={progress} className="h-3" />
          <p className="mt-2 text-center text-xs text-muted-foreground">Goal: {goal} kcal</p>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            P: {Math.round(totalProtein)}g · C: {Math.round(totalCarbs)}g · F:{" "}
            {Math.round(totalFat)}g
          </p>
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : day?.entries && day.entries.length > 0 ? (
          <div className="flex flex-col gap-2">
            {day.entries.map((entry) => (
              <FoodCard
                key={entry.id}
                item={entryToFoodItem(entry)}
                onDelete={() => removeEntryMutation.mutate({ data: { id: entry.id! } })}
                onDuplicate={() => duplicateEntryMutation.mutate({ data: { id: entry.id! } })}
                details={<EntryDetails entry={entry} />}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Utensils className="mb-2 size-10 opacity-50" />
            <p className="text-sm">No entries yet</p>
            <p className="text-xs">Tap + to add food</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EntryDetails({ entry }: { entry: Entry }) {
  const aiDetails = parseAiDetails(entry);

  return (
    <div>
      <p className="text-xs font-medium text-foreground">{SOURCE_LABELS[entry.source]}</p>

      {entry.source === "ai" && aiDetails && (
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {aiDetails.confidence && (
            <p>
              <span className="font-medium">Confidence:</span> {aiDetails.confidence}
            </p>
          )}
          {(aiDetails.protein || aiDetails.carbs || aiDetails.fat) && (
            <p>
              <span className="font-medium">Macros:</span>{" "}
              {["protein", "carbs", "fat"]
                .map((key) =>
                  aiDetails[key] != null ? `${key}: ${Math.round(aiDetails[key])}g` : null,
                )
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {aiDetails.reasoning && (
            <p>
              <span className="font-medium">Reasoning:</span> {aiDetails.reasoning}
            </p>
          )}
        </div>
      )}

      {entry.source === "meal" && entry.mealDetails && <MealDetails details={entry.mealDetails} />}
    </div>
  );
}

function parseAiDetails(entry: Entry) {
  if (!entry.aiDetails) return null;
  try {
    return JSON.parse(entry.aiDetails) as Record<string, any>;
  } catch {
    return null;
  }
}

function MealDetails({ details }: { details: string }) {
  const parsed = (() => {
    try {
      return JSON.parse(details) as {
        ingredients: {
          name: string;
          grams: number;
          calories: number;
          protein?: number;
          carbs?: number;
          fat?: number;
          source: "barcode" | "search";
        }[];
      };
    } catch {
      return null;
    }
  })();

  if (!parsed?.ingredients?.length) return null;

  return (
    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Ingredients</p>
      {parsed.ingredients.map((ing, i) => (
        <p key={i}>
          {ing.name} · {Math.round(ing.grams)}g · {Math.round(ing.calories)} kcal
          {(ing.protein || ing.carbs || ing.fat) && (
            <span>
              {" "}
              · P {Math.round(ing.protein || 0)}g · C {Math.round(ing.carbs || 0)}g · F{" "}
              {Math.round(ing.fat || 0)}g
            </span>
          )}
        </p>
      ))}
    </div>
  );
}

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  component: IndexPage,
});
