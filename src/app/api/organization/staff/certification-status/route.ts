import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { checkAllMembersCertifications } from "@/lib/services/certification-check";

export async function GET(request: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizationId = session.user.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "No organization selected" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") as "programs" | "events" | "competitions" | null;

    if (!scope || !["programs", "events", "competitions"].includes(scope)) {
      return NextResponse.json({ error: "Invalid scope parameter" }, { status: 400 });
    }

    const result = await checkAllMembersCertifications(organizationId, scope);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching certification status:", error);
    return NextResponse.json({ error: "Failed to fetch certification status" }, { status: 500 });
  }
}
