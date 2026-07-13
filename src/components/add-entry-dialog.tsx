import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Camera, ScanBarcode, Search, Check, X, Loader2, Sparkles } from "lucide-react";
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
import { createEntry, lookupBarcode, searchFood, estimateWithAI } from "~/lib/api";

interface AddEntryDialogProps {
  date: string;
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
    },
    onError: (err) => toast.error(err.message),
  });

  const handleAdd = (data: {
    date: string;
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    grams: number;
    source: "barcode" | "search" | "ai";
    aiDetails?: Record<string, any>;
  }) => addEntryMutation.mutate({ data });

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
          <TabsList className="grid w-full grid-cols-3">
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
          </TabsList>

          <TabsContent value="ai">
            <AIPhotoTab date={date} onAdd={handleAdd} onClose={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="barcode">
            <BarcodeTab date={date} onAdd={handleAdd} onClose={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="search">
            <SearchTab date={date} onAdd={handleAdd} onClose={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AIPhotoTab({
  date,
  onAdd,
  onClose,
}: {
  date: string;
  onAdd: (data: {
    date: string;
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    grams: number;
    source: "ai";
    aiDetails?: Record<string, any>;
  }) => void;
  onClose: () => void;
}) {
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
    if (!result) return;
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
    });
    onClose();
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
          <Button className="flex-1" onClick={handleAccept}>
            <Check className="mr-1 size-4" />
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
            <Camera className="size-8 text-muted-foreground" />
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
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Sparkles className="mr-2 size-4" />
        )}
        Estimate Calories
      </Button>
    </div>
  );
}

function BarcodeTab({
  date,
  onAdd,
  onClose,
}: {
  date: string;
  onAdd: (data: {
    date: string;
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    grams: number;
    source: "barcode";
  }) => void;
  onClose: () => void;
}) {
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<any>(null);
  const [grams, setGrams] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleLookup = async () => {
    if (!barcode.trim()) return;
    setLoading(true);
    try {
      const res = await lookupBarcode({ data: { barcode: barcode.trim() } });
      setProduct(res);
      setGrams(100);
    } catch (err: any) {
      toast.error(err.message || "Product not found");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!product) return;
    const ratio = grams / 100;
    onAdd({
      date,
      name: product.name,
      calories: Math.round(product.caloriesPer100g * ratio),
      protein: Math.round(product.proteinPer100g * ratio * 10) / 10,
      carbs: Math.round(product.carbsPer100g * ratio * 10) / 10,
      fat: Math.round(product.fatPer100g * ratio * 10) / 10,
      grams,
      source: "barcode",
    });
    onClose();
  };

  if (product) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted p-4">
          <h3 className="font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground">
            {Math.round(product.caloriesPer100g)} kcal / 100g
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="barcode-grams">Amount (grams)</Label>
          <Input
            id="barcode-grams"
            type="number"
            value={grams}
            onChange={(e) => setGrams(Number(e.target.value))}
            min={1}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          = {Math.round(product.caloriesPer100g * (grams / 100))} kcal
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setProduct(null)}>
            Back
          </Button>
          <Button className="flex-1" onClick={handleAdd}>
            <Check className="mr-1 size-4" />
            Add
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="barcode-input">Barcode</Label>
        <div className="flex gap-2">
          <Input
            id="barcode-input"
            placeholder="Type or scan barcode"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          />
          <label className="flex shrink-0 cursor-pointer items-center justify-center rounded-md border px-3 hover:bg-muted">
            <Camera className="size-5" />
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if ("BarcodeDetector" in window) {
                  const detector = new (window as any).BarcodeDetector({
                    formats: ["ean_13", "ean_8", "upc_a", "upc_e"],
                  });
                  const img = await createImageBitmap(file);
                  const codes = await detector.detect(img);
                  if (codes.length > 0) {
                    setBarcode(codes[0].rawValue);
                    toast.success("Barcode detected");
                  } else {
                    toast.error("No barcode found in photo");
                  }
                } else {
                  toast.error("Barcode scanning not supported. Please type the barcode.");
                }
              }}
            />
          </label>
        </div>
      </div>
      <Button onClick={handleLookup} disabled={loading || !barcode.trim()}>
        {loading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Search className="mr-2 size-4" />
        )}
        Look Up
      </Button>
    </div>
  );
}

function SearchTab({
  date,
  onAdd,
  onClose,
}: {
  date: string;
  onAdd: (data: {
    date: string;
    name: string;
    calories: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    grams: number;
    source: "search";
  }) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [grams, setGrams] = useState(100);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchFood({ data: { query: query.trim() } });
      setResults(res);
      setSelected(null);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    if (!selected) return;
    const ratio = grams / 100;
    onAdd({
      date,
      name: selected.name,
      calories: Math.round(selected.caloriesPer100g * ratio),
      protein: Math.round(selected.proteinPer100g * ratio * 10) / 10,
      carbs: Math.round(selected.carbsPer100g * ratio * 10) / 10,
      fat: Math.round(selected.fatPer100g * ratio * 10) / 10,
      grams,
      source: "search",
    });
    onClose();
  };

  if (selected) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted p-4">
          <h3 className="font-semibold">{selected.name}</h3>
          <p className="text-sm text-muted-foreground">
            {Math.round(selected.caloriesPer100g)} kcal / 100g
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="search-grams">Amount (grams)</Label>
          <Input
            id="search-grams"
            type="number"
            value={grams}
            onChange={(e) => setGrams(Number(e.target.value))}
            min={1}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          = {Math.round(selected.caloriesPer100g * (grams / 100))} kcal
        </p>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setSelected(null)}>
            Back
          </Button>
          <Button className="flex-1" onClick={handleAdd}>
            <Check className="mr-1 size-4" />
            Add
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="search-input">Food name</Label>
        <div className="flex gap-2">
          <Input
            id="search-input"
            placeholder="e.g. chicken breast, rice..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
      </div>
      <Button onClick={handleSearch} disabled={loading || !query.trim()}>
        {loading ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Search className="mr-2 size-4" />
        )}
        Search
      </Button>

      {results.length > 0 && (
        <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
          {results.map((food, i) => (
            <button
              key={i}
              onClick={() => {
                setSelected(food);
                setGrams(100);
              }}
              className="flex items-center justify-between rounded-lg border p-3 text-left hover:bg-muted"
            >
              <span className="text-sm font-medium">{food.name}</span>
              <span className="text-xs text-muted-foreground">
                {Math.round(food.caloriesPer100g)} kcal/100g
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
