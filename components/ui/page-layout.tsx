import * as React from "react";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function PageLayout({
  title,
  description,
  children,
  className,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-[hsl(210_40%_98%)] py-8 px-4">
      <div className={cn("w-full max-w-4xl", className)}>
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[hsl(222_47%_11%)]">{title}</h1>
          {description && (
            <p className="mt-2 text-slate-500 text-lg">{description}</p>
          )}
        </div>
        <div className="bg-white rounded-2xl border border-[hsl(214_32%_91%)] shadow-sm p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
