import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "..", "one-psv", "data", "one-psv.db");

let _db: Database.Database | null = null;

function ensureColumn(db: Database.Database, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((item) => item.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getMemoDB(): Database.Database {
  if (_db) return _db;

  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE TABLE IF NOT EXISTS memos (
      id         TEXT PRIMARY KEY,
      folder_id  TEXT REFERENCES folders(id) ON DELETE SET NULL,
      date       TEXT NOT NULL,
      text       TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_memos_date      ON memos(date);
    CREATE INDEX IF NOT EXISTS idx_memos_folder_id ON memos(folder_id);
  `);

  ensureColumn(_db, "folders", "image", "TEXT");
  ensureColumn(_db, "memos", "color", "TEXT");
  ensureColumn(_db, "memos", "image", "TEXT");
  ensureColumn(_db, "memos", "note", "TEXT");
  ensureColumn(_db, "memos", "updated_at", "INTEGER");

  return _db;
}

export type MemoFolder = {
  id: string;
  name: string;
  createdAt: number;
  memoCount: number;
  latestText: string;
  latestAt: number;
  image: string | null;
};

export type MemoItem = {
  id: string;
  folderId: string | null;
  date: string;
  text: string;
  createdAt: number;
  updatedAt: number | null;
  color: string | null;
  image: string | null;
  note: string | null;
};

export function getAllFolders(): MemoFolder[] {
  return (
    getMemoDB()
      .prepare(`
        SELECT f.id, f.name, f.created_at, f.image,
               COUNT(m.id) AS memo_count,
               COALESCE(MAX(COALESCE(m.updated_at, m.created_at)), f.created_at) AS latest_at,
               (SELECT text FROM memos WHERE folder_id = f.id ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1) AS latest_text
          FROM folders f
          LEFT JOIN memos m ON m.folder_id = f.id
         GROUP BY f.id
         ORDER BY COALESCE(MAX(COALESCE(m.updated_at, m.created_at)), f.created_at) DESC
      `)
      .all() as {
        id: string;
        name: string;
        created_at: number;
        image: string | null;
        memo_count: number;
        latest_at: number;
        latest_text: string | null;
      }[]
  ).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    image: row.image ?? null,
    memoCount: row.memo_count,
    latestAt: row.latest_at,
    latestText: row.latest_text ?? "",
  }));
}

export function getFolderById(id: string): MemoFolder | null {
  const row = getMemoDB()
    .prepare(`
      SELECT f.id, f.name, f.created_at, f.image, COUNT(m.id) AS memo_count
        FROM folders f
        LEFT JOIN memos m ON m.folder_id = f.id
       WHERE f.id = ?
       GROUP BY f.id
    `)
    .get(id) as {
      id: string;
      name: string;
      created_at: number;
      image: string | null;
      memo_count: number;
    } | undefined;

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    image: row.image ?? null,
    memoCount: row.memo_count,
    latestText: "",
    latestAt: row.created_at,
  };
}

export function createFolder(id: string, name: string): void {
  getMemoDB()
    .prepare("INSERT INTO folders (id, name) VALUES (?, ?)")
    .run(id, name);
}

export function updateFolder(id: string, name: string): void {
  getMemoDB()
    .prepare("UPDATE folders SET name = ? WHERE id = ?")
    .run(name, id);
}

export function deleteFolder(id: string): void {
  getMemoDB()
    .prepare("DELETE FROM folders WHERE id = ?")
    .run(id);
}

function mapMemoRows(rows: {
  id: string;
  folder_id: string | null;
  date: string;
  text: string;
  created_at: number;
  updated_at: number | null;
  color: string | null;
  image: string | null;
  note: string | null;
}[]): MemoItem[] {
  return rows.map((row) => ({
    id: row.id,
    folderId: row.folder_id,
    date: row.date,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    color: row.color ?? null,
    image: row.image ?? null,
    note: row.note ?? null,
  }));
}

export function getMemoItems(folderId: string): MemoItem[] {
  return mapMemoRows(
    getMemoDB()
      .prepare(`
        SELECT id, folder_id, date, text, created_at, updated_at, color, image, note
        FROM memos
        WHERE folder_id = ?
        ORDER BY date DESC, created_at ASC
      `)
      .all(folderId) as any[]
  );
}

export function getAllMemos(): MemoItem[] {
  return mapMemoRows(
    getMemoDB()
      .prepare(`
        SELECT id, folder_id, date, text, created_at, updated_at, color, image, note
        FROM memos
        ORDER BY date DESC, created_at ASC
      `)
      .all() as any[]
  );
}

export function getUncategorizedMemos(): MemoItem[] {
  return mapMemoRows(
    getMemoDB()
      .prepare(`
        SELECT id, folder_id, date, text, created_at, updated_at, color, image, note
        FROM memos
        WHERE folder_id IS NULL OR folder_id = ''
        ORDER BY date DESC, created_at ASC
      `)
      .all() as any[]
  );
}

export function getUncategorizedFolder(): MemoFolder | null {
  const row = getMemoDB()
    .prepare(`
      SELECT
        COUNT(*) AS memo_count,
        MAX(COALESCE(updated_at, created_at)) AS latest_at,
        (
          SELECT text
          FROM memos
          WHERE folder_id IS NULL OR folder_id = ''
          ORDER BY COALESCE(updated_at, created_at) DESC
          LIMIT 1
        ) AS latest_text
      FROM memos
      WHERE folder_id IS NULL OR folder_id = ''
    `)
    .get() as { memo_count: number; latest_at: number | null; latest_text: string | null };

  if (!row.memo_count) return null;

  return {
    id: "__uncategorized__",
    name: "미분류 메모",
    createdAt: row.latest_at ?? Date.now(),
    image: null,
    memoCount: row.memo_count,
    latestAt: row.latest_at ?? Date.now(),
    latestText: row.latest_text ?? "",
  };
}

export function createMemoItem(id: string, folderId: string | null, date: string, text: string): void {
  const now = Date.now();
  getMemoDB()
    .prepare(`
      INSERT INTO memos (id, folder_id, date, text, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `)
    .run(id, folderId, date, text, now);
}

export function updateMemoItem(id: string, data: { text?: string; date?: string }): void {
  const db = getMemoDB();
  const now = Date.now();
  if (data.text !== undefined) {
    db.prepare("UPDATE memos SET text = ?, updated_at = ? WHERE id = ?").run(data.text, now, id);
  }
  if (data.date !== undefined) {
    db.prepare("UPDATE memos SET date = ?, updated_at = ? WHERE id = ?").run(data.date, now, id);
  }
}

export function deleteMemoItem(id: string): void {
  getMemoDB().prepare("DELETE FROM memos WHERE id = ?").run(id);
}
