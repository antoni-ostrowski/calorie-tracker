import { useLocation, useNavigate, useRouterState } from "@tanstack/react-router";
import { format } from "date-fns";
import { History, Home, Settings } from "lucide-react";
import { AddEntryDialog } from "~/components/add-entry-dialog";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

const TABS = [
  { value: "/", label: "Home", icon: Home },
  { value: "/history", label: "History", icon: History },
  { value: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const location = useLocation();
  const rawSearch = location.search;
  const search =
    typeof rawSearch === "string"
      ? (Object.fromEntries(new URLSearchParams(rawSearch)) as Record<string, unknown>)
      : (rawSearch as Record<string, unknown> | undefined);
  const urlDate = typeof search?.date === "string" ? search.date : undefined;
  const dateStr =
    urlDate && !isNaN(new Date(urlDate + "T00:00:00").getTime())
      ? urlDate
      : format(new Date(), "yyyy-MM-dd");

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-pb">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <Tabs value={pathname} onValueChange={(value) => navigate({ to: value, replace: true })}>
          <TabsList className="flex h-auto justify-start gap-1 bg-transparent p-0">
            {TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl px-5 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <tab.icon className="size-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <AddEntryDialog date={dateStr} />
      </div>
    </div>
  );
}
