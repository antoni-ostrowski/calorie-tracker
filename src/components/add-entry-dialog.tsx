import { useEffect, useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  Plus,
  Sparkles,
  ScanBarcode,
  Search,
  Utensils,
  Check,
  X,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { toast } from "sonner";
import { createEntry, createMealEntry, estimateWithAI, getMeals } from "~/lib/api";
import {
  BarcodeLookup,
  FoodAmountForm,
  SearchLookup,
  makeIngredient,
  type FoodInfo,
  type IngredientDraft,
} from "~/components/food-pickers";
import type { MealWithIngredients } from "~/db/schema";

interface AddEntryDialogProps {
  date: string;
}

export interface MealIngredientSnapshot {
  name: string;
  grams: number;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  source: "barcode" | "search";
}

export interface EntryData {
  date: string;
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  grams: number;
  source: "barcode" | "search" | "ai" | "meal";
  aiDetails?: Record<string, any>;
  mealDetails?: { ingredients: MealIngredientSnapshot[] };
  photoStr?: string | null;
}

interface TabProps {
  date: string;
  onAdd: (data: EntryData) => void;
  onClose?: () => void;
  isPending: boolean;
}

export function AddEntryDialog({ date }: AddEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const addEntryMutation = useMutation({
    mutationFn: createEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day", date] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      toast.success("Entry added");
      setOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdd = (data: EntryData) => addEntryMutation.mutate({ data });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="size-14 rounded-full shadow-lg">
          <Plus className="size-6" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Food</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="ai" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="ai">
              <Sparkles className="mr-1 size-4" />
              AI
            </TabsTrigger>
            <TabsTrigger value="barcode">
              <ScanBarcode className="mr-1 size-4" />
              Barcode
            </TabsTrigger>
            <TabsTrigger value="search">
              <Search className="mr-1 size-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="meals">
              <Utensils className="mr-1 size-4" />
              Meals
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai">
            <AIPhotoTab date={date} onAdd={handleAdd} isPending={addEntryMutation.isPending} />
          </TabsContent>

          <TabsContent value="barcode">
            <BarcodeTab date={date} onAdd={handleAdd} isPending={addEntryMutation.isPending} />
          </TabsContent>

          <TabsContent value="search">
            <SearchTab date={date} onAdd={handleAdd} isPending={addEntryMutation.isPending} />
          </TabsContent>

          <TabsContent value="meals">
            <MealsTab date={date} onClose={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AIPhotoTab({ date, onAdd, isPending }: TabProps) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleEstimate = async () => {
    if (!context.trim() && !photo) {
      toast.error("Add a photo or describe the meal");
      return;
    }

    setLoading(true);
    try {
      const res = await estimateWithAI({
        data: { text: context || "Estimate this meal", imageDataUrl: photo || undefined },
      });
      setResult(res);
    } catch (err: any) {
      toast.error(err.message || "AI estimation failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    if (!result || isPending) return;
    onAdd({
      date,
      name: result.name,
      calories: result.calories,
      protein: result.protein,
      carbs: result.carbs,
      fat: result.fat,
      grams: result.grams || 100,
      source: "ai",
      aiDetails: result,
      photoStr: photo,
    });
  };

  const handleDecline = () => {
    setResult(null);
  };

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        {photo && (
          <img src={photo} alt="Meal" className="aspect-video w-full rounded-lg object-cover" />
        )}
        <div className="rounded-lg bg-muted p-4">
          <h3 className="font-semibold">{result.name}</h3>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Calories:</span> {Math.round(result.calories)}{" "}
              kcal
            </div>
            <div>
              <span className="text-muted-foreground">Grams:</span>{" "}
              {Math.round(result.grams || 100)}g
            </div>
            <div>
              <span className="text-muted-foreground">Protein:</span>{" "}
              {Math.round(result.protein || 0)}g
            </div>
            <div>
              <span className="text-muted-foreground">Carbs:</span> {Math.round(result.carbs || 0)}g
            </div>
            <div>
              <span className="text-muted-foreground">Fat:</span> {Math.round(result.fat || 0)}g
            </div>
            <div>
              <span className="text-muted-foreground">Confidence:</span> {result.confidence}
            </div>
          </div>
          {result.reasoning && (
            <p className="mt-2 text-xs text-muted-foreground">{result.reasoning}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleDecline}>
            <X className="mr-1 size-4" />
            Revise
          </Button>
          <Button className="flex-1" onClick={handleAccept} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Check className="mr-1 size-4" />
            )}
            Add
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2">
        {photo ? (
          <div className="relative w-full">
            <img src={photo} alt="Meal" className="aspect-video w-full rounded-lg object-cover" />
            <button
              onClick={() => setPhoto(null)}
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 p-6 hover:bg-muted/50">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-8 text-muted-foreground"
            >
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
            <span className="text-sm text-muted-foreground">Take a photo</span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhotoCapture} />
          </label>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ai-context">Context (optional)</Label>
        <Textarea
          id="ai-context"
          placeholder="e.g., This is a large portion, I ate about half the plate..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
          rows={3}
        />
      </div>

      <Button onClick={handleEstimate} disabled={loading}>
        {loading ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 size-4 animate-spin"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        Estimate Calories
      </Button>
    </div>
  );
}

function BarcodeTab({ date, onAdd, isPending }: TabProps) {
  const [selected, setSelected] = useState<FoodInfo | null>(null);

  if (selected) {
    return (
      <FoodAmountForm
        food={selected}
        source="barcode"
        isPending={isPending}
        onConfirm={(ingredient) => {
          onAdd({
            date,
            name: ingredient.name,
            calories: ingredient.calories,
            protein: ingredient.protein,
            carbs: ingredient.carbs,
            fat: ingredient.fat,
            grams: ingredient.grams,
            source: "barcode",
          });
        }}
        onCancel={() => setSelected(null)}
      />
    );
  }

  return <BarcodeLookup onSelect={setSelected} />;
}

function SearchTab({ date, onAdd, isPending }: TabProps) {
  const [selected, setSelected] = useState<FoodInfo | null>(null);

  if (selected) {
    return (
      <FoodAmountForm
        food={selected}
        source="search"
        isPending={isPending}
        onConfirm={(ingredient) => {
          onAdd({
            date,
            name: ingredient.name,
            calories: ingredient.calories,
            protein: ingredient.protein,
            carbs: ingredient.carbs,
            fat: ingredient.fat,
            grams: ingredient.grams,
            source: "search",
          });
        }}
        onCancel={() => setSelected(null)}
      />
    );
  }

  return <SearchLookup onSelect={setSelected} />;
}

function MealsTab({ date, onClose }: { date: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: meals, isLoading } = useQuery({
    queryKey: ["meals"],
    queryFn: () => getMeals(),
  });
  const [selected, setSelected] = useState<MealWithIngredients | null>(null);

  const logMealMutation = useMutation({
    mutationFn: createMealEntry,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day", date] });
      queryClient.invalidateQueries({ queryKey: ["history"] });
      toast.success("Entry added");
      onClose();
    },
    onError: (err) => toast.error(err.message),
  });

  if (selected) {
    return (
      <MealAmountForm
        meal={selected}
        isPending={logMealMutation.isPending}
        onConfirm={(ingredients) =>
          logMealMutation.mutate({ data: { id: selected.id, date, ingredients } })
        }
        onCancel={() => setSelected(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!meals?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
        <Utensils className="mb-2 size-10 opacity-50" />
        <p className="text-sm">No saved meals</p>
        <p className="text-xs">Create meals in Settings</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
      {meals.map((meal) => (
        <button
          key={meal.id}
          onClick={() => setSelected(meal)}
          className="rounded-xl border bg-card p-4 text-left hover:bg-muted"
        >
          <div className="flex items-center gap-3">
            {meal.filePath ? (
              <img
                src={`api/meal-img/${meal.id}`}
                alt={meal.name}
                className="size-12 shrink-0 rounded-md border bg-muted object-cover"
              />
            ) : (
              <div className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted">
                <Utensils className="size-5 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
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
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function mealToDrafts(meal: MealWithIngredients): IngredientDraft[] {
  return meal.ingredients.map((i) => {
    const grams = i.grams;
    const ratio = grams > 0 ? grams / 100 : 0;
    return {
      name: i.name,
      caloriesPer100g: ratio > 0 ? i.calories / ratio : 0,
      proteinPer100g: ratio > 0 ? (i.protein || 0) / ratio : 0,
      carbsPer100g: ratio > 0 ? (i.carbs || 0) / ratio : 0,
      fatPer100g: ratio > 0 ? (i.fat || 0) / ratio : 0,
      grams,
      calories: i.calories,
      protein: i.protein ?? 0,
      carbs: i.carbs ?? 0,
      fat: i.fat ?? 0,
      source: i.source,
    };
  });
}

function MealAmountForm({
  meal,
  isPending,
  onConfirm,
  onCancel,
}: {
  meal: MealWithIngredients;
  isPending: boolean;
  onConfirm: (
    ingredients: {
      name: string;
      grams: number;
      calories: number;
      protein?: number;
      carbs?: number;
      fat?: number;
      source: "barcode" | "search";
    }[],
  ) => void;
  onCancel: () => void;
}) {
  const [drafts, setDrafts] = useState<IngredientDraft[]>(() => mealToDrafts(meal));

  useEffect(() => {
    setDrafts(mealToDrafts(meal));
  }, [meal]);

  const totals = drafts.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein: acc.protein + (i.protein || 0),
      carbs: acc.carbs + (i.carbs || 0),
      fat: acc.fat + (i.fat || 0),
      grams: acc.grams + (i.grams || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  );

  const originalTotals = {
    calories: meal.calories,
    protein: meal.protein || 0,
    carbs: meal.carbs || 0,
    fat: meal.fat || 0,
    grams: meal.grams,
  };

  const hasChanged = drafts.some((d, idx) => {
    const orig = meal.ingredients[idx];
    return orig ? Math.abs(d.grams - orig.grams) > 0.01 : false;
  });

  const handleGramsChange = (index: number, value: string) => {
    const num = value === "" ? 0 : Number(value);
    if (Number.isNaN(num) || num < 0) return;
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        return makeIngredient(
          {
            name: d.name,
            caloriesPer100g: d.caloriesPer100g,
            proteinPer100g: d.proteinPer100g,
            carbsPer100g: d.carbsPer100g,
            fatPer100g: d.fatPer100g,
          },
          num,
          d.source,
        );
      }),
    );
  };

  const handleReset = () => {
    setDrafts(mealToDrafts(meal));
  };

  const handleConfirm = () => {
    const payload = drafts.map((d) => ({
      name: d.name,
      grams: d.grams,
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
      source: d.source,
    }));
    onConfirm(payload);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{meal.name}</h3>
          {hasChanged && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              type="button"
            >
              <RotateCcw className="size-3" />
              Reset
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Original: {Math.round(originalTotals.calories)} kcal / {Math.round(originalTotals.grams)}g
        </p>
        <p className="mt-1 text-sm font-medium">
          Now: {Math.round(totals.calories)} kcal / {Math.round(totals.grams)}g
        </p>
        <p className="text-xs text-muted-foreground">
          P {Math.round(totals.protein * 10) / 10}g · C {Math.round(totals.carbs * 10) / 10}g · F{" "}
          {Math.round(totals.fat * 10) / 10}g
        </p>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Adjust grams per ingredient — only this entry is affected, your saved meal stays
          unchanged.
        </p>
      </div>

      <div className="flex max-h-[32vh] flex-col gap-2 overflow-y-auto pr-1">
        {drafts.map((ing, idx) => {
          const orig = meal.ingredients[idx];
          const isEdited = orig ? Math.abs(ing.grams - orig.grams) > 0.01 : false;
          return (
            <div
              key={idx}
              className={`rounded-xl border p-3 ${isEdited ? "border-primary/40 bg-primary/5" : "bg-card"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{ing.name}</span>
                <span className="shrink-0 text-xs font-semibold text-primary">
                  {Math.round(ing.calories)} kcal
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                P {Math.round(ing.protein * 10) / 10}g · C {Math.round(ing.carbs * 10) / 10}g · F{" "}
                {Math.round(ing.fat * 10) / 10}g
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor={`meal-ing-${idx}-grams`} className="shrink-0 text-xs">
                  Grams
                </Label>
                <Input
                  id={`meal-ing-${idx}-grams`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={1}
                  value={Number.isNaN(ing.grams) ? "" : ing.grams}
                  onChange={(e) => handleGramsChange(idx, e.target.value)}
                  className="h-8"
                />
                {orig && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    orig {Math.round(orig.grams)}g
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <X className="mr-1 size-4" />
          Back
        </Button>
        <Button className="flex-1" onClick={handleConfirm} disabled={isPending}>
          {isPending ? (
            <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <Check className="mr-1 size-4" />
          )}
          Add
        </Button>
      </div>
    </div>
  );
}
