import { useEffect, useState } from "react";
import { Camera, Check, Trash2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  BarcodeLookup,
  FoodAmountForm,
  SearchLookup,
  type FoodInfo,
  type IngredientDraft,
} from "~/components/food-pickers";
import type { MealWithIngredients } from "~/db/schema";

export interface MealBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMeal?: MealWithIngredients | null;
  onSave: (meal: {
    name: string;
    ingredients: IngredientDraft[];
    photoStr?: string | null;
  }) => void;
  onDelete?: (id: number) => void;
  isPending?: boolean;
}

function mealToDrafts(meal: MealWithIngredients): IngredientDraft[] {
  return meal.ingredients.map((i) => {
    const ratio = i.grams > 0 ? i.grams / 100 : 0;
    return {
      name: i.name,
      caloriesPer100g: ratio > 0 ? i.calories / ratio : 0,
      proteinPer100g: ratio > 0 ? (i.protein || 0) / ratio : 0,
      carbsPer100g: ratio > 0 ? (i.carbs || 0) / ratio : 0,
      fatPer100g: ratio > 0 ? (i.fat || 0) / ratio : 0,
      grams: i.grams,
      calories: i.calories,
      protein: i.protein ?? 0,
      carbs: i.carbs ?? 0,
      fat: i.fat ?? 0,
      source: i.source,
    };
  });
}

export function MealBuilderDialog({
  open,
  onOpenChange,
  initialMeal,
  onSave,
  onDelete,
  isPending,
}: MealBuilderDialogProps) {
  const [name, setName] = useState("");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [view, setView] = useState<"list" | "barcode" | "search" | "amount">("list");
  const [selectedFood, setSelectedFood] = useState<FoodInfo | null>(null);
  const [selectedSource, setSelectedSource] = useState<"barcode" | "search">("barcode");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initialMeal?.name ?? "");
    setIngredients(initialMeal ? mealToDrafts(initialMeal) : []);
    setView("list");
    setSelectedFood(null);
    setPhoto(initialMeal?.filePath ? `api/meal-img/${initialMeal.id}` : null);
    setPhotoChanged(false);
  }, [open, initialMeal]);

  const totals = ingredients.reduce(
    (acc, i) => ({
      calories: acc.calories + (i.calories || 0),
      protein: acc.protein + (i.protein || 0),
      carbs: acc.carbs + (i.carbs || 0),
      fat: acc.fat + (i.fat || 0),
      grams: acc.grams + (i.grams || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, grams: 0 },
  );

  const handleSelectFood = (food: FoodInfo, source: "barcode" | "search") => {
    setSelectedFood(food);
    setSelectedSource(source);
    setView("amount");
  };

  const handleAddIngredient = (ingredient: IngredientDraft) => {
    setIngredients((prev) => [...prev, ingredient]);
    setView("list");
    setSelectedFood(null);
  };

  const handleRemove = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!name.trim() || ingredients.length === 0) return;
    onSave({
      name: name.trim(),
      ingredients,
      photoStr: photoChanged ? photo : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialMeal ? "Edit meal" : "Add meal"}</DialogTitle>
        </DialogHeader>

        {view === "list" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="meal-name">Meal name</Label>
              <Input
                id="meal-name"
                placeholder="e.g. Breakfast oats"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Photo (optional)</Label>
              {photo ? (
                <div className="relative w-full">
                  <img
                    src={photo}
                    alt={name}
                    className="aspect-video w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => {
                      setPhoto(null);
                      setPhotoChanged(true);
                    }}
                    className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-black/50 text-white"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <label className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/25 p-6 hover:bg-muted/50">
                  <Camera className="size-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Take a photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setPhoto(reader.result as string);
                        setPhotoChanged(true);
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>

            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-muted-foreground">Total</p>
              <p className="text-lg font-bold">{Math.round(totals.calories)} kcal</p>
              <p className="text-xs text-muted-foreground">
                {Math.round(totals.grams)}g · P {Math.round(totals.protein)}g · C{" "}
                {Math.round(totals.carbs)}g · F {Math.round(totals.fat)}g
              </p>
            </div>

            {ingredients.length > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-muted-foreground">Ingredients</p>
                {ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">{ing.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(ing.grams)}g · {Math.round(ing.calories)} kcal
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(i)}
                      className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">Add ingredient</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setView("barcode")}>
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
                    className="mr-2 size-4"
                  >
                    <path d="M3 5v14" />
                    <path d="M8 5v14" />
                    <path d="M12 5v14" />
                    <path d="M17 5v14" />
                    <path d="M21 5v14" />
                  </svg>
                  Barcode
                </Button>
                <Button variant="outline" onClick={() => setView("search")}>
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
                    className="mr-2 size-4"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  Search
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                disabled={!name.trim() || ingredients.length === 0 || isPending}
              >
                {isPending ? (
                  <span className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                ) : (
                  <Check className="mr-2 size-4" />
                )}
                Save
              </Button>
            </div>

            {initialMeal && onDelete && (
              <Button
                variant="outline"
                className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onDelete(initialMeal.id)}
                disabled={isPending}
              >
                <Trash2 className="mr-2 size-4" />
                Delete meal
              </Button>
            )}
          </div>
        )}

        {view === "barcode" && (
          <div className="flex flex-col gap-4">
            <Button variant="outline" className="w-full" onClick={() => setView("list")}>
              <X className="mr-2 size-4" />
              Cancel
            </Button>
            <BarcodeLookup onSelect={(food) => handleSelectFood(food, "barcode")} />
          </div>
        )}

        {view === "search" && (
          <div className="flex flex-col gap-4">
            <Button variant="outline" className="w-full" onClick={() => setView("list")}>
              <X className="mr-2 size-4" />
              Cancel
            </Button>
            <SearchLookup onSelect={(food) => handleSelectFood(food, "search")} />
          </div>
        )}

        {view === "amount" && selectedFood && (
          <FoodAmountForm
            food={selectedFood}
            source={selectedSource}
            actionLabel="Add ingredient"
            onConfirm={handleAddIngredient}
            onCancel={() => {
              setView("list");
              setSelectedFood(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
