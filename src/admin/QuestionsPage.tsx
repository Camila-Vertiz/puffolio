import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
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

    const base = collection(db, "questions");

    const qy =
      opts.topicId && opts.cursorAfter
        ? query(
            base,
            where("topicId", "==", opts.topicId),
            orderBy("createdAt", "desc"),
            startAfter(opts.cursorAfter),
            limit(PAGE_SIZE + 1), // +1 to detect next
          )
        : opts.topicId && !opts.cursorAfter
          ? query(
              base,
              where("topicId", "==", opts.topicId),
              orderBy("createdAt", "desc"),
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

    setLoading(false);
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
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      {/* TABLE */}
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Questions</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Table + search + real pages
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
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid var(--border)",
              minWidth: 220,
            }}
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
            style={{
              flex: 1,
              minWidth: 220,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
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
                <th style={thLeft}>Prompt</th>
                <th style={thLeft}>Topic</th>
                <th style={thLeft}>Difficulty</th>
                <th style={thLeft}>Status</th>
                <th style={thRight}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((q) => (
                <tr key={q.id}>
                  <td style={tdLeft}>
                    <div style={{ fontWeight: 800 }}>{q.prompt}</div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 6 }}
                    >
                      A: {q.options?.[0]} • B: {q.options?.[1]} • C:{" "}
                      {q.options?.[2]} • D: {q.options?.[3]}
                    </div>
                    <div
                      className="muted"
                      style={{ fontSize: 12, marginTop: 6 }}
                    >
                      correct: {String.fromCharCode(65 + (q.correctIndex ?? 0))}
                    </div>
                  </td>

                  <td style={tdLeft}>{topicName(q.topicId)}</td>

                  <td style={tdLeft}>
                    <span
                      className="badge"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {normalizeDifficulty(q.difficulty)}
                    </span>
                  </td>

                  <td style={tdLeft}>
                    <span
                      className="badge"
                      style={{
                        color: q.isActive ? "#166534" : "#6b7280",
                        borderColor: q.isActive ? "#bbf7d0" : "var(--border)",
                      }}
                    >
                      {q.isActive ? "active" : "inactive"}
                    </span>
                  </td>

                  <td style={tdRight}>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn" onClick={() => startEdit(q)}>
                        Edit
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          updateQuestion(q.id, { isActive: !q.isActive })
                        }
                      >
                        {q.isActive ? "Disable" : "Enable"}
                      </button>
                      <button className="btn" onClick={() => remove(q.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && visible.length === 0 && (
                <tr>
                  <td style={{ ...tdLeft, padding: 16 }} colSpan={5}>
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
          {editingId ? "Edit Question" : "Create Question"}
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
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
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

          <label className="list">
            <span className="muted" style={{ fontSize: 12 }}>
              Prompt
            </span>
            <textarea
              value={form.prompt}
              onChange={(e) =>
                setForm((p) => ({ ...p, prompt: e.target.value }))
              }
              rows={3}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
                resize: "vertical",
              }}
              placeholder="Write the question text…"
            />
          </label>

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
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid var(--border)",
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
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
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
                style={{
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                }}
              >
                <option value="easy">easy</option>
                <option value="medium">medium</option>
                <option value="hard">hard</option>
              </select>
            </label>
          </div>

          <label className="list">
            <span className="muted" style={{ fontSize: 12 }}>
              Explanation
            </span>
            <textarea
              value={form.explanation}
              onChange={(e) =>
                setForm((p) => ({ ...p, explanation: e.target.value }))
              }
              rows={3}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
                resize: "vertical",
              }}
              placeholder="Explain why the answer is correct…"
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
