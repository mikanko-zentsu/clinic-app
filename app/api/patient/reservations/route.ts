import { NextRequest, NextResponse } from "next/server";

// Mock in-memory reservations store
const reservations: Array<{
  reservationNumber: string;
  cardNumber: string;
  date: string;
  startTime: string;
  createdAt: string;
}> = [];

let counter = 1;

function generateReservationNumber(): string {
  const num = String(counter++).padStart(4, "0");
  return `R${num}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardNumber, date, startTime } = body;

    if (!cardNumber || !date || !startTime) {
      return NextResponse.json(
        { error: "cardNumber, date, startTime は必須です" },
        { status: 400 }
      );
    }

    const reservation = {
      reservationNumber: generateReservationNumber(),
      cardNumber,
      date,
      startTime,
      createdAt: new Date().toISOString(),
    };

    reservations.push(reservation);

    return NextResponse.json({ reservation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "リクエストの処理に失敗しました" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ reservations });
}
