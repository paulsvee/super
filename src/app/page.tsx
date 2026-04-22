"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";

// ─── 타입 ─────────────────────────────────────────────────────────────────────

type Panel = {
  id: string;
  mode: "main" | "dream";
  title: string;
  color: string;
  itemCount: number;
  categoryIds: string[];
  createdAt: number;
};

type TodoItem = {
  id: string;
  panelId: string;
  text: string;
  done: boolean;
  createdAt: number;
  updatedAt?: number | null;
};

type Category = {
  id: string;
  mode: string;
  name: string;
  createdAt: number;
  latestAt?: number;
  preview?: string;
};

type MemoFolder = {
  id: string;
  name: string;
  createdAt: number;
  memoCount: number;
  latestText?: string;
  latestAt?: number;
  image?: string | null;
};

type Memo = {
  id: string;
  folderId: string | null;
  text: string;
  date: string;
  createdAt: number;
  updatedAt?: number | null;
  color?: string | null;
  image?: string | null;
  note?: string | null;
};

type PersonalityTrait = {
  label: string;
  emoji: string;
  desc: string;
  score: number;
};

type PersonalityData = {
  traits: PersonalityTrait[];
  personalityTag: string;
  totalQ: number;
  mbti: string;
  summary: string;
};

const UNCATEGORIZED_ID = "__uncategorized__";

// ─── 아바타 컬러 ──────────────────────────────────────────────────────────────

const AVATAR_COLORS = ["#4a90d9","#5c6bc0","#26a69a","#66bb6a","#ef5350","#ab47bc","#ff7043","#42a5f5"];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

const fmtDate = (d: string) => {
  const parts = d.split("-");
  return `${parts[1]}.${parts[2]}`;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// 아이템 텍스트에서 ": 숫자" 패턴 합산 (미완료 항목만)
const extractSum = (items: TodoItem[]): number | null => {
  let total = 0, found = false;
  for (const item of items) {
    const m = item.text.match(/:\s*([\d,]+)\s*$/);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (!isNaN(n)) { total += item.done ? 0 : n; found = true; }
    }
  }
  return found ? total : null;
};

const fmtNumber = (n: number) => n.toLocaleString("ko-KR");

function getPanelLatestAt(panel: Panel, items: TodoItem[]): number {
  return items.reduce((latest, item) => Math.max(latest, item.updatedAt ?? item.createdAt), panel.createdAt);
}

function getMemoActivityAt(memo: Memo): number {
  return memo.updatedAt ?? memo.createdAt;
}

function fmtActivityLabel(ts: number): string {
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}.${day}`;
}

function memoPillStyles(memo: Memo, hovered = false): React.CSSProperties {
  const hasImage = !!memo.image;
  const hasColor = !!memo.color;

  if (hasImage) {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      borderRadius: 12,
      border: `1px solid ${hovered ? "var(--border2)" : "var(--border2)"}`,
      padding: "0",
      color: "var(--pill-text)",
      flexShrink: 0,
      whiteSpace: "nowrap",
      lineHeight: 1.45,
      userSelect: "none",
      cursor: "default",
      minWidth: 120,
      minHeight: 52,
      overflow: "hidden",
      backgroundImage: `url(${memo.image})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    background: hasColor ? `linear-gradient(var(--pill-overlay), var(--pill-overlay)), ${memo.color}` : "var(--pill-bg)",
    border: `1px solid ${hovered ? "var(--border2)" : (hasColor ? `${memo.color}99` : "var(--border2)")}`,
    padding: "4px 11px",
    fontSize: 13,
    color: hasColor ? "var(--pill-text)" : "var(--text)",
    flexShrink: 0,
    whiteSpace: "nowrap",
    lineHeight: 1.45,
    transition: "border-color 0.12s",
  };
}

function memoNoteDotStyle(memo: Memo): React.CSSProperties {
  return {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: memo.image ? "#fff" : (memo.color ?? "var(--point)"),
    flexShrink: 0,
    display: "inline-block",
    opacity: memo.image ? 0.85 : 1,
  };
}

function memoDateStyle(memo: Memo): React.CSSProperties {
  return {
    fontSize: 12,
    color: memo.color || memo.image ? "inherit" : "var(--point)",
    flexShrink: 0,
    opacity: memo.color || memo.image ? 0.9 : 1,
  };
}

// ─── 투두 카드 (마소니리) ──────────────────────────────────────────────────────

