import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export interface Doctor {
  id: string;
  name: string;
  nameKana: string;
  role: string;
  specialty: string;
  avatarColor: string;
  initials: string;
  // weekday availability: 0=Sun...6=Sat, true=available
  availableWeekdays: number[];
  // available time ranges per day type
  morningStart: string;
  morningEnd: string;
  afternoonStart: string | null;
  afternoonEnd: string | null;
  bio: string;
}

export const DOCTORS: Doctor[] = [
  {
    id: "doctor-1",
    name: "田中 誠",
    nameKana: "たなか まこと",
    role: "院長",
    specialty: "柔道整復師・鍼灸師",
    avatarColor: "#0d9488",
    initials: "田中",
    availableWeekdays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    morningStart: "09:00",
    morningEnd: "12:40",
    afternoonStart: "16:00",
    afternoonEnd: "19:40",
    bio: "20年以上の経験を持つ院長。スポーツ外傷・骨折・脱臼の治療を専門としています。",
  },
  {
    id: "doctor-2",
    name: "鈴木 由美",
    nameKana: "すずき ゆみ",
    role: "副院長",
    specialty: "鍼灸師",
    avatarColor: "#7c3aed",
    initials: "鈴木",
    availableWeekdays: [1, 2, 3, 4, 5], // Mon-Fri
    morningStart: "09:00",
    morningEnd: "12:40",
    afternoonStart: "16:00",
    afternoonEnd: "19:40",
    bio: "鍼灸治療・美容鍼を専門とする副院長。慢性痛・自律神経の治療が得意です。",
  },
  {
    id: "doctor-3",
    name: "佐藤 健",
    nameKana: "さとう けん",
    role: "スタッフ",
    specialty: "柔道整復師",
    avatarColor: "#ea580c",
    initials: "佐藤",
    availableWeekdays: [1, 2, 3, 4, 5, 6], // Mon-Sat
    morningStart: "09:00",
    morningEnd: "12:40",
    afternoonStart: "16:00",
    afternoonEnd: "19:40",
    bio: "スポーツ整体・テーピングを専門とするスタッフ。アスリートのサポート実績多数。",
  },
];

export async function GET() {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, color, slug");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // DOCTORS定数から名前でマッチして追加情報を付与
  const nameToDoctorInfo: Record<string, Doctor> = {};
  for (const d of DOCTORS) {
    nameToDoctorInfo[d.name] = d;
  }

  const doctors = (data ?? []).map((s) => {
    const info = nameToDoctorInfo[s.name];
    return {
      id: s.slug,
      name: s.name,
      color: s.color,
      nameKana: info?.nameKana ?? "",
      role: info?.role ?? "",
      specialty: info?.specialty ?? "",
      avatarColor: info?.avatarColor ?? s.color,
      initials: info?.initials ?? s.name.charAt(0),
      availableWeekdays: info?.availableWeekdays ?? [1, 2, 3, 4, 5, 6],
      bio: info?.bio ?? "",
    };
  });

  return NextResponse.json({ doctors });
}
