import { NextResponse } from "next/server";
import { getSidebarCategories } from "@/lib/todo-db";
import { getAllFolders, getUncategorizedFolder } from "@/lib/memo-db";

export async function GET() {
  try {
    const categories = getSidebarCategories();
    const memoFolders = getAllFolders();
    const uncategorizedFolder = getUncategorizedFolder();

    const sortedMemoFolders = [...memoFolders, ...(uncategorizedFolder ? [uncategorizedFolder] : [])].sort(
      (a, b) =>
        ((b.latestAt ?? b.createdAt) - (a.latestAt ?? a.createdAt)) ||
        (b.createdAt - a.createdAt) ||
        a.name.localeCompare(b.name, "ko") ||
        a.id.localeCompare(b.id)
    );

    return NextResponse.json({ categories, memoFolders: sortedMemoFolders });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