function TodoCard({
  panel, items, onToggle, onDeleteItem, onClick, isSelected,
}: {
  panel: Panel;
  items: TodoItem[];
  onToggle: (itemId: string, done: boolean) => void;
  onDeleteItem: (itemId: string) => void;
  onClick: () => void;
  isSelected?: boolean;
}) {
  const doneCount = items.filter((i) => i.done).length;
  const sum = extractSum(items);
  const latestAt = getPanelLatestAt(panel, items);

  return (
    <div className={`todo-card${isSelected ? " selected" : ""}`} onClick={onClick} style={{ cursor: "pointer" }}>
      {/* 헤더 */}
      <div className="todo-card-header">
        <div className="todo-card-dot" style={{ background: panel.color }} />
        <div className="todo-card-title">{panel.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <div className="card-activity-chip">{fmtActivityLabel(latestAt)}</div>
          {sum !== null && (
            <div className="todo-card-sum" style={{ color: sum < 0 ? "#ef5350" : "var(--point)" }}>
              {sum < 0 ? "-" : "+"}{fmtNumber(Math.abs(sum))}
            </div>
          )}
          <div className="todo-card-badge">{doneCount}/{items.length}</div>
        </div>
      </div>

      {/* 아이템 목록 */}
      <div className="todo-card-body">
        {items.map((item) => (
          <div key={item.id} className="todo-item-row">
            <button
              className={`todo-check${item.done ? " done" : ""}`}
              onClick={(e) => { e.stopPropagation(); onToggle(item.id, !item.done); }}
            />
            <span className={`todo-item-text${item.done ? " done" : ""}`}>{item.text}</span>
            <button
              className="todo-item-del"
              onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
            >×</button>
          </div>
        ))}
        {items.length === 0 && (
          <div style={{ padding: "8px 0", fontSize: 12, color: "var(--text3)" }}>항목 없음</div>
        )}
      </div>
    </div>
  );
}

// ─── 투두 상세 뷰 ─────────────────────────────────────────────────────────────

function TodoDetail({
  panel, items, onBack, onToggle, onDeleteItem,
}: {
  panel: Panel;
  items: TodoItem[];
  onBack: () => void;
  onToggle: (itemId: string, done: boolean) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  return (
    <div className="super-detail">
      <div className="super-detail-header">
        <button className="super-detail-back" onClick={onBack}>‹</button>
        <div className="super-detail-dot" style={{ background: panel.color }} />
        <div className="super-detail-title">{panel.title}</div>
        <div className="super-detail-badge">
          {items.filter((i) => i.done).length}/{items.length}
        </div>
      </div>

      {items.map((item) => (
        <div key={item.id} className="detail-todo-item">
          <button
            className={`todo-check${item.done ? " done" : ""}`}
            onClick={() => onToggle(item.id, !item.done)}
          />
          <span className={`todo-item-text${item.done ? " done" : ""}`} style={{ flex: 1 }}>
            {item.text}
          </span>
          <button
            onClick={() => onDeleteItem(item.id)}
            style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}
          >×</button>
        </div>
      ))}

      {items.length === 0 && <div className="super-empty">아직 할 일이 없어요</div>}
    </div>
  );
}

// ─── 삭제 확인 모달 ───────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel }: { message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.65)", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--surface1)", border: "1px solid var(--border)", borderRadius: 16, padding: "22px 22px 18px", minWidth: 280, boxShadow: "0 20px 60px rgba(0,0,0,0.65)" }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text1)", marginBottom: 8 }}>삭제 확인</div>
        <div style={{ fontSize: 13, color: "var(--text2)", marginBottom: 20 }}>{message}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid var(--border)", background: "none", color: "var(--text2)", cursor: "pointer", fontSize: 12 }}
          >취소</button>
          <button
            onClick={onConfirm}
            style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "#e45b70", color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}
          >삭제</button>
        </div>
      </div>
    </div>
  );
}

// ─── 메모 폴더 카드 (All 뷰 마소니리용) ──────────────────────────────────────

