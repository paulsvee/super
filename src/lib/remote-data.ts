import type { MemoFolder, MemoItem } from "@/lib/memo-db";
import type { SidebarCategory, TodoItem, TodoPanel } from "@/lib/todo-db";
import foldersSnapshot from "@/seed/one-folders.json";
import memosSnapshot from "@/seed/one-memos.json";

const TODO_API_URL = process.env.TODO_API_URL ?? "https://todo.paulsvee.com/api/todos";
const ONE_FOLDERS_API_URL = process.env.ONE_FOLDERS_API_URL ?? "https://one.paulsvee.com/api/folders";
const ONE_MEMOS_API_URL = process.env.ONE_MEMOS_API_URL ?? "https://one.paulsvee.com/api/memos";
const UNCATEGORIZED_ID = "__uncategorized__";

type RemoteTodoItem = {
  id: string;
  text: string;
  done?: boolean;
  createdAt?: number;
  updatedAt?: number | null;
};

type RemoteTodoPanel = {
  id: string;
  title: string;
  color?: string;
  createdAt?: number;
  categoryIds?: string[];
  categoryAssignedAt?: number | null;
  isSpecial?: boolean;
  bgImage?: string | null;
  items?: RemoteTodoItem[];
};

type RemoteTodoCategory = {
  id: string;
  name: string;
  createdAt?: number;
};

type RemoteTodoPayload = {
  state?: {
    panels?: RemoteTodoPanel[];
  };
  categories_main?: RemoteTodoCategory[];
};

type RemoteFolder = {
  id: string;
  name: string;
  created_at?: number;
  image?: string | null;
  memo_count?: number;
};

