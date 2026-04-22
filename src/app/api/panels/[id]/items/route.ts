export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getTodoItems, createTodoItem } from "@/lib/todo-db";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const items = getTodoItems(params.id);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { text } = await req.json();
    if (!text) return NextResponse.json({ error: "text 필수" }, { status: 400 });
    const id = crypto.randomUUID();
    createTodoItem(id, params.id, text);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
