export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { updateTodoItem, deleteTodoItem } from "@/lib/todo-db";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    updateTodoItem(params.id, { text: body.text, done: body.done });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    deleteTodoItem(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
