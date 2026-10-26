import { NextResponse, type NextRequest } from "next/server";

// Proxies the file upload to the API so the admin token stays server-side.
export async function POST(req: NextRequest, { params }: { params: Promise<{ tid: string }> }) {
  if (req.cookies.get("qf_admin")?.value !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { tid } = await params;
  const res = await fetch(`${process.env.API_URL ?? "http://localhost:4000"}/v1/tenants/${tid}/import/parse`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` },
    body: await req.formData(),
  });
  return new NextResponse(await res.text(), { status: res.status, headers: { "content-type": "application/json" } });
}
