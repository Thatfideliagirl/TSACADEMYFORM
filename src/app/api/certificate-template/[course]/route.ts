import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// The blank certificate picture for a course. It holds no personal data, so students can load it to draw their certificate.
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ course: string }> }) {
  const { course } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(course)) return new NextResponse("Not found", { status: 404 });
  const { data } = await createAdminClient().from("certificate_templates").select("image").eq("course_id", course).maybeSingle();
  const match = /^data:(image\/(?:jpeg|png));base64,([\s\S]+)$/.exec(data?.image ?? "");
  if (!match) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(Buffer.from(match[2], "base64")), {
    headers: { "content-type": match[1], "cache-control": "public, max-age=31536000, immutable" },
  });
}
