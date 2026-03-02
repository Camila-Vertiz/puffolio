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

  // paged rows
  const [rows, setRows] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  // filters
  const [filterTopicId, setFilterTopicId] = useState<string>("");
  const [search, setSearch] = useState("");

  // form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // load topics once
  useEffect(() => {
    (async () => {
      const qy = query(collection(db, "topics"), orderBy("order", "asc"));
      const snap = await getDocs(qy);

      const list = snap.docs.map((d) => {
        const data = d.data() as Omit<Topic, "id">;
        return { id: d.id, ...data };
      });

      setTopics(list);

      // default topic for form
      if (!form.topicId && list[0]?.id) {
        setForm((p) => ({ ...p, topicId: list[0].id }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.name ?? "—";

  // build base query (first page)
  const buildFirstQuery = (topicId: string) => {
    const base = collection(db, "questions");
    return topicId
      ? query(
          base,
          where("topicId", "==", topicId),
          orderBy("createdAt", "desc"),
          limit(PAGE_SIZE),
        )
      : query(base, orderBy("createdAt", "desc"), limit(PAGE_SIZE));
  };

  // build query for next page
  const buildMoreQuery = (
    topicId: string,
    last: QueryDocumentSnapshot<DocumentData>,
  ) => {
    const base = collection(db, "questions");
    return topicId
      ? query(
          base,
          where("topicId", "==", topicId),
          orderBy("createdAt", "desc"),
          startAfter(last),
          limit(PAGE_SIZE),
        )
      : query(
          base,
          orderBy("createdAt", "desc"),
          startAfter(last),
          limit(PAGE_SIZE),
        );
  };

  async function loadFirstPage(topicId: string) {
    setLoading(true);

    const snap = await getDocs(buildFirstQuery(topicId));
    const items = snap.docs.map((d) => {
      const data = d.data() as Omit<Question, "id">;
      return { id: d.id, ...data };
    });

    setRows(items);

    const last = snap.docs.at(-1) ?? null;
    setCursor(last);
    setHasMore(snap.docs.length === PAGE_SIZE);

    setLoading(false);
  }

  async function loadMore() {
    if (!cursor || !hasMore) return;

    setLoading(true);

    const snap = await getDocs(buildMoreQuery(filterTopicId, cursor));
    const items = snap.docs.map((d) => {
      const data = d.data() as Omit<Question, "id">;
      return { id: d.id, ...data };
    });

    setRows((prev) => [...prev, ...items]);

    const last = snap.docs.at(-1) ?? null;
    setCursor(last);
    setHasMore(snap.docs.length === PAGE_SIZE);

    setLoading(false);
  }

  // initial page
  useEffect(() => {
    loadFirstPage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // filter loaded rows by search (client-side)
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

  // CRUD
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
    if (form.correctIndex < 0 || form.correctIndex > 3) {
      return alert("Correct option must be 0..3");
    }

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

    if (editingId) {
      await updateQuestion(editingId, payload);
    } else {
      await createQuestion(payload);
    }

    setEditingId(null);
    setForm(emptyForm);

    // refresh current view (first page)
    await loadFirstPage(filterTopicId);
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete question? (Permanent)");
    if (!ok) return;
    await deleteQuestion(id);
    await loadFirstPage(filterTopicId);
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      {/* TABLE */}
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Questions</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Paged table + topic filter + search
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
            onChange={(e) => {
              const v = e.target.value;
              setFilterTopicId(v);
              setSearch("");
              loadFirstPage(v);
            }}
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
            placeholder="Search prompt / options / explanation…"
            style={{
              flex: 1,
              minWidth: 220,
              padding: 12,
              borderRadius: 12,
              border: "1px solid var(--border)",
            }}
          />

          <button
            className="btn"
            onClick={() => loadFirstPage(filterTopicId)}
            disabled={loading}
          >
            Refresh
          </button>

          <button
            className="btn"
            onClick={loadMore}
            disabled={loading || !hasMore}
          >
            {hasMore ? "Load more" : "No more"}
          </button>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Showing <b>{visible.length}</b> of <b>{rows.length}</b> loaded{" "}
          {hasMore ? `(more available)` : `(all loaded)`}.
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