function MemoFolderCard({ folder, memos, onClick }: { folder: MemoFolder; memos: Memo[]; onClick: () => void }) {
  const recent = memos.slice().sort((a, b) => getMemoActivityAt(b) - getMemoActivityAt(a)).slice(0, 10);
  const latestAt = recent[0] ? getMemoActivityAt(recent[0]) : (folder.latestAt ?? folder.createdAt);
  const grouped = recent.reduce<Record<string, Memo[]>>((acc, memo) => {
    if (!acc[memo.date]) acc[memo.date] = [];
    acc[memo.date].push(memo);
    return acc;
  }, {});
  const days = Object.keys(grouped).sort().reverse();
  const folderDotColor = avatarColor(folder.id);
  return (
    <div className="memo-card" onClick={onClick} style={{ cursor: "pointer" }}>
      <div className="memo-card-header">
        <div className="todo-card-dot" style={{ background: folderDotColor }} />
        <div className="memo-card-title">{folder.name}</div>
        <div className="card-activity-chip">{fmtActivityLabel(latestAt)}</div>
        <div className="memo-card-badge">{folder.memoCount}</div>
      </div>
      {recent.length > 0 && (
        <div style={{ padding: "10px 0 12px", display: "flex", flexDirection: "column", gap: 10 }}>
          {days.map((date, index) => (
            <div key={date} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {index > 0 && <div style={{ height: 1, background: "var(--divider)" }} />}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "0 0 0" }}>
                <div
                  style={{
                    minWidth: 34,
                    paddingTop: 5,
                    textAlign: "right",
                    fontFamily: "'JetBrains Mono',monospace",
                    fontSize: 11,
                    color: "var(--text3)",
                    flexShrink: 0,
                  }}
                >
                  {date.slice(8, 10)}
                </div>
                <div
                  className="memo-card-pill-row"
                  style={{
                    display: "flex",
                    flexWrap: "nowrap",
                    gap: 7,
                    minWidth: 0,
                    flex: 1,
                    overflowX: "auto",
                    overflowY: "hidden",
                    paddingBottom: 2,
                    scrollbarWidth: "none",
                  }}
                >
                  {grouped[date]
                    .sort((a, b) => a.createdAt - b.createdAt)
                    .map((memo) => (
                      <div key={memo.id} className="memo-pill" style={memoPillStyles(memo)}>
                        {memo.image ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "0 10px",
                              minWidth: 120,
                              minHeight: 52,
                              background: "rgba(0,0,0,0.45)",
                            }}
                          >
                            {!!memo.note && <span style={memoNoteDotStyle(memo)} />}
                            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.92)", whiteSpace: "nowrap" }}>{memo.text}</span>
                          </div>
                        ) : (
                          <>
                            {!!memo.note && <span style={memoNoteDotStyle(memo)} />}
                            <span style={{ fontSize: 13, color: memo.color ? "inherit" : "var(--text)", whiteSpace: "nowrap" }}>{memo.text}</span>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonalityCard({ data }: { data: PersonalityData | null }) {
  const traits = data?.traits ?? [];
  const maxScore = traits[0]?.score ?? 1;
  const barColors = ["#7c6cf3", "#68c39f", "#f1b240", "#eb625a"];

  return (
    <div className="todo-card">
      <div className="todo-card-header">
        <div className="todo-card-dot" style={{ background: "#7c6cf3" }} />
        <div className="todo-card-title">나의 기록 성향</div>
      </div>
      {traits.length > 0 ? (
        <div className="personality-card-body">
          <div className="personality-card-head">
            <div className="personality-card-tag">{data?.personalityTag}</div>
            {data?.mbti ? <span className="card-activity-chip">{data.mbti}</span> : null}
          </div>
          {data?.summary ? <p className="personality-card-summary">{data.summary}</p> : null}
          <div className="personality-card-meta">총 {(data?.totalQ ?? 0).toLocaleString("ko-KR")}개 메모/할 일 분석 기반</div>
          <div className="personality-traits">
            {traits.slice(0, 4).map((trait, index) => {
              const pct = Math.max(8, Math.round((trait.score / maxScore) * 100));
              const color = barColors[index] ?? barColors[barColors.length - 1];
              return (
                <div key={trait.label} className="personality-trait">
                  <div className="personality-trait-row">
                    <div className="personality-trait-labels">
                      <span className="personality-trait-emoji">{trait.emoji}</span>
                      <span className="personality-trait-name">{trait.label}</span>
                      <span className="personality-trait-desc">{trait.desc}</span>
                    </div>
                    <span className="personality-trait-value" style={{ color }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="personality-trait-track">
                    <div className="personality-trait-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="personality-card-body">
          <div className="personality-card-empty">분석 데이터가 아직 없습니다.</div>
        </div>
      )}
    </div>
  );
}

// ─── 메모 필 (hover → 삭제 버튼) ────────────────────────────────────────────

function MemoViewPill({ memo, onDelete }: { memo: Memo; onDelete: (id: string) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={memoPillStyles(memo, hovered)}
    >
      {memo.image ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "0 10px",
            minWidth: 120,
            minHeight: 52,
            background: "rgba(0,0,0,0.45)",
          }}
        >
          {!!memo.note && <span style={memoNoteDotStyle(memo)} />}
          <span style={{ color: "rgba(255,255,255,0.92)" }}>{memo.text}</span>
          {hovered && (
            <button
              onClick={() => onDelete(memo.id)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.55)",
                cursor: "pointer",
                fontSize: 13,
                padding: "0 0 0 2px",
                lineHeight: 1,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
              }}
            >×</button>
          )}
        </div>
      ) : (
        <>
          {!!memo.note && <span style={memoNoteDotStyle(memo)} />}
          <span>{memo.text}</span>
          {hovered && (
            <button
              onClick={() => onDelete(memo.id)}
              style={{
                background: "none", border: "none",
                color: memo.color ? "rgba(255,255,255,0.35)" : "var(--text3)", cursor: "pointer",
                fontSize: 13, padding: "0 0 0 2px",
                lineHeight: 1, flexShrink: 0,
                display: "flex", alignItems: "center",
              }}
            >×</button>
          )}
        </>
      )}
    </div>
  );
}

// ─── 메모 폴더 뷰 (one-psv 월/일 그룹 레이아웃) ──────────────────────────────

function MemoView({
  folder, memos, onDeleteMemo,
}: {
  folder: MemoFolder;
  memos: Memo[];
  onDeleteMemo: (memoId: string) => void;
}) {
  const today = todayStr();

  // 월별 → 일별 그룹핑
  const byMonth: Record<string, Record<string, Memo[]>> = {};
  for (const m of memos) {
    const date = m.date ?? today;
    const mk = date.slice(0, 7);  // "YYYY-MM"
    if (!byMonth[mk]) byMonth[mk] = {};
    if (!byMonth[mk][date]) byMonth[mk][date] = [];
    byMonth[mk][date].push(m);
  }

  const months = Object.keys(byMonth).sort().reverse();

  const fmtMonth = (ym: string) => {
    const [y, mo] = ym.split("-");
    return `${y}년 ${parseInt(mo, 10)}월`;
  };
  const dayNum = (d: string) => parseInt(d.slice(8, 10), 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28, paddingBottom: 40 }}>
      {months.length === 0 && (
        <div className="super-empty">아직 메모가 없어요</div>
      )}

      {months.map((mk) => {
        const byDay = byMonth[mk];
        const days = Object.keys(byDay).sort().reverse();
        const total = days.reduce((s, d) => s + byDay[d].length, 0);

        return (
          <div key={mk} style={{ display: "flex", flexDirection: "column", gap: 0 }}>

            {/* 월 헤더 */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                color: "var(--text3)", letterSpacing: "0.07em",
              }}>
                {fmtMonth(mk)}
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: "var(--text3)" }}>
                {total}
              </span>
            </div>

            {/* 날짜별 행 */}
            {days.map((d, di) => {
              const isToday = d === today;
              const sorted = [...byDay[d]].sort((a, b) => a.createdAt - b.createdAt);
              return (
                <React.Fragment key={d}>
                  {di > 0 && (
                    <div style={{ height: 0, borderTop: "1px dashed var(--divider)", margin: "14px 0" }} />
                  )}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    {/* 날짜 숫자 */}
                    <div style={{
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
                      color: isToday ? "var(--point)" : "var(--text3)",
                      fontWeight: isToday ? 500 : 400,
                      minWidth: 28, paddingTop: 5, flexShrink: 0, textAlign: "right",
                    }}>
                      {String(dayNum(d)).padStart(2, "0")}
                    </div>

                    {/* 필 행 — 가로 스크롤 nowrap */}
                    <div style={{
                      flex: 1, display: "flex", flexWrap: "nowrap",
                      alignItems: "flex-start", gap: 7,
                      overflowX: "auto", paddingBottom: 2,
                      scrollbarWidth: "none",
                    } as React.CSSProperties}>
                      {sorted.map((memo) => (
                        <MemoViewPill key={memo.id} memo={memo} onDelete={onDeleteMemo} />
                      ))}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}

          </div>
        );
      })}
    </div>
  );
}

// ─── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function SuperPage() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem("super_sidebar_collapsed") === "1"; } catch { return false; }
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try { return Number(localStorage.getItem("super_sidebar_w")) || 260; } catch { return 260; }
  });
  const sidebarResizing = useRef(false);

  // 사이드바 데이터
  const [categories, setCategories] = useState<Category[]>([]);
  const [memoFolders, setMemoFolders] = useState<MemoFolder[]>([]);

  // 패널 + 아이템 캐시
  const [panels, setPanels] = useState<Panel[]>([]);
  const [allPanels, setAllPanels] = useState<Panel[]>([]);
  const [itemsCache, setItemsCache] = useState<Record<string, TodoItem[]>>({});
  const fetchedPanels = useRef<Set<string>>(new Set());

  // 메모
  const [memos, setMemos] = useState<Memo[]>([]);
  const [allMemoCache, setAllMemoCache] = useState<Record<string, Memo[]>>({});
  const [personality, setPersonality] = useState<PersonalityData | null>(null);

  // 상단 입력바
  const [topInputVal, setTopInputVal] = useState("");
  const [topInputDate, setTopInputDate] = useState(todayStr());
  const [allQuickMode, setAllQuickMode] = useState<"memo" | "todo">("memo");
  const [allQuickTargetId, setAllQuickTargetId] = useState<string>("");
  const topInputRef = useRef<HTMLInputElement>(null);

  // 선택 상태: "all" | "cat_<id>" | "folder_<id>" | <panelId>
  const [selectedId, setSelectedId] = useState<string>("all");
  const [hydrated, setHydrated] = useState(false);

  // ─── 데이터 로드 ───────────────────────────────────────────────────────────

  const loadSidebar = useCallback(async () => {
    try {
      const res = await fetch("/api/sidebar");
      if (res.ok) {
        const data = await res.json();
        setCategories(
          [...(data.categories ?? [])].sort((a: Category, b: Category) =>
            ((b.latestAt ?? b.createdAt) - (a.latestAt ?? a.createdAt)) ||
            (b.createdAt - a.createdAt) ||
            a.name.localeCompare(b.name, "ko") ||
            a.id.localeCompare(b.id)
          )
        );
        setMemoFolders(
          [...(data.memoFolders ?? [])].sort((a: MemoFolder, b: MemoFolder) =>
            ((b.latestAt ?? b.createdAt) - (a.latestAt ?? a.createdAt)) ||
            (b.createdAt - a.createdAt) ||
            a.name.localeCompare(b.name, "ko") ||
            a.id.localeCompare(b.id)
          )
        );
      }
    } catch {}
  }, []);

  const loadPanels = useCallback(async (categoryId?: string) => {
    try {
      const url = categoryId ? `/api/panels?categoryId=${categoryId}` : "/api/panels";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPanels(data.panels ?? []);
      }
    } catch {}
  }, []);

  const loadAllPanels = useCallback(async () => {
    try {
      const res = await fetch("/api/panels");
      if (res.ok) {
        const data = await res.json();
        setAllPanels(data.panels ?? []);
      }
    } catch {}
  }, []);

  const loadPanelItems = useCallback(async (panelId: string) => {
    if (fetchedPanels.current.has(panelId)) return;
    fetchedPanels.current.add(panelId);
    try {
      const res = await fetch(`/api/panels/${panelId}/items`);
      if (res.ok) {
        const data = await res.json();
        setItemsCache((prev) => ({ ...prev, [panelId]: data.items ?? [] }));
      } else {
        fetchedPanels.current.delete(panelId);
      }
    } catch {
      fetchedPanels.current.delete(panelId);
    }
  }, []);

  const loadMemos = useCallback(async (folderId: string) => {
    try {
      const res = await fetch(`/api/memos?folderId=${folderId}`);
      if (res.ok) {
        const data = await res.json();
        setMemos(data.memos ?? []);
      }
    } catch {}
  }, []);

  const loadAllFolderMemos = useCallback(async (folders: MemoFolder[]) => {
    await Promise.all(folders.map(async (f) => {
      try {
        const res = await fetch(`/api/memos?folderId=${f.id}`);
        if (res.ok) {
          const data = await res.json();
          setAllMemoCache((prev) => ({ ...prev, [f.id]: data.memos ?? [] }));
        }
      } catch {}
    }));
  }, []);

  const loadPersonality = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-personality");
      if (res.ok) {
        const data = await res.json();
        setPersonality(data.personalityData ?? null);
      }
    } catch {}
  }, []);

  // 초기 마운트
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("super_theme") : null;
    if (saved === "light") setTheme("light");

    loadSidebar();
    loadPersonality();
    loadAllPanels();
    loadPanels().then(() => setHydrated(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 테마 적용
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("super_theme", theme);
    }
  }, [theme]);

  // 선택 변경 → 데이터 로드
  useEffect(() => {
    if (!hydrated) return;
    if (selectedId === "all") {
      loadPanels();
      if (memoFolders.length > 0) loadAllFolderMemos(memoFolders);
    } else if (selectedId.startsWith("cat_")) {
      loadPanels(selectedId.slice(4));
    } else if (selectedId.startsWith("folder_")) {
      loadMemos(selectedId.slice(7));
    } else {
      // 패널 상세 — 아이템 로드
      loadPanelItems(selectedId);
    }
  }, [selectedId, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  // 마소니리 패널 아이템 사전 로드
  useEffect(() => {
    if (!hydrated || panels.length === 0) return;
    panels.forEach((p) => loadPanelItems(p.id));
  }, [hydrated, panels, loadPanelItems]);

  // All 뷰일 때 memoFolders 로드되면 메모도 로드
  useEffect(() => {
    if (!hydrated || selectedId !== "all" || memoFolders.length === 0) return;
    loadAllFolderMemos(memoFolders);
  }, [hydrated, memoFolders]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── 아이템 조작 ───────────────────────────────────────────────────────────

  const handleToggle = useCallback(async (itemId: string, done: boolean) => {
    const now = Date.now();
    // 낙관적 업데이트
    setItemsCache((prev) => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) {
        next[pid] = next[pid].map((i) => i.id === itemId ? { ...i, done, updatedAt: now } : i);
      }
      return next;
    });
    await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    }).catch(() => {});
    loadSidebar();
  }, [loadSidebar]);

  const handleAddTodoItem = useCallback(async (panelId: string, text: string) => {
    const tempId = `tmp_${Date.now()}`;
    const now = Date.now();
    const newItem: TodoItem = { id: tempId, panelId, text, done: false, createdAt: now, updatedAt: now };

    setItemsCache((prev) => ({ ...prev, [panelId]: [...(prev[panelId] ?? []), newItem] }));
    setPanels((prev) => prev.map((p) => p.id === panelId ? { ...p, itemCount: p.itemCount + 1 } : p));

    try {
      const res = await fetch(`/api/panels/${panelId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const data = await res.json();
        setItemsCache((prev) => ({
          ...prev,
          [panelId]: (prev[panelId] ?? []).map((i) => i.id === tempId ? { ...i, id: data.id } : i),
        }));
        loadAllPanels();
        loadSidebar();
      }
    } catch {}
  }, [loadAllPanels, loadSidebar]);

  const handleDeleteTodoItem = useCallback(async (itemId: string) => {
    setItemsCache((prev) => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) {
        next[pid] = next[pid].filter((i) => i.id !== itemId);
      }
      return next;
    });
    await fetch(`/api/items/${itemId}`, { method: "DELETE" }).catch(() => {});
    loadAllPanels();
    loadSidebar();
  }, [loadAllPanels, loadSidebar]);

  const handleAddMemo = useCallback(async (folderId: string, text: string, date: string) => {
    const tempId = `tmp_${Date.now()}`;
    const now = Date.now();
    const normalizedFolderId = folderId === UNCATEGORIZED_ID ? null : folderId;
    const cacheKey = folderId || UNCATEGORIZED_ID;
    const newMemo: Memo = { id: tempId, folderId: normalizedFolderId, text, date, createdAt: now, updatedAt: now };
    setMemos((prev) => [...prev, newMemo]);
    setAllMemoCache((prev) => ({ ...prev, [cacheKey]: [newMemo, ...(prev[cacheKey] ?? [])] }));

    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, text, date }),
      });
      if (res.ok) {
        const data = await res.json();
        setMemos((prev) => prev.map((m) => m.id === tempId ? { ...m, id: data.id } : m));
        setAllMemoCache((prev) => ({
          ...prev,
          [cacheKey]: (prev[cacheKey] ?? []).map((memo) => memo.id === tempId ? { ...memo, id: data.id } : memo),
        }));
        loadAllPanels();
        loadSidebar();
      }
    } catch {}
  }, [loadAllPanels, loadSidebar]);

  const handleDeleteMemo = useCallback(async (memoId: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== memoId));
    setAllMemoCache((prev) => {
      const next: Record<string, Memo[]> = {};
      for (const key of Object.keys(prev)) next[key] = prev[key].filter((memo) => memo.id !== memoId);
      return next;
    });
    await fetch(`/api/memos/${memoId}`, { method: "DELETE" }).catch(() => {});
    loadAllPanels();
    loadSidebar();
  }, [loadAllPanels, loadSidebar]);

  const handleDeleteMemoFolder = useCallback(async (folderId: string) => {
    setMemoFolders((prev) => prev.filter((f) => f.id !== folderId));
    // 현재 선택된 폴더가 삭제되면 All로 이동
    setSelectedId((prev) => prev === `folder_${folderId}` ? "all" : prev);
    await fetch(`/api/memo-folders/${folderId}`, { method: "DELETE" }).catch(() => {});
    loadSidebar();
  }, [loadSidebar]);

  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<string | null>(null);

  const requestDeleteTodoItem = useCallback((itemId: string) => {
    setPendingDelete({ kind: "todo", id: itemId });
  }, []);

  const requestDeleteMemo = useCallback((memoId: string) => {
    setPendingDelete({ kind: "memo", id: memoId });
  }, []);

  // ─── 뷰 판별 ───────────────────────────────────────────────────────────────

  // 사이드바 선택: "all" | "cat_<id>" | "folder_<id>"
  const isFolderView = selectedId.startsWith("folder_");

  // 삭제 확인 모달
  const [pendingDelete, setPendingDelete] = useState<{ kind: "todo" | "memo"; id: string } | null>(null);

  // 오른쪽 패널에서 선택된 항목: panelId 또는 null
  const [detailId, setDetailId] = useState<string | null>(null);

  const selectedFolder = isFolderView
    ? (memoFolders.find((f) => f.id === selectedId.slice(7)) ?? null)
    : null;
  const selectedPanel = detailId ? (panels.find((p) => p.id === detailId) ?? null) : null;
  const allTotalCount =
    allPanels.reduce((sum, panel) => sum + panel.itemCount, 0) +
    memoFolders.reduce((sum, folder) => sum + folder.memoCount, 0);
  const allMemoTargets = memoFolders
    .slice()
    .sort((a, b) =>
      ((b.latestAt ?? b.createdAt) - (a.latestAt ?? a.createdAt)) ||
      (b.createdAt - a.createdAt)
    );
  const allTodoTargets = panels
    .slice()
    .sort((a, b) =>
      (getPanelLatestAt(b, itemsCache[b.id] ?? []) - getPanelLatestAt(a, itemsCache[a.id] ?? [])) ||
      (b.createdAt - a.createdAt)
    );
  const allDashboardCards = selectedId === "all"
    ? [
        ...panels.map((panel) => ({
          kind: "todo" as const,
          id: panel.id,
          latestAt: getPanelLatestAt(panel, itemsCache[panel.id] ?? []),
          createdAt: panel.createdAt,
          panel,
        })),
        ...memoFolders.map((folder) => ({
          kind: "memo" as const,
          id: folder.id,
          latestAt: folder.latestAt ?? folder.createdAt,
          createdAt: folder.createdAt,
          folder,
        })),
      ].sort((a, b) =>
        (b.latestAt - a.latestAt) ||
        (b.createdAt - a.createdAt) ||
        (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind))
      )
    : [];

  useEffect(() => {
    if (selectedId !== "all") return;
    const nextDefault = allQuickMode === "memo"
      ? (allMemoTargets[0]?.id ?? "")
      : (allTodoTargets[0]?.id ?? "");
    if (!allQuickTargetId || ![...allMemoTargets, ...allTodoTargets].some((target) => target.id === allQuickTargetId)) {
      setAllQuickTargetId(nextDefault);
    }
  }, [selectedId, allQuickMode, allQuickTargetId, allMemoTargets, allTodoTargets]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setDetailId(null); // 사이드바 전환 시 오른쪽 패널 초기화
    setSidebarOpen(false);
  };

  // 상단 입력바 — 컨텍스트에 따라 메모/할일 추가
  const handleTopAdd = () => {
    if (!topInputVal.trim()) return;
    if (selectedId === "all") {
      if (allQuickMode === "memo") {
        const targetFolderId = allQuickTargetId || allMemoTargets[0]?.id || UNCATEGORIZED_ID;
        handleAddMemo(targetFolderId, topInputVal.trim(), topInputDate);
      } else {
        const targetPanelId = allQuickTargetId || allTodoTargets[0]?.id;
        if (targetPanelId) handleAddTodoItem(targetPanelId, topInputVal.trim());
      }
    } else if (isFolderView && selectedFolder) {
      handleAddMemo(selectedFolder.id, topInputVal.trim(), topInputDate);
    } else if (detailId) {
      handleAddTodoItem(detailId, topInputVal.trim());
    }
    setTopInputVal("");
  };

  const handlePanelClick = (panelId: string) => {
    setDetailId((prev) => (prev === panelId ? null : panelId)); // 같은 거 클릭 시 닫기
    loadPanelItems(panelId);
  };

  // ─── 렌더 ──────────────────────────────────────────────────────────────────

  const collapseStr = sidebarCollapsed ? " super-sidebar--collapsed" : "";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      {pendingDeleteFolder && (
        <ConfirmModal
          message="폴더를 삭제하면 메모는 All로 이동됩니다. 정말 삭제할까요?"
          onConfirm={() => { handleDeleteMemoFolder(pendingDeleteFolder); setPendingDeleteFolder(null); }}
          onCancel={() => setPendingDeleteFolder(null)}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          message="정말 삭제할까요?"
          onConfirm={() => {
            if (pendingDelete.kind === "todo") handleDeleteTodoItem(pendingDelete.id);
            else handleDeleteMemo(pendingDelete.id);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}

      {sidebarOpen && <div className="super-dim" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <aside className={`super-sidebar${sidebarOpen ? " open" : ""}${collapseStr}`}
        style={sidebarCollapsed
          ? { width: 0, minWidth: 0, padding: 0, borderRight: "none", overflow: "hidden" }
          : { width: sidebarWidth, minWidth: sidebarWidth }}>

        {/* 로고 영역 */}
        <div className="super-sidebar-logo">
          <div className="psv-brand" style={{ flex: 1, minWidth: 0 }}>
            <div className="super-title">SUPER</div>
            <div className="psv-subText">
              {selectedId.startsWith("folder_")
                ? (selectedFolder?.name ?? "메모")
                : selectedId.startsWith("cat_")
                  ? (categories.find((c) => c.id === selectedId.slice(4))?.name ?? "카테고리")
                  : "슈퍼 메모장"}
            </div>
          </div>
          {/* 테마 토글 */}
          <button className="psv-circle" onClick={() => setTheme((t) => t === "dark" ? "light" : "dark")}>
            {theme === "dark" ? "☀︎" : "☾"}
          </button>
          {/* 접기 */}
          <button className="psv-sidebar-iconbtn psv-sidebar-collapse-btn" title="사이드바 접기"
            onClick={() => {
              setSidebarCollapsed(true);
              try { localStorage.setItem("super_sidebar_collapsed", "1"); } catch {}
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* All 행 — + 버튼 인라인 */}
        <div className={`psv-sidebar-all-row${selectedId === "all" ? " is-active" : ""}`}>
          <button
            className="psv-sidebar-item psv-sidebar-item--all"
            style={{ alignItems: "center", gap: 9, flex: 1, paddingRight: 6 }}
            onClick={() => handleSelect("all")}
          >
            <span style={{
              width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
              background: "linear-gradient(135deg,#4a90d9,#5c6bc0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "#fff",
            }}>≡</span>
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>All</span>
              <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400 }}>
                {allTotalCount}개의 항목
              </span>
            </span>
          </button>
          {/* + 리스트 추가 버튼 */}
          <button className="psv-sidebar-iconbtn" style={{ marginRight: 6 }} title="리스트 추가">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

          {/* 카테고리 + 메모 폴더 통합, 최근 활동순 */}
          {(() => {
            type SidebarEntry = {
              kind: "cat" | "folder";
              id: string;
              name: string;
              sortKey: number;
              createdAt: number;
              preview?: string;
            };

            const catEntries: SidebarEntry[] = categories.map((c) => {
              return {
                kind: "cat",
                id: c.id,
                name: c.name,
                sortKey: c.latestAt ?? c.createdAt,
                createdAt: c.createdAt,
                preview: c.preview,
              };
            });

            const folderEntries: SidebarEntry[] = memoFolders
              .filter((f) => f.id !== UNCATEGORIZED_ID)
              .map((f) => ({
                kind: "folder",
                id: f.id,
                name: f.name,
                sortKey: f.latestAt ?? f.createdAt,
                createdAt: f.createdAt,
                preview: f.latestText || undefined,
              }));

            const entries = [...catEntries, ...folderEntries].sort((a, b) =>
              (b.sortKey - a.sortKey) ||
              (b.createdAt - a.createdAt) ||
              a.name.localeCompare(b.name, "ko") ||
              (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind))
            );

            if (entries.length === 0) return null;

            return (
              <>
                {entries.map((entry) => {
                  const isActive = selectedId === (entry.kind === "cat" ? `cat_${entry.id}` : `folder_${entry.id}`);
                  const color = avatarColor(entry.id);
                  return (
                    <div key={`${entry.kind}_${entry.id}`}
                      style={{ position: "relative", display: "flex", alignItems: "center" }}
                      onMouseEnter={(e) => { const b = e.currentTarget.querySelector<HTMLElement>(".sidebar-entry-del"); if (b) b.style.opacity = "1"; }}
                      onMouseLeave={(e) => { const b = e.currentTarget.querySelector<HTMLElement>(".sidebar-entry-del"); if (b) b.style.opacity = "0"; }}
                    >
                      <button
                        className={`psv-sidebar-item${isActive ? " is-active" : ""}`}
                        style={{ gap: 9, alignItems: "center" }}
                        onClick={() => handleSelect(entry.kind === "cat" ? `cat_${entry.id}` : `folder_${entry.id}`)}
                      >
                        {/* 아바타 */}
                        <span style={{
                          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                          background: color,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 15, fontWeight: 700, color: "#fff",
                          overflow: "hidden",
                        }}>
                          {entry.name[0]?.toUpperCase() ?? "?"}
                        </span>
                        {/* 이름 + 미리보기 */}
                        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                            {entry.name}
                          </span>
                          {entry.preview && (
                            <span style={{ fontSize: 11, color: "var(--text3)", fontWeight: 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {entry.preview}
                            </span>
                          )}
                        </span>
                      </button>
                      {/* 폴더만 삭제 버튼 표시 */}
                      {entry.kind === "folder" && entry.id !== UNCATEGORIZED_ID && (
                        <button
                          className="sidebar-entry-del"
                          onClick={(e) => { e.stopPropagation(); setPendingDeleteFolder(entry.id); }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "#ff6b6b")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "")}
                        >✕</button>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}

        {/* 리사이즈 핸들 */}
        <div
          style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 5, cursor: "col-resize", zIndex: 300 }}
          onMouseDown={(e) => {
            e.preventDefault();
            sidebarResizing.current = true;
            const startX = e.clientX;
            const startW = sidebarWidth;
            const onMove = (ev: MouseEvent) => {
              if (!sidebarResizing.current) return;
              const next = Math.min(400, Math.max(180, startW + ev.clientX - startX));
              setSidebarWidth(next);
            };
            const onUp = (ev: MouseEvent) => {
              sidebarResizing.current = false;
              const next = Math.min(400, Math.max(180, startW + ev.clientX - startX));
              try { localStorage.setItem("super_sidebar_w", String(next)); } catch {}
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        />

        </aside>

      {/* MAIN 영역 — 한줄 메모장 2단 레이아웃 */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* 왼쪽 컬럼: 입력바 + 콘텐츠 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* 상단 입력바 — 한줄 메모장 스타일 */}
          <div className="super-input-row">
            <button
              className="super-hamburger"
              style={sidebarCollapsed ? { display: "inline-flex" } : undefined}
              onClick={() => {
                if (sidebarCollapsed) {
                  setSidebarCollapsed(false);
                  try { localStorage.setItem("super_sidebar_collapsed", "0"); } catch {}
                } else {
                  setSidebarOpen((o) => !o);
                }
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </button>

            <div className={`super-input-bar${(selectedId !== "all" && !isFolderView && !detailId) ? " is-inactive" : ""}`}>
              {((selectedId === "all" && allQuickMode === "memo") || isFolderView) && (
                <input
                  type="date"
                  value={topInputDate}
                  onChange={(e) => setTopInputDate(e.target.value)}
                />
              )}
              {selectedId === "all" && (
                <>
                  <div className="super-quick-toggle">
                    <button type="button" className={`super-quick-toggle-btn${allQuickMode === "memo" ? " is-active" : ""}`} onClick={() => setAllQuickMode("memo")}>메모</button>
                    <button type="button" className={`super-quick-toggle-btn${allQuickMode === "todo" ? " is-active" : ""}`} onClick={() => setAllQuickMode("todo")}>투두</button>
                  </div>
                  <select className="super-target-select" value={allQuickTargetId} onChange={(e) => setAllQuickTargetId(e.target.value)}>
                    {(allQuickMode === "memo" ? allMemoTargets : allTodoTargets).map((target) => (
                      <option key={target.id} value={target.id}>
                        {allQuickMode === "memo"
                          ? ((target as MemoFolder).id === UNCATEGORIZED_ID ? "All" : (target as MemoFolder).name)
                          : (target as Panel).title}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <input
                ref={topInputRef}
                type="text"
                value={topInputVal}
                onChange={(e) => setTopInputVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleTopAdd(); }}
                placeholder={
                  isFolderView
                    ? "메모를 입력하고 Enter…"
                    : detailId
                      ? "할 일 입력 후 Enter…"
                      : "카드를 선택해 할 일 추가…"
                }
              />
            </div>
          </div>

          {/* 콘텐츠 */}
          <div className="super-list-panel">
            {isFolderView ? (
              selectedFolder ? (
                <MemoView
                  folder={selectedFolder}
                  memos={memos}
                  onDeleteMemo={requestDeleteMemo}
                />
              ) : (
                <div className="super-empty">폴더를 찾을 수 없습니다</div>
              )
            ) : (
              <div className="super-masonry">
                {selectedId === "all" && <PersonalityCard data={personality} />}
                {selectedId === "all"
                  ? allDashboardCards.map((card) =>
                      card.kind === "todo" ? (
                        <TodoCard
                          key={`todo_${card.panel.id}`}
                          panel={card.panel}
                          items={itemsCache[card.panel.id] ?? []}
                          onToggle={handleToggle}
                          onDeleteItem={requestDeleteTodoItem}
                          onClick={() => handlePanelClick(card.panel.id)}
                          isSelected={detailId === card.panel.id}
                        />
                      ) : (
                        <MemoFolderCard
                          key={`memo_${card.folder.id}`}
                          folder={card.folder}
                          memos={allMemoCache[card.folder.id] ?? []}
                          onClick={() => setSelectedId(`folder_${card.folder.id}`)}
                        />
                      )
                    )
                  : panels.map((panel) => (
                      <TodoCard
                        key={panel.id}
                        panel={panel}
                        items={itemsCache[panel.id] ?? []}
                        onToggle={handleToggle}
                        onDeleteItem={requestDeleteTodoItem}
                        onClick={() => handlePanelClick(panel.id)}
                        isSelected={detailId === panel.id}
                      />
                    ))}
                {(selectedId === "all"
                  ? allDashboardCards.length === 0 && !(personality?.traits?.length)
                  : panels.length === 0 && memoFolders.length === 0) && (
                  <div className="super-empty">
                    {hydrated ? "패널이 없습니다" : "로딩 중..."}
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* 오른쪽: 상세 패널 */}
        {selectedPanel && (
          <div className="super-detail-panel">
            <TodoDetail
              panel={selectedPanel}
              items={itemsCache[selectedPanel.id] ?? []}
              onBack={() => setDetailId(null)}
              onToggle={handleToggle}
              onDeleteItem={requestDeleteTodoItem}
            />
          </div>
        )}

      </div>
    </div>
  );
}
