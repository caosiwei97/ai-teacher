"use client";

export function BlockSkeleton() {
  return (
    <div className="animate-[fadeSlideIn_0.3s_ease-out] rounded-lg border border-border/40 bg-muted/30 p-4">
      <div className="space-y-3">
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted-foreground/10" />
        <div className="h-3 w-full animate-pulse rounded bg-muted-foreground/10" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-muted-foreground/10" />
      </div>
    </div>
  );
}
