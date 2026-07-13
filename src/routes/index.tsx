import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, addDays, subDays } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  ScanBarcode,
  Search,
  Trash2,
  Sparkles,
  Utensils,
  ChevronDown,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { toast } from "sonner";
import { getDayByDate, deleteEntry } from "~/lib/api";
import { cn } from "~/lib/utils";
import type { Entry } from "~/db/schema";

function getDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

const SOURCE_LABELS: Record<Entry["source"], string> = {
  ai: "AI Photo Estimation",
  barcode: "Barcode Scanned",
  search: "Manually Searched",
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

  const totalCalories = day?.entries?.reduce((sum, e) => sum + (e.calories || 0), 0) || 0;
  const goal = day?.calorieGoal || 2000;
  const progress = Math.min((totalCalories / goal) * 100, 100);
  const remaining = Math.max(goal - totalCalories, 0);

  const goToPrevDay = () => setCurrentDate((d) => subDays(d, 1));
  const goToNextDay = () => setCurrentDate((d) => addDays(d, 1));
  const goToToday = () => setCurrentDate(new Date());

  const isToday = dateStr === getDateString(new Date());

  return (
    <div
      className={cn(
        "mx-auto flex min-h-screen max-w-md flex-col",
        isToday ? "bg-background" : "bg-muted/50",
      )}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
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
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : day?.entries && day.entries.length > 0 ? (
          <div className="flex flex-col gap-2">
            {day.entries.map((entry) => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onDelete={() => removeEntryMutation.mutate({ data: { id: entry.id! } })}
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

function EntryCard({ entry, onDelete }: { entry: Entry; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const aiDetails = parseAiDetails(entry);

  return (
    <div className="rounded-xl border bg-card">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between p-3 text-left"
      >
        <div className="flex flex-col">
          <span className="font-medium">{entry.name}</span>
          <span className="text-xs text-muted-foreground">
            {Math.round(entry.grams)}g · {Math.round(entry.calories)} kcal
          </span>
          <span className="mt-1 text-[10px] tabular-nums text-muted-foreground">
            {format(entry.createdAt, "P p")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {entry.source === "ai" && <Sparkles className="mr-1 size-3" />}
            {entry.source === "barcode" && <ScanBarcode className="mr-1 size-3" />}
            {entry.source === "search" && <Search className="mr-1 size-3" />}
            {Math.round(entry.calories)}
          </Badge>
          <div className="flex items-center gap-1">
            <DeleteButton onConfirm={onDelete} />
            <ChevronDown
              className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2">
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
        </div>
      )}
    </div>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete entry?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove the entry. Cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    date: typeof search.date === "string" ? search.date : undefined,
  }),
  component: IndexPage,
});
