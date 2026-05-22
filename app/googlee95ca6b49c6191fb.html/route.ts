import { NextResponse } from "next/server";

export async function GET() {
  return new NextResponse("google-site-verification: googlee95ca6b49c6191fb.html", {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
