import { useRouter } from "@tanstack/react-router";
import { Button } from "~/components/ui/button";

export function DefaultCatchBoundary({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="text-muted-foreground max-w-md text-center">{error.message}</p>
      <div className="flex gap-2">
        <Button onClick={() => router.invalidate()}>Retry</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
