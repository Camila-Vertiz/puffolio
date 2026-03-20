import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  getCountFromServer,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  createQuestion,
  deleteQuestion,
  updateQuestion,
} from "../data/firestoreRepo";
import type { Topic, Question } from "../data/firestoreRepo";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import remarkBreaks from "remark-breaks";

type Difficulty = "easy" | "medium" | "hard";

type FormState = {
  topicId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: Difficulty;
  isActive: boolean;
};

const emptyForm: FormState = {
  topicId: "",
  prompt: "",
  options: ["", "", "", ""],
  correctIndex: 0,
  explanation: "",
  difficulty: "medium",
  isActive: true,
};

const PAGE_SIZE = 2;

function normalizeDifficulty(v: unknown): Difficulty {
  return v === "easy" || v === "hard" || v === "medium" ? v : "medium";
}

export default function QuestionsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);

  // current page rows (NOT growing)
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
  const [filterTopicId, setFilterTopicId] = useState<string>("");
  const [search, setSearch] = useState("");

  // page state
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  // cursor stack: pageCursors[i] is the cursor to start AFTER for page i+1
  // page 1 cursor is null (no startAfter)
  const [pageCursors, setPageCursors] = useState<
    Array<QueryDocumentSnapshot<DocumentData> | null>
  >([null]);

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [totalQuestions, setTotalQuestions] = useState<number | null>(null);

  // load topics once
  useEffect(() => {
    (async () => {
      const snap = await getDocs(
        query(collection(db, "topics"), orderBy("order", "asc")),
      );

      const list = snap.docs.map((d) => {
        const data = d.data() as Omit<Topic, "id">;
        return { id: d.id, ...data };
      });

      setTopics(list);

      if (!form.topicId && list[0]?.id) {
        setForm((p) => ({ ...p, topicId: list[0].id }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.name ?? "—";

  async function fetchPage(opts: {
    topicId: string;
    pageIndex: number; // 1-based
    cursorAfter: QueryDocumentSnapshot<DocumentData> | null;
    updateCursors?: boolean;
  }) {
    setLoading(true);

    try {
      const base = collection(db, "questions");

      if (opts.pageIndex === 1 || totalQuestions === null) {
        const countQuery = opts.topicId ? query(base, where("topicId", "==", opts.topicId)) : base;
        getCountFromServer(countQuery).then(snap => setTotalQuestions(snap.data().count)).catch(() => { });
      }

      // If we use both where() and orderBy() on different fields, Firestore demands a composite index.
      // To work around this missing index and prevent hanging, we omit orderBy("createdAt") when filtering by topicId.
      const qy =
        opts.topicId && opts.cursorAfter
          ? query(
            base,
            where("topicId", "==", opts.topicId),
            startAfter(opts.cursorAfter),
            limit(PAGE_SIZE + 1), // +1 to detect next
          )
          : opts.topicId && !opts.cursorAfter
            ? query(
              base,
              where("topicId", "==", opts.topicId),
              limit(PAGE_SIZE + 1),
            )
            : !opts.topicId && opts.cursorAfter
              ? query(
                base,
                orderBy("createdAt", "desc"),
                startAfter(opts.cursorAfter),
                limit(PAGE_SIZE + 1),
              )
              : query(base, orderBy("createdAt", "desc"), limit(PAGE_SIZE + 1));

      const snap = await getDocs(qy);

      // take first PAGE_SIZE as the page
      const pageDocs = snap.docs.slice(0, PAGE_SIZE);

      const items = pageDocs.map((d) => {
        const data = d.data() as Omit<Question, "id">;
        return { id: d.id, ...data };
      });

      setRows(items);

      // next page exists if we got extra doc
      const nextExists = snap.docs.length > PAGE_SIZE;
      setHasNext(nextExists);

      // cursor for NEXT page should be the last doc of this page
      const nextCursor = pageDocs.at(-1) ?? null;

      if (opts.updateCursors) {
        setPageCursors((prev) => {
          const copy = prev.slice(0, opts.pageIndex); // keep up to current page index
          // copy length should equal pageIndex
          // store cursor for next page at index pageIndex (since pageIndex is 1-based)
          copy[opts.pageIndex] = nextCursor;
          return copy;
        });
      }
    } catch (err: any) {
      console.error("fetchPage error:", err);
      alert("Failed to fetch questions: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  // initial load
  useEffect(() => {
    // page 1 cursor = null
    setPage(1);
    setPageCursors([null]);
    fetchPage({
      topicId: "",
      pageIndex: 1,
      cursorAfter: null,
      updateCursors: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // visible rows = search over current page ONLY
  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((q) => {
      const hay = [
        q.prompt ?? "",
        q.explanation ?? "",
        ...(q.options ?? []),
        q.difficulty ?? "",
      ]
        .join("\n")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [rows, search]);

  const onChangeTopic = async (topicId: string) => {
    setFilterTopicId(topicId);
    setSearch("");
    setPage(1);
    setPageCursors([null]);

    await fetchPage({
      topicId,
      pageIndex: 1,
      cursorAfter: null,
      updateCursors: true,
    });
  };

  const goPrev = async () => {
    if (page <= 1) return;
    const newPage = page - 1;

    // cursorAfter for page N is pageCursors[N-1]
    const cursorAfter = pageCursors[newPage - 1] ?? null;

    setPage(newPage);
    await fetchPage({
      topicId: filterTopicId,
      pageIndex: newPage,
      cursorAfter,
      updateCursors: false,
    });
  };

  const goNext = async () => {
    if (!hasNext) return;

    const cursorAfter = pageCursors[page] ?? null; // cursor saved for next page
    const newPage = page + 1;

    setPage(newPage);
    await fetchPage({
      topicId: filterTopicId,
      pageIndex: newPage,
      cursorAfter,
      updateCursors: true,
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      topicId: topics[0]?.id ?? filterTopicId ?? "",
    });
    setShowForm(true);
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setForm({
      topicId: q.topicId,
      prompt: q.prompt,
      options: q.options?.length ? q.options : ["", "", "", ""],
      correctIndex: q.correctIndex ?? 0,
      explanation: q.explanation ?? "",
      difficulty: normalizeDifficulty(q.difficulty),
      isActive: q.isActive ?? true,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.topicId) return alert("Select a topic");
    if (!form.prompt.trim()) return alert("Prompt required");

    const cleanedOptions = form.options.map((s) => s.trim());
    if (cleanedOptions.some((x) => !x)) return alert("All 4 options required");
    if (form.correctIndex < 0 || form.correctIndex > 3)
      return alert("Correct option must be 0..3");

    const payload = {
      topicId: form.topicId,
      prompt: form.prompt.trim(),
      options: cleanedOptions,
      correctIndex: form.correctIndex,
      explanation: form.explanation.trim(),
      difficulty: form.difficulty,
      rand: Math.random(),
      isActive: form.isActive,
    };

    if (editingId) await updateQuestion(editingId, payload);
    else await createQuestion(payload);

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);

    // reload current page (page cursors still valid enough for admin use)
    const cursorAfter = pageCursors[page - 1] ?? null;
    await fetchPage({
      topicId: filterTopicId,
      pageIndex: page,
      cursorAfter,
      updateCursors: true,
    });
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete question? (Permanent)");
    if (!ok) return;
    await deleteQuestion(id);

    // reload current page
    const cursorAfter = pageCursors[page - 1] ?? null;
    await fetchPage({
      topicId: filterTopicId,
      pageIndex: page,
      cursorAfter,
      updateCursors: true,
    });
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {!showForm ? (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="spaceBetween">
            <div>
              <div className="cardTitle" style={{ margin: 0 }}>Questions</div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Total: <b style={{ color: "var(--text)" }}>{totalQuestions !== null ? totalQuestions : "..."}</b> • Showing page {page}
              </div>
            </div>

            <div className="row">
              <button className="btn" onClick={startCreate}>
                + New
              </button>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
            <select
              value={filterTopicId}
              onChange={(e) => onChangeTopic(e.target.value)}
              style={{ minWidth: 220 }}
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search current page…"
              style={{ flex: 1, minWidth: 220 }}
            />

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

          <div className="list" style={{ marginTop: 16 }}>
            {visible.map((q) => (
              <div key={q.id} className="item" style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 16 }}>

                <div className="spaceBetween" style={{ width: "100%", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div data-color-mode="dark" style={{ fontSize: 16, lineHeight: 1.5 }}>
                      <MDEditor.Markdown source={q.prompt} remarkPlugins={[remarkBreaks]} style={{ background: "transparent", color: "var(--text-primary)", fontFamily: "inherit" }} />
                    </div>

                    <div className="row" style={{ marginTop: 10, gap: 8 }}>
                      <span className="badge">{topicName(q.topicId)}</span>
                      <span className="badge" style={{ color: "var(--link)", borderColor: "rgba(96,165,250,0.3)" }}>
                        {normalizeDifficulty(q.difficulty)}
                      </span>
                      <span
                        className="badge"
                        style={{
                          color: q.isActive ? "#4ade80" : "#94a3b8",
                          borderColor: q.isActive ? "rgba(74,222,128,0.2)" : "var(--border)",
                          background: q.isActive ? "rgba(74,222,128,0.05)" : "transparent"
                        }}
                      >
                        {q.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="row" style={{ flexShrink: 0 }}>
                    <button className="btn" onClick={() => startEdit(q)} style={{ padding: "6px 12px", fontSize: 13 }}>
                      Edit
                    </button>
                    <button
                      className="btn"
                      onClick={() => updateQuestion(q.id, { isActive: !q.isActive })}
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      {q.isActive ? "Disable" : "Enable"}
                    </button>
                    <button className="btn" onClick={() => remove(q.id)} style={{ padding: "6px 12px", fontSize: 13 }}>
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 0 }}>
                  {q.options?.map((opt, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: `1px solid ${i === q.correctIndex ? "var(--primary)" : "var(--border)"}`,
                        background: i === q.correctIndex ? "rgba(59, 130, 246, 0.1)" : "rgba(255,255,255,0.02)",
                        color: i === q.correctIndex ? "var(--text-primary)" : "var(--muted)"
                      }}
                    >
                      <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        background: i === q.correctIndex ? "var(--primary)" : "rgba(255,255,255,0.05)",
                        color: i === q.correctIndex ? "#fff" : "var(--text)"
                      }}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>

              </div>
            ))}

            {!loading && visible.length === 0 && (
              <div className="item" style={{ justifyContent: "center", padding: 32 }}>
                <span className="muted">No results found.</span>
              </div>
            )}
          </div>

          {loading && (
            <div className="muted" style={{ marginTop: 12 }}>
              Loading…
            </div>
          )}
        </section>
      ) : (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="spaceBetween">
            <div className="cardTitle" style={{ margin: 0 }}>
              {editingId ? "Edit Question" : "Create Question"}
            </div>
            <button className="btn btnGhost" onClick={closeForm}>
              ✕ Close
            </button>
          </div>

          <div className="list" style={{ marginTop: 12 }}>
            <label className="list">
              <span className="muted" style={{ fontSize: 12 }}>
                Topic
              </span>
              <select
                value={form.topicId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, topicId: e.target.value }))
                }
              >
                <option value="" disabled>
                  Select…
                </option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="list">
              <span className="muted" style={{ fontSize: 12 }}>Prompt</span>
              <div data-color-mode="dark">
                <MDEditor
                  value={form.prompt}
                  onChange={(v) => setForm((p) => ({ ...p, prompt: v ?? "" }))}
                  height={200}
                  preview="edit"
                />
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 12 }}>
              {form.options.map((opt, i) => (
                <label key={i} className="list">
                  <span className="muted" style={{ fontSize: 12 }}>
                    Option {String.fromCharCode(65 + i)}
                  </span>
                  <input
                    value={opt}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((p) => {
                        const next = [...p.options];
                        next[i] = v;
                        return { ...p, options: next };
                      });
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="row">
              <label className="list" style={{ flex: 1 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Correct
                </span>
                <select
                  value={form.correctIndex}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      correctIndex: Number(e.target.value),
                    }))
                  }
                >
                  <option value={0}>A</option>
                  <option value={1}>B</option>
                  <option value={2}>C</option>
                  <option value={3}>D</option>
                </select>
              </label>

              <label className="list" style={{ flex: 1 }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  Difficulty
                </span>
                <select
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      difficulty: normalizeDifficulty(e.target.value),
                    }))
                  }
                >
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </label>
            </div>

            <div className="list">
              <span className="muted" style={{ fontSize: 12 }}>Explanation</span>
              <div data-color-mode="dark">
                <MDEditor
                  value={form.explanation}
                  onChange={(v) => setForm((p) => ({ ...p, explanation: v ?? "" }))}
                  height={150}
                  preview="edit"
                />
              </div>
            </div>

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

            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn" onClick={closeForm}>
                Cancel
              </button>
              <button className="btn btnPrimary" onClick={save}>
                {editingId ? "Save changes" : "Create Question"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}


