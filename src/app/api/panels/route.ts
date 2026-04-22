import { NextRequest, NextResponse } from "next/server";
import { getAllPanels, createPanel, getPanelItemCount } from "@/lib/todo-db";

// GET /api/panels?categoryId=xxx
// 전체 패널 반환 (main+dream 통합), categoryId 있으면 필터링

export async function GET(req: NextRequest) {
  try {
    const categoryId = req.nextUrl.searchParams.get("categoryId");
    const panels = getAllPanels();

    const filtered = categoryId
      ? panels.filter((p) => p.categoryIds.includes(categoryId))
      : panels;

    const result = filtered.map((p) => ({
      ...p,
      itemCount: getPanelItemCount(p.id),
    }));

    return NextResponse.json({ panels: result });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/panels
// Body: { title, color, mode: "main"|"dream" }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, color, mode = "main" } = body;
    if (!title) return NextResponse.json({ error: "title 필수" }, { status: 400 });

    const id = crypto.randomUUID();
    createPanel(id, mode as "main" | "dream", title, color ?? "#7c98ff");
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
