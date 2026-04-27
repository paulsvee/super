export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { createFolder } from "@/lib/memo-db";
import { getRemoteMemoFolders } from "@/lib/remote-data";

export async function GET() {
  try {
    return NextResponse.json({ folders: await getRemoteMemoFolders() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: "name 필수" }, { status: 400 });
    const id = crypto.randomUUID();
    createFolder(id, name);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
