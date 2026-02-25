import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarDays, ClipboardList, UserRound } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[hsl(210_40%_98%)] px-4">
      <div className="w-full max-w-xl text-center">
        {/* Logo / Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 rounded-full bg-sky-500 flex items-center justify-center shadow-lg">
            <CalendarDays className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-extrabold text-[hsl(222_47%_11%)] mb-2">
          ようこそ〇〇接骨院へ
        </h1>
        <h2 className="text-lg font-semibold text-sky-600 mb-4">
          受付システム
        </h2>
        <p className="text-slate-500 text-lg mb-10">
          ご希望の方法でご予約ください
        </p>

        {/* Buttons */}
        <div className="flex flex-col gap-4">
          <Link href="/reserve?mode=doctor">
            <Button size="xl" variant="outline" className="w-full text-xl py-5 rounded-2xl shadow-sm gap-3">
              <UserRound className="w-6 h-6" />
              担当医から予約する
            </Button>
          </Link>
          <Link href="/reserve?mode=date">
            <Button size="xl" variant="outline" className="w-full text-xl py-5 rounded-2xl shadow-sm gap-3">
              <CalendarDays className="w-6 h-6" />
              日付から予約する
            </Button>
          </Link>
          <Link href="/check">
            <Button size="xl" variant="outline" className="w-full text-xl py-5 rounded-2xl shadow-sm gap-3">
              <ClipboardList className="w-6 h-6" />
              予約確認
            </Button>
          </Link>
        </div>

        <p className="mt-8 text-slate-400 text-sm">
          画面の案内に沿って操作してください。
        </p>
      </div>
    </div>
  );
}
