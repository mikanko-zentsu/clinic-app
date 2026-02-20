"use client";

import { cn } from "@/lib/utils";

interface NumPadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  className?: string;
}

const keys = [
  "1", "2", "3",
  "4", "5", "6",
  "7", "8", "9",
  "全部削除", "0", "⌫",
];

export function NumPad({ value, onChange, maxLength = 12, className }: NumPadProps) {
  const handleKey = (key: string) => {
    if (key === "全部削除") {
      onChange("");
    } else if (key === "⌫") {
      onChange(value.slice(0, -1));
    } else {
      if (value.length < maxLength) {
        onChange(value + key);
      }
    }
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Display */}
      <div className="mb-4 rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-right text-3xl font-mono font-bold tracking-widest text-slate-800 min-h-[64px] flex items-center justify-end">
        {value || <span className="text-slate-300">診察券番号を入力</span>}
      </div>

      {/* Keys */}
      <div className="grid grid-cols-3 gap-3">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKey(key)}
            className={cn(
              "h-16 rounded-xl font-bold transition-all active:scale-95 select-none cursor-pointer",
              key === "全部削除"
                ? "text-sm bg-red-100 text-red-700 hover:bg-red-200 active:bg-red-300"
                : key === "⌫"
                ? "text-2xl bg-amber-100 text-amber-700 hover:bg-amber-200 active:bg-amber-300"
                : "text-2xl bg-slate-100 text-slate-800 hover:bg-slate-200 active:bg-slate-300"
            )}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
