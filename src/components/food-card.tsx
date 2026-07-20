"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Copy, Trash2 } from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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
import { cn } from "~/lib/utils";
import { type FoodItem, macroPercents } from "~/lib/food";

interface FoodCardProps {
  item: FoodItem;
  onDelete: () => void;
  onDuplicate: () => void;
  details?: ReactNode;
}

export function FoodCard({ item, onDelete, onDuplicate, details }: FoodCardProps) {
  const [open, setOpen] = useState(false);
  const pct = macroPercents(item);

  const r = 34;
  const c = 2 * Math.PI * r;
  const segs = [
    { key: "protein", pct: pct.protein, color: "hsl(var(--protein))" },
    { key: "carb", pct: pct.carb, color: "hsl(var(--carb))" },
    { key: "fat", pct: pct.fat, color: "hsl(var(--fat))" },
  ] as const;
  let offset = 0;

  return (
    <Card className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm p-0 gap-0">
      {item.photo && <img src={item.photo} alt={item.name} className="h-32 w-full object-cover" />}
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90" aria-hidden>
              <circle
                cx="44"
                cy="44"
                r={r}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="9"
              />
              {segs.map((s) => {
                const len = (s.pct / 100) * c;
                const dash = `${len} ${c - len}`;
                const el = (
                  <circle
                    key={s.key}
                    cx="44"
                    cy="44"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="9"
                    strokeDasharray={dash}
                    strokeDashoffset={-offset}
                    strokeLinecap="butt"
                  />
                );
                offset += len;
                return el;
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-manrope text-lg font-extrabold leading-none text-card-foreground">
                {item.kcal}
              </span>
              <span className="text-[9px] font-medium uppercase text-muted-foreground">kcal</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate font-manrope text-base font-bold text-card-foreground">
              {item.name}
            </h3>
            <p className="text-xs text-muted-foreground">{item.date}</p>
            <div className="mt-2 flex flex-col gap-1">
              <Legend
                color="bg-protein"
                label="Protein"
                value={`${item.protein}g`}
                pct={pct.protein}
              />
              <Legend color="bg-carb" label="Carbs" value={`${item.carb}g`} pct={pct.carb} />
              <Legend color="bg-fat" label="Fat" value={`${item.fat}g`} pct={pct.fat} />
            </div>
          </div>
        </div>

        {open && (
          <div className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
            <p>Total serving weight: {item.grams}g</p>
            {item.note && <p className="mt-1">{item.note}</p>}
            {details && <div className="mt-2">{details}</div>}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen((v) => !v)}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold active:scale-[0.98]"
            aria-expanded={open}
          >
            {open ? "Show less" : "Show more"}
            <ChevronDown
              data-icon="inline-end"
              className={cn("transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onDuplicate}
            aria-label="Copy entry"
            className="size-9 rounded-lg active:scale-95"
          >
            <Copy aria-hidden />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label="Delete entry"
                className="size-9 rounded-lg border-border text-destructive active:scale-95 hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 aria-hidden />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove the entry. Cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={onDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({
  color,
  label,
  value,
  pct,
}: {
  color: string;
  label: string;
  value: string;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={cn("size-2 rounded-full", color)} aria-hidden />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-semibold text-card-foreground">{value}</span>
      <span className="w-8 text-right text-muted-foreground">{pct}%</span>
    </div>
  );
}
