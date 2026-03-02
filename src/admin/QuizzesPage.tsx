import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Quiz, Topic } from "../data/firestoreRepo";
import { createQuiz, deleteQuiz, updateQuiz } from "../data/firestoreRepo";

type FormState = {
  name: string;
  topicIds: string[];
  mode: "study" | "exam";
  questionCount: number;
  perQuestionTimeSec: number; // default 45
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  topicIds: [],
  mode: "study",
  questionCount: 20,
  perQuestionTimeSec: 45,
  isActive: true,
};

const PAGE_SIZE = 2;

export default function QuizzesPage() {
  const [topics, setTopics] = useState<Topic[]>([]);

  // current page only (NOT growing)
  const [rows, setRows] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [search, setSearch] = useState("");

  // page state
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  // cursor stack: pageCursors[i] cursor to start AFTER for page i+1
  const [pageCursors, setPageCursors] = useState<
    Array<QueryDocumentSnapshot<DocumentData> | null>
  >([null]);

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // ---- topics (for names + checkboxes)
  useEffect(() => {
    const run = async () => {
      const snap = await getDocs(
        query(collection(db, "topics"), orderBy("order", "asc")),
      );
      const tps = snap.docs.map((d) => {
        const data = d.data() as Omit<Topic, "id">;
        return { id: d.id, ...data };
      });
      setTopics(tps);
    };
    run().catch(console.error);
  }, []);

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.name ?? "—";
  const topicNames = (ids: string[]) => (ids ?? []).map(topicName).join(", ");

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((qz) => {
      const name = (qz.name ?? "").toLowerCase();
      const topicsText = topicNames(qz.topicIds ?? []).toLowerCase();
      return name.includes(s) || topicsText.includes(s);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, topics]);

  const buildQuery = (
    cursorAfter: QueryDocumentSnapshot<DocumentData> | null,
  ) => {
    const base = collection(db, "quizzes");
    // newest first for admin
    return cursorAfter
      ? query(
          base,
          orderBy("createdAt", "desc"),
          startAfter(cursorAfter),
          limit(PAGE_SIZE + 1),
        )
      : query(base, orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1));
  };

  async function fetchPage(opts: {
    pageIndex: number; // 1-based
    cursorAfter: QueryDocumentSnapshot<DocumentData> | null;
    updateCursors?: boolean;
  }) {
    setLoading(true);

    const snap = await getDocs(buildQuery(opts.cursorAfter));

    const pageDocs = snap.docs.slice(0, PAGE_SIZE);
    const items = pageDocs.map((d) => {
      const data = d.data() as Omit<Quiz, "id">;
      return { id: d.id, ...data };
    });

    setRows(items);

    const nextExists = snap.docs.length > PAGE_SIZE;
    setHasNext(nextExists);

    const nextCursor = pageDocs.at(-1) ?? null;

    if (opts.updateCursors) {
      setPageCursors((prev) => {
        const copy = prev.slice(0, opts.pageIndex); // keep up to current page
        copy[opts.pageIndex] = nextCursor; // cursor for NEXT page
        return copy;
      });
    }

    setLoading(false);
  }

  async function loadFirstPage() {
    setPage(1);
    setPageCursors([null]);
    setSearch("");
    await fetchPage({ pageIndex: 1, cursorAfter: null, updateCursors: true });
  }

  const goPrev = async () => {
    if (page <= 1) return;
    const newPage = page - 1;
    const cursorAfter = pageCursors[newPage - 1] ?? null;

    setPage(newPage);
    await fetchPage({ pageIndex: newPage, cursorAfter, updateCursors: false });
  };

  const goNext = async () => {
    if (!hasNext) return;

    const cursorAfter = pageCursors[page] ?? null;
    const newPage = page + 1;

    setPage(newPage);
    await fetchPage({ pageIndex: newPage, cursorAfter, updateCursors: true });
  };

  useEffect(() => {
    loadFirstPage().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- CRUD / form
  const startCreate = () => {
    setEditingId(null);
    const first = topics[0]?.id ? [topics[0].id] : [];
    setForm({ ...emptyForm, topicIds: first });
  };

  const startEdit = (qz: Quiz) => {
    setEditingId(qz.id);
    setForm({
      name: qz.name ?? "",
      topicIds: qz.topicIds ?? [],
      mode: qz.mode ?? "study",
      questionCount: qz.questionCount ?? 20,
      perQuestionTimeSec: qz.perQuestionTimeSec ?? 45,
      isActive: qz.isActive ?? true,
    });
  };

  const save = async () => {
    if (!form.name.trim()) return alert("Quiz name required");
    if (!form.topicIds.length) return alert("Select at least 1 topic");
    if (form.questionCount <= 0) return alert("questionCount must be > 0");
    if (form.perQuestionTimeSec <= 0)
      return alert("perQuestionTimeSec must be > 0");

    const payload: Omit<Quiz, "id" | "createdAt" | "updatedAt"> = {
      name: form.name.trim(),
      topicIds: form.topicIds,
      mode: form.mode,
      questionCount: form.questionCount,
      perQuestionTimeSec: form.perQuestionTimeSec,
      isActive: form.isActive,
    };

    if (editingId) await updateQuiz(editingId, payload);
    else await createQuiz(payload);

    setEditingId(null);
    setForm(emptyForm);

    // reload current page
    const cursorAfter = pageCursors[page - 1] ?? null;
    await fetchPage({ pageIndex: page, cursorAfter, updateCursors: true });
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete quiz? (Permanent)");
    if (!ok) return;
    await deleteQuiz(id);

    const cursorAfter = pageCursors[page - 1] ?? null;
    await fetchPage({ pageIndex: page, cursorAfter, updateCursors: true });
  };

  const toggleTopic = (topicId: string, checked: boolean) => {
    setForm((p) => ({
      ...p,
      topicIds: checked
        ? Array.from(new Set([...p.topicIds, topicId]))
        : p.topicIds.filter((x) => x !== topicId),
    }));
  };

  const selectedCount = form.topicIds.length;

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      {/* TABLE */}
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Quizzes</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Table + search + real pages (multi-topic + per-question timer)
            </div>
          </div>
          <button className="btn" onClick={startCreate}>
            + New
          </button>
        </div>

        <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search current page… (name or topics)"
            style={{
              flex: 1,
              minWidth: 260,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          />

          <button className="btn" onClick={loadFirstPage} disabled={loading}>
            Refresh
          </button>

          <div className="row">
            <button
              className="btn"
              onClick={goPrev}
              disabled={loading || page <= 1}
            >
              Prev
            </button>
            <span className="muted" style={{ fontSize: 12 }}>
              Page <b style={{ color: "var(--text)" }}>{page}</b>
            </span>
            <button
              className="btn"
              onClick={goNext}
              disabled={loading || !hasNext}
            >
              Next
            </button>
          </div>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Showing <b>{visible.length}</b> rows on this page.
        </div>

        <div style={{ overflowX: "auto", marginTop: 12 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
            }}
          >
            <thead>
              <tr>
                <th style={thLeft}>Name</th>
                <th style={thLeft}>Topics</th>
                <th style={thLeft}>Mode</th>
                <th style={thLeft}>Q</th>
                <th style={thLeft}>Sec/Q</th>
                <th style={thLeft}>Status</th>
                <th style={thRight}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((qz) => (
                <tr key={qz.id}>
                  <td style={tdLeft}>
                    <div style={{ fontWeight: 800 }}>{qz.name}</div>
                  </td>

                  <td style={tdLeft}>
                    <div style={{ maxWidth: 420 }}>
                      <span className="muted" style={{ fontSize: 13 }}>
                        {topicNames(qz.topicIds ?? []) || "—"}
                      </span>
                    </div>
                  </td>

                  <td style={tdLeft}>{qz.mode ?? "study"}</td>
                  <td style={tdLeft}>{qz.questionCount ?? 20}</td>
                  <td style={tdLeft}>{qz.perQuestionTimeSec ?? 45}</td>

                  <td style={tdLeft}>
                    <span
                      className="badge"
                      style={{
                        color: qz.isActive ? "#166534" : "#6b7280",
                        borderColor: qz.isActive ? "#bbf7d0" : "var(--border)",
                      }}
                    >
                      {qz.isActive ? "active" : "inactive"}
                    </span>
                  </td>

                  <td style={tdRight}>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn" onClick={() => startEdit(qz)}>
                        Edit
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          updateQuiz(qz.id, { isActive: !qz.isActive })
                        }
                      >
                        {qz.isActive ? "Disable" : "Enable"}
                      </button>
                      <button className="btn" onClick={() => remove(qz.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && visible.length === 0 && (
                <tr>
                  <td style={{ ...tdLeft, padding: 16 }} colSpan={7}>
                    <span className="muted">No results.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {loading && (
          <div className="muted" style={{ marginTop: 12 }}>
            Loading…
          </div>
        )}
      </section>

      {/* FORM */}
      <section className="card">
        <div style={{ fontWeight: 900 }}>
          {editingId ? "Edit Quiz" : "Create Quiz"}
        </div>

        <div className="list" style={{ marginTop: 12 }}>
          <label className="list">
            <span className="muted" style={{ fontSize: 12 }}>
              Name
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
              placeholder="e.g. AWS Mixed Exam 40Q"
            />
          </label>

          {/* Topics multi select */}
          <div className="list">
            <div className="spaceBetween">
              <span className="muted" style={{ fontSize: 12 }}>
                Topics (select 1+)
              </span>
              <span className="muted" style={{ fontSize: 12 }}>
                Selected: {selectedCount}
              </span>
            </div>

            <div
              className="grid"
              style={{ gridTemplateColumns: "1fr 1fr", gap: 10 }}
            >
              {topics.map((t) => {
                const checked = form.topicIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: checked ? "#fff" : "transparent",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => toggleTopic(t.id, e.target.checked)}
                    />
                    <span style={{ fontWeight: 700 }}>{t.name}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="row">
            <label className="list" style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Mode
              </span>
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    mode: e.target.value as "study" | "exam",
                  }))
                }
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              >
                <option value="study">study</option>
                <option value="exam">exam</option>
              </select>
            </label>

            <label className="list" style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Question count
              </span>
              <input
                type="number"
                value={form.questionCount}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    questionCount: Number(e.target.value),
                  }))
                }
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              />
            </label>
          </div>

          <label className="list">
            <span className="muted" style={{ fontSize: 12 }}>
              Seconds per question
            </span>
            <input
              type="number"
              value={form.perQuestionTimeSec}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  perQuestionTimeSec: Number(e.target.value),
                }))
              }
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            />
          </label>

          <label className="row">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) =>
                setForm((p) => ({ ...p, isActive: e.target.checked }))
              }
            />
            <span>Active</span>
          </label>

          <div className="row">
            <button className="btn btnPrimary" onClick={save}>
              {editingId ? "Save changes" : "Create"}
            </button>
            <button
              className="btn"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const thLeft: React.CSSProperties = {
  textAlign: "left",
  padding: 12,
  borderBottom: "1px solid var(--border)",
  fontSize: 12,
  color: "var(--muted)",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const thRight: React.CSSProperties = { ...thLeft, textAlign: "right" };

const tdLeft: React.CSSProperties = {
  padding: 12,
  borderBottom: "1px solid var(--border)",
  verticalAlign: "top",
};

const tdRight: React.CSSProperties = { ...tdLeft, textAlign: "right" };
