import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Minus, Plus, Save, Settings2, Target } from "lucide-react";
import { PageHeader } from "~/components/page-header";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { getSettings, updateDayGoal, updateSettings } from "~/lib/api";
import { toast } from "sonner";

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

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => getSettings(),
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
                  <span className="pointer-events-none absolute -right-8 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                    kcal
                  </span>
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
      </main>
    </div>
  );
}
