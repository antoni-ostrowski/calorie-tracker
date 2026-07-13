import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { PageHeader } from "~/components/page-header";
import { Progress } from "~/components/ui/progress";
import { getDayHistory } from "~/lib/api";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
});

function HistoryPage() {
  const { data: days, isLoading } = useQuery({
    queryKey: ["history"],
    queryFn: () => getDayHistory({ data: { limit: 30 } }),
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background">
      <PageHeader title="History" />

      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !days || days.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="mb-2 size-10 opacity-50" />
            <p className="text-sm">No history yet</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {days.map((day) => {
              const total = day.entries?.reduce((sum, e) => sum + (e.calories || 0), 0) || 0;
              const progress = Math.min((total / day.calorieGoal) * 100, 100);
              const isOver = total > day.calorieGoal;

              return (
                <Link
                  key={day.id}
                  to="/"
                  search={{ date: day.date }}
                  className="rounded-xl border bg-card p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">
                      {format(new Date(day.date + "T00:00:00"), "EEEE, MMM d")}
                    </span>
                    <span
                      className={`text-sm font-semibold ${isOver ? "text-destructive" : "text-primary"}`}
                    >
                      {Math.round(total)} / {day.calorieGoal}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>{day.entries?.length || 0} entries</span>
                    <span>
                      {isOver
                        ? `${Math.round(total - day.calorieGoal)} over`
                        : `${Math.round(day.calorieGoal - total)} remaining`}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
