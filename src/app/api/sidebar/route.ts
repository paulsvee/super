export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getRemoteMemoFolders, getRemoteSidebarCategories } from "@/lib/remote-data";

export async function GET() {
  try {
    const [categories, memoFolders] = await Promise.all([
      getRemoteSidebarCategories(),
      getRemoteMemoFolders(),
    ]);
    return NextResponse.json({ categories, memoFolders });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
