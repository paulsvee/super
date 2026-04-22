import Database from "better-sqlite3";
import path from "path";

// todo-carousel의 DB를 직접 참조 (양방향 연동)
const DB_PATH = path.join(process.cwd(), "..", "todo-carousel", "data", "todo-carousel.db");

let _db: Database.Database | null = null;
export function getTodoDB(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  const todoItemColumns = _db.prepare("PRAGMA table_info(todo_items)").all() as { name: string }[];
  if (!todoItemColumns.some((column) => column.name === "updated_at")) {
    _db.exec("ALTER TABLE todo_items ADD COLUMN updated_at INTEGER");
  }
  return _db;
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

export type TodoPanel = {
  id: string;
  mode: "main" | "dream";
  title: string;
  color: string;
  createdAt: number;
  categoryIds: string[];
  categoryAssignedAt: number | null;
  isSpecial: boolean;
  bgImage: string | null;
  sortOrder: number;
};

export type TodoItem = {
  id: string;
  panelId: string;
  text: string;
  done: boolean;
  createdAt: number;
  updatedAt: number | null;
  sortOrder: number;
};

export type TodoCategory = {
  id: string;
  mode: string;
  name: string;
  createdAt: number;
};

export type SidebarCategory = {
  id: string;
  mode: string;
  name: string;
  createdAt: number;
  latestAt: number;
  preview: string;
};

// ─── 패널 조회 ───────────────────────────────────────────────────────────────

export function getAllPanels(): TodoPanel[] {
  const db = getTodoDB();
  const rows = db
    .prepare("SELECT * FROM panels ORDER BY mode, sort_order ASC, created_at ASC")
    .all() as {
      id: string; mode: string; title: string; color: string;
      created_at: number; category_assigned_at: number | null;
      is_special: number; bg_image: string | null; sort_order: number;
    }[];

  return rows.map((r) => {
    const categoryIds = (
      db.prepare("SELECT category_id FROM panel_categories WHERE panel_id = ?").all(r.id) as { category_id: string }[]
    ).map((x) => x.category_id);

    return {
      id: r.id,
      mode: r.mode as "main" | "dream",
      title: r.title,
      color: r.color,
      createdAt: r.created_at,
      categoryIds,
      categoryAssignedAt: r.category_assigned_at,
      isSpecial: r.is_special === 1,
      bgImage: r.bg_image,
      sortOrder: r.sort_order,
    };
  });
}

export function getPanelById(id: string): TodoPanel | null {
  const db = getTodoDB();
  const row = db.prepare("SELECT * FROM panels WHERE id = ?").get(id) as {
    id: string; mode: string; title: string; color: string;
    created_at: number; category_assigned_at: number | null;
    is_special: number; bg_image: string | null; sort_order: number;
  } | undefined;
  if (!row) return null;

  const categoryIds = (
    db.prepare("SELECT category_id FROM panel_categories WHERE panel_id = ?").all(id) as { category_id: string }[]
  ).map((x) => x.category_id);

  return {
    id: row.id, mode: row.mode as "main" | "dream",
    title: row.title, color: row.color, createdAt: row.created_at,
    categoryIds, categoryAssignedAt: row.category_assigned_at,
    isSpecial: row.is_special === 1, bgImage: row.bg_image, sortOrder: row.sort_order,
  };
}

export function createPanel(id: string, mode: "main" | "dream", title: string, color: string): void {
  const db = getTodoDB();
  const now = Date.now();
  const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM panels WHERE mode = ?").get(mode) as { m: number | null }).m ?? 0;
  db.prepare(`
    INSERT INTO panels (id, mode, title, color, created_at, is_special, sort_order)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `).run(id, mode, title, color, now, maxOrder + 1);
}

export function updatePanel(id: string, data: { title?: string; color?: string }): void {
  const db = getTodoDB();
  if (data.title !== undefined) db.prepare("UPDATE panels SET title = ? WHERE id = ?").run(data.title, id);
  if (data.color !== undefined) db.prepare("UPDATE panels SET color = ? WHERE id = ?").run(data.color, id);
}

export function deletePanel(id: string): void {
  getTodoDB().prepare("DELETE FROM panels WHERE id = ?").run(id);
}

// ─── 아이템 조회 ─────────────────────────────────────────────────────────────

export function getTodoItems(panelId: string): TodoItem[] {
  return (
    getTodoDB()
      .prepare("SELECT * FROM todo_items WHERE panel_id = ? ORDER BY sort_order ASC, created_at ASC")
      .all(panelId) as { id: string; panel_id: string; text: string; done: number; created_at: number; updated_at: number | null; sort_order: number }[]
  ).map((r) => ({
    id: r.id, panelId: r.panel_id, text: r.text,
    done: r.done === 1, createdAt: r.created_at, updatedAt: r.updated_at ?? null, sortOrder: r.sort_order,
  }));
}

export function createTodoItem(id: string, panelId: string, text: string): void {
  const db = getTodoDB();
  const now = Date.now();
  const maxOrder = (db.prepare("SELECT MAX(sort_order) as m FROM todo_items WHERE panel_id = ?").get(panelId) as { m: number | null }).m ?? 0;
  db.prepare(`
    INSERT INTO todo_items (id, panel_id, text, done, created_at, updated_at, sort_order)
    VALUES (?, ?, ?, 0, ?, ?, ?)
  `).run(id, panelId, text, now, now, maxOrder + 1);
}

export function updateTodoItem(id: string, data: { text?: string; done?: boolean }): void {
  const db = getTodoDB();
  const now = Date.now();
  if (data.text !== undefined) db.prepare("UPDATE todo_items SET text = ?, updated_at = ? WHERE id = ?").run(data.text, now, id);
  if (data.done !== undefined) db.prepare("UPDATE todo_items SET done = ?, updated_at = ? WHERE id = ?").run(data.done ? 1 : 0, now, id);
}

export function deleteTodoItem(id: string): void {
  getTodoDB().prepare("DELETE FROM todo_items WHERE id = ?").run(id);
}

// ─── 카테고리 ────────────────────────────────────────────────────────────────

export function getCategories(mode = "main"): TodoCategory[] {
  return (
    getTodoDB()
      .prepare("SELECT * FROM categories WHERE mode = ? ORDER BY created_at ASC")
      .all(mode) as { id: string; mode: string; name: string; created_at: number }[]
  ).map((r) => ({ id: r.id, mode: r.mode, name: r.name, createdAt: r.created_at }));
}

export function getSidebarCategories(): SidebarCategory[] {
  const rows = getTodoDB()
    .prepare(`
      SELECT
        c.id,
        c.mode,
        c.name,
        c.created_at,
        COALESCE(MAX(COALESCE(ti.updated_at, ti.created_at, p.category_assigned_at, p.created_at, c.created_at)), c.created_at) AS latest_at,
        (
          SELECT COALESCE(
            (
              SELECT ti3.text
              FROM todo_items ti3
              WHERE ti3.panel_id = p2.id
              ORDER BY COALESCE(ti3.updated_at, ti3.created_at) DESC, ti3.sort_order DESC
              LIMIT 1
            ),
            p2.title
          )
          FROM panel_categories pc2
          JOIN panels p2 ON p2.id = pc2.panel_id
          LEFT JOIN todo_items ti2 ON ti2.panel_id = p2.id
          WHERE pc2.category_id = c.id
          GROUP BY p2.id
          ORDER BY MAX(COALESCE(ti2.updated_at, ti2.created_at, p2.created_at)) DESC, p2.created_at DESC, p2.title ASC
          LIMIT 1
        ) AS preview
      FROM categories c
      LEFT JOIN panel_categories pc ON pc.category_id = c.id
      LEFT JOIN panels p ON p.id = pc.panel_id
      LEFT JOIN todo_items ti ON ti.panel_id = p.id
      GROUP BY c.id
      ORDER BY latest_at DESC, c.created_at DESC, c.name COLLATE NOCASE ASC
    `)
    .all() as {
      id: string;
      mode: string;
      name: string;
      created_at: number;
      latest_at: number;
      preview: string | null;
    }[];

  const byName = new Map<string, SidebarCategory>();

  for (const row of rows) {
    const existing = byName.get(row.name);
    const candidate: SidebarCategory = {
      id: row.id,
      mode: row.mode,
      name: row.name,
      createdAt: row.created_at,
      latestAt: row.latest_at ?? row.created_at,
      preview: row.preview ?? "",
    };

    if (
      !existing ||
      candidate.latestAt > existing.latestAt ||
      (candidate.latestAt === existing.latestAt && candidate.createdAt > existing.createdAt) ||
      (candidate.latestAt === existing.latestAt && candidate.createdAt === existing.createdAt && candidate.id.localeCompare(existing.id) < 0)
    ) {
      byName.set(row.name, candidate);
    }
  }

  return Array.from(byName.values()).sort((a, b) =>
    (b.latestAt - a.latestAt) ||
    (b.createdAt - a.createdAt) ||
    a.name.localeCompare(b.name, "ko") ||
    a.id.localeCompare(b.id)
  );
}

// ─── 패널 아이템 수 ──────────────────────────────────────────────────────────

export function getPanelItemCount(panelId: string): number {
  const r = getTodoDB().prepare("SELECT COUNT(*) as cnt FROM todo_items WHERE panel_id = ?").get(panelId) as { cnt: number };
  return r.cnt;
}
