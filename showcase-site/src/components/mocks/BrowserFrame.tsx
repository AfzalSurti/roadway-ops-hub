import type { ReactNode } from "react";

type BrowserFrameProps = {
  title: string;
  children: ReactNode;
  className?: string;
};

export function BrowserFrame({ title, children, className = "" }: BrowserFrameProps) {
  return (
    <div className={`glass overflow-hidden shadow-2xl shadow-black/40 ${className}`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/40">
        <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-[10px] text-muted-foreground font-mono truncate flex-1">{title}</span>
      </div>
      <div className="bg-[hsl(222,22%,7%)] text-[11px] leading-tight">{children}</div>
    </div>
  );
}
