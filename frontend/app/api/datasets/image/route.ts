import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { resolveSafeRawPath } from "../../../../lib/data/server/path-utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const source = searchParams.get("source");
    const relativeImgPath = searchParams.get("path");

    if (!source || !relativeImgPath) {
      return new NextResponse("Missing source or path parameter", { status: 400 });
    }

    // Security check on extension
    const ext = path.extname(relativeImgPath).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext)) {
      return new NextResponse("Invalid file type", { status: 400 });
    }

    let basePath = "";
    if (source === "edge") {
      basePath = "edge-agricultural-sensor/Images/Agricultural-crops";
    } else if (source === "plantvillage") {
      basePath = "plantvillage/plantvillage dataset";
    } else {
      return new NextResponse("Invalid image source identifier", { status: 400 });
    }

    // Resolve safely, ensuring no traversal outside data/raw
    const resolvedPath = resolveSafeRawPath(basePath, relativeImgPath);

    if (!fs.existsSync(resolvedPath)) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(resolvedPath);
    const contentType = ext === ".png" ? "image/png" : "image/jpeg";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Error serving image", { status: 500 });
  }
}
