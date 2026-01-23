import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const providers = authOptions.providers.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
  }));

  return NextResponse.json({
    providers,
    googleConfigured: providers.some((p) => p.id === "google"),
    envVarsSet: {
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
    },
  });
}
