import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json(); // { interests, grades, goals }
  // TODO: 모델 호출/룰 기반 스코어링
  const result = [
    { id: "cs-apu", score: 0.86 },
    { id: "ds-uni", score: 0.81 },
  ];
  return NextResponse.json({ items: result });
}