type RemoteMemo = {
  id: string;
  folder_id?: string | null;
  date?: string;
  text: string;
  created_at?: number;
  updated_at?: number | null;
  color?: string | null;
  image?: string | null;
  note?: string | null;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${url} returned ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function fetchTodoPayload(): Promise<RemoteTodoPayload> {
  return fetchJson<RemoteTodoPayload>(TODO_API_URL);
}

async function fetchFolders(): Promise<RemoteFolder[]> {
  try {
    const payload = await fetchJson<{ folders?: RemoteFolder[] }>(ONE_FOLDERS_API_URL);
    return Array.isArray(payload.folders) ? payload.folders : [];
  } catch {
    const payload = foldersSnapshot as { folders?: RemoteFolder[] };
    return Array.isArray(payload.folders) ? payload.folders : [];
  }
}

async function fetchMemos(): Promise<RemoteMemo[]> {
  try {
    const payload = await fetchJson<{ memos?: RemoteMemo[] }>(ONE_MEMOS_API_URL);
    return Array.isArray(payload.memos) ? payload.memos : [];
  } catch {
    const payload = memosSnapshot as { memos?: RemoteMemo[] };
    return Array.isArray(payload.memos) ? payload.memos : [];
  }
}

function toTime(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

function todoPanelsFromPayload(payload: RemoteTodoPayload): RemoteTodoPanel[] {
  return Array.isArray(payload.state?.panels) ? payload.state.panels : [];
}

export async function getRemotePanels(categoryId?: string | null): Promise<(TodoPanel & { itemCount: number })[]> {
  const payload = await fetchTodoPayload();
  const panels = todoPanelsFromPayload(payload);
  const filtered = categoryId
    ? panels.filter((panel) => (panel.categoryIds ?? []).includes(categoryId))
    : panels;

  return filtered.map((panel, index) => ({
    id: String(panel.id),
    mode: "main",
    title: String(panel.title),
    color: panel.color ?? "#7c98ff",
    createdAt: toTime(panel.createdAt),
    categoryIds: Array.isArray(panel.categoryIds) ? panel.categoryIds.map(String) : [],
    categoryAssignedAt: panel.categoryAssignedAt ?? null,
    isSpecial: panel.isSpecial === true,
    bgImage: panel.bgImage ?? null,
    sortOrder: index,
    itemCount: Array.isArray(panel.items) ? panel.items.length : 0,
  }));
}

export async function getRemoteTodoItems(panelId: string): Promise<TodoItem[]> {
  const payload = await fetchTodoPayload();
  const panel = todoPanelsFromPayload(payload).find((item) => item.id === panelId);
  return (panel?.items ?? []).map((item, index) => ({
    id: String(item.id),
    panelId,
    text: String(item.text),
    done: item.done === true,
    createdAt: toTime(item.createdAt),
    updatedAt: item.updatedAt ?? null,
    sortOrder: index,
  }));
}

export async function getRemoteSidebarCategories(): Promise<SidebarCategory[]> {
  const payload = await fetchTodoPayload();
  const panels = todoPanelsFromPayload(payload);
  const categories = Array.isArray(payload.categories_main) ? payload.categories_main : [];

  return categories
    .map((category) => {
      const relatedPanels = panels.filter((panel) => (panel.categoryIds ?? []).includes(category.id));
      const relatedItems = relatedPanels.flatMap((panel) =>
        (panel.items ?? []).map((item) => ({
          text: item.text,
          at: toTime(item.updatedAt ?? item.createdAt ?? panel.createdAt),
        }))
      );
      const latestItem = relatedItems.sort((a, b) => b.at - a.at)[0];
      const latestPanelAt = relatedPanels.reduce(
        (max, panel) => Math.max(max, toTime(panel.createdAt), toTime(panel.categoryAssignedAt)),
        toTime(category.createdAt)
      );

      return {
        id: String(category.id),
        mode: "main",
        name: String(category.name),
        createdAt: toTime(category.createdAt),
        latestAt: Math.max(latestPanelAt, latestItem?.at ?? 0),
        preview: latestItem?.text ?? relatedPanels[0]?.title ?? "",
      };
    })
    .sort((a, b) =>
      (b.latestAt - a.latestAt) ||
      (b.createdAt - a.createdAt) ||
      a.name.localeCompare(b.name, "ko") ||
      a.id.localeCompare(b.id)
    );
}

export async function getRemoteMemoFolders(): Promise<MemoFolder[]> {
  const [folders, memos] = await Promise.all([fetchFolders(), fetchMemos()]);
  const foldersResult = folders.map((folder) => {
    const folderMemos = memos.filter((memo) => memo.folder_id === folder.id);
    const latest = [...folderMemos].sort(
      (a, b) => toTime(b.updated_at ?? b.created_at) - toTime(a.updated_at ?? a.created_at)
    )[0];

    return {
      id: String(folder.id),
      name: String(folder.name),
      createdAt: toTime(folder.created_at),
      memoCount: folder.memo_count ?? folderMemos.length,
      latestText: latest?.text ?? "",
      latestAt: latest ? toTime(latest.updated_at ?? latest.created_at) : toTime(folder.created_at),
      image: folder.image ?? null,
    };
  });

  const uncategorized = memos.filter((memo) => !memo.folder_id);
  if (uncategorized.length > 0) {
    const latest = [...uncategorized].sort(
      (a, b) => toTime(b.updated_at ?? b.created_at) - toTime(a.updated_at ?? a.created_at)
    )[0];
    foldersResult.push({
      id: UNCATEGORIZED_ID,
      name: "미분류 메모",
      createdAt: toTime(latest?.created_at),
      memoCount: uncategorized.length,
      latestText: latest?.text ?? "",
      latestAt: toTime(latest?.updated_at ?? latest?.created_at),
      image: null,
    });
  }

  return foldersResult.sort((a, b) =>
    ((b.latestAt ?? b.createdAt) - (a.latestAt ?? a.createdAt)) ||
    (b.createdAt - a.createdAt) ||
    a.name.localeCompare(b.name, "ko") ||
    a.id.localeCompare(b.id)
  );
}

export async function getRemoteMemos(folderId?: string | null): Promise<MemoItem[]> {
  const memos = await fetchMemos();
  const filtered = !folderId
    ? memos
    : folderId === UNCATEGORIZED_ID
      ? memos.filter((memo) => !memo.folder_id)
      : memos.filter((memo) => memo.folder_id === folderId);

  return filtered
    .map((memo) => ({
      id: String(memo.id),
      folderId: memo.folder_id ? String(memo.folder_id) : null,
      date: memo.date ?? new Date(toTime(memo.created_at)).toISOString().slice(0, 10),
      text: String(memo.text),
      createdAt: toTime(memo.created_at),
      updatedAt: memo.updated_at ?? null,
      color: memo.color ?? null,
      image: memo.image ?? null,
      note: memo.note ?? null,
    }))
    .sort((a, b) =>
      b.date.localeCompare(a.date) ||
      (a.createdAt - b.createdAt)
    );
}
