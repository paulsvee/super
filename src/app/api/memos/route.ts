import { NextRequest, NextResponse } from "next/server";
import { getMemoItems, getAllMemos, getUncategorizedMemos, createMemoItem } from "@/lib/memo-db";

const UNCATEGORIZED_ID = "__uncategorized__";

export async function GET(req: NextRequest) {
  try {
    const folderId = req.nextUrl.searchParams.get("folderId");
    const memos = !folderId
      ? getAllMemos()
      : folderId === UNCATEGORIZED_ID
        ? getUncategorizedMemos()
        : getMemoItems(folderId);
    return NextResponse.json({ memos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { folderId, text, date } = await req.json();
    if (!text) return NextResponse.json({ error: "text ?꾩닔" }, { status: 400 });
    const id = crypto.randomUUID();
    const today = new Date().toISOString().slice(0, 10);
    createMemoItem(id, folderId === UNCATEGORIZED_ID ? null : (folderId ?? null), date ?? today, text);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
