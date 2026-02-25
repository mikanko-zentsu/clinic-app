import { NextRequest, NextResponse } from "next/server";

// Mock in-memory reservations store
export const reservations: Array<{
  reservationNumber: string;
  cardNumber: string;
  date: string;
  startTime: string;
  doctorId: string | null;
  doctorName: string | null;
  maskedName: string | null;
  createdAt: string;
  cancelled: boolean;
}> = [];

let counter = 1;

function generateReservationNumber(): string {
  const num = String(counter++).padStart(4, "0");
  return `R${num}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { cardNumber, date, startTime, doctorId, doctorName, maskedName } = body;

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
      doctorId: doctorId ?? null,
      doctorName: doctorName ?? null,
      maskedName: maskedName ?? null,
      createdAt: new Date().toISOString(),
      cancelled: false,
    };

    reservations.push(reservation);

    return NextResponse.json({ reservation }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "リクエストの処理に失敗しました" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardNumber = searchParams.get("cardNumber");

  if (cardNumber) {
    const found = reservations.filter(
      (r) => r.cardNumber === cardNumber && !r.cancelled
    );
    return NextResponse.json({ reservations: found });
  }

  return NextResponse.json({ reservations });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const reservationNumber = searchParams.get("reservationNumber");

  if (!reservationNumber) {
    return NextResponse.json(
      { error: "reservationNumber は必須です" },
      { status: 400 }
    );
  }

  const reservation = reservations.find(
    (r) => r.reservationNumber === reservationNumber && !r.cancelled
  );

  if (!reservation) {
    return NextResponse.json(
      { error: "予約が見つかりません" },
      { status: 404 }
    );
  }

  reservation.cancelled = true;

  return NextResponse.json({ success: true, reservationNumber });
}
