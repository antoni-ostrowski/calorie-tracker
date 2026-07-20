import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, Search, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { lookupBarcode, searchFood } from "~/lib/api";

export interface FoodInfo {
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export interface IngredientDraft extends FoodInfo {
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  source: "barcode" | "search";
}

export function makeIngredient(
  food: FoodInfo,
  grams: number,
  source: "barcode" | "search",
): IngredientDraft {
  const ratio = grams / 100;
  return {
    ...food,
    grams,
    source,
    calories: Math.round(food.caloriesPer100g * ratio),
    protein: Math.round(food.proteinPer100g * ratio * 10) / 10,
    carbs: Math.round(food.carbsPer100g * ratio * 10) / 10,
    fat: Math.round(food.fatPer100g * ratio * 10) / 10,
  };
}

export function FoodAmountForm({
  food,
  source,
  defaultGrams = 100,
  actionLabel = "Add",
  onConfirm,
  onCancel,
}: {
  food: FoodInfo;
  source: "barcode" | "search";
  defaultGrams?: number;
  actionLabel?: string;
  onConfirm: (ingredient: IngredientDraft) => void;
  onCancel: () => void;
}) {
  const [grams, setGrams] = useState(defaultGrams);
  const ratio = grams / 100;
  const calories = Math.round(food.caloriesPer100g * ratio);
  const protein = Math.round(food.proteinPer100g * ratio * 10) / 10;
  const carbs = Math.round(food.carbsPer100g * ratio * 10) / 10;
  const fat = Math.round(food.fatPer100g * ratio * 10) / 10;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg bg-muted p-4">
        <h3 className="font-semibold">{food.name}</h3>
        <p className="text-sm text-muted-foreground">
          {Math.round(food.caloriesPer100g)} kcal / 100g
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="food-grams">Amount (grams)</Label>
        <Input
          id="food-grams"
          type="number"
          value={grams}
          onChange={(e) => setGrams(Number(e.target.value))}
          min={1}
        />
      </div>
      <p className="text-center text-sm text-muted-foreground">
        = {calories} kcal · P {protein}g · C {carbs}g · F {fat}g
      </p>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          <X className="mr-1 size-4" />
          Back
        </Button>
        <Button className="flex-1" onClick={() => onConfirm(makeIngredient(food, grams, source))}>
          <Check className="mr-1 size-4" />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

export function BarcodeLookup({ onSelect }: { onSelect: (food: FoodInfo) => void }) {
  const [barcode, setBarcode] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerId, setScannerId] = useState<string | null>(null);
  const lookupStartedRef = useRef(false);

  useEffect(() => {
    if (!scanning || !scannerId) {
      setScannerError(null);
      return;
    }

    const element = document.getElementById(scannerId);
    if (!element) {
      setScannerError(`Scanner element ${scannerId} not found`);
      setScanning(false);
      return;
    }

    let active = true;
    let scanner: Html5Qrcode | null = null;
    let started = false;

    const stopAndClear = async () => {
      if (!scanner) return;
      if (scanner.isScanning) {
        try {
          await scanner.stop();
        } catch (e: any) {
          console.error("[barcode] stop error", e);
        }
      }
      try {
        scanner.clear();
      } catch (e: any) {
        console.error("[barcode] clear error", e);
      }
    };

    (async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!active) return;

        if (!cameras || cameras.length === 0) {
          setScannerError("No camera found");
          setScanning(false);
          return;
        }

        const preferred = cameras.find((camera) => /back|rear|environment/i.test(camera.label));
        const cameraId = preferred?.id ?? cameras[0].id;

        scanner = new Html5Qrcode(scannerId);
        await scanner.start(
          cameraId,
          { fps: 10, qrbox: 250 },
          (decodedText: string) => {
            if (lookupStartedRef.current) return;
            lookupStartedRef.current = true;
            setBarcode(decodedText);
            setScanning(false);
            lookupProduct(decodedText);
          },
          () => {
            // frame-level errors ignored
          },
        );

        started = true;
        if (!active) await stopAndClear();
      } catch (err: any) {
        if (!active) return;
        setScannerError(err?.message || String(err));
        setScanning(false);
      }
    })();

    return () => {
      active = false;
      if (started) {
        stopAndClear();
      }
    };
  }, [scanning, scannerId]);

  const lookupProduct = useCallback(
    async (code: string) => {
      if (!code.trim()) return;
      setLoading(true);
      try {
        const res = await lookupBarcode({ data: { barcode: code.trim() } });
        onSelect(res);
      } catch (err: any) {
        toast.error(err.message || "Product not found");
      } finally {
        setLoading(false);
        lookupStartedRef.current = false;
      }
    },
    [onSelect],
  );

  const startScanner = () => {
    lookupStartedRef.current = false;
    setScannerError(null);
    setScannerId(`barcode-scanner-${Math.random().toString(36).slice(2)}`);
    setScanning(true);
  };

  const stopScanner = () => setScanning(false);

  if (scanning && scannerId) {
    return (
      <div className="flex flex-col gap-2">
        <div
          id={scannerId}
          className="relative w-full min-h-[300px] rounded-lg overflow-hidden bg-black"
        />
        <Button variant="outline" onClick={stopScanner}>
          Cancel scanning
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="barcode-input">Barcode</Label>
        <Input
          id="barcode-input"
          placeholder="Type barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && lookupProduct(barcode)}
        />
        {scannerError && <p className="text-xs text-destructive">Scanner error: {scannerError}</p>}
      </div>
      <Button variant="outline" onClick={startScanner}>
        <Camera className="mr-2 size-4" />
        Scan with camera
      </Button>
      <Button onClick={() => lookupProduct(barcode)} disabled={loading || !barcode.trim()}>
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

export function SearchLookup({ onSelect }: { onSelect: (food: FoodInfo) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchFood({ data: { query: query.trim() } });
      setResults(res);
    } catch (err: any) {
      toast.error(err.message || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="search-input">Food name</Label>
        <Input
          id="search-input"
          placeholder="e.g. chicken breast, rice..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
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
              onClick={() => onSelect(food)}
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
