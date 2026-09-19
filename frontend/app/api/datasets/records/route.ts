import { NextRequest, NextResponse } from "next/server";
import { loadDatasetRecords } from "../../../../lib/data/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const dataset = searchParams.get("dataset") ?? "crop-recommendation";
    const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25));
    const station = searchParams.get("station") ?? undefined;
    const variant = (searchParams.get("variant") as "color" | "grayscale" | "segmented" | null) ?? undefined;
    const label = searchParams.get("label") ?? undefined;

    const result = await loadDatasetRecords(dataset, {
      offset,
      limit,
      station,
      variant,
      label,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load dataset records",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}
