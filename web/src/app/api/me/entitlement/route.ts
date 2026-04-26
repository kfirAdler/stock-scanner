import { NextResponse } from "next/server";
import { getCurrentEntitlement } from "@/lib/market-access";

export async function GET() {
  const entitlement = await getCurrentEntitlement();
  return NextResponse.json(entitlement);
}
