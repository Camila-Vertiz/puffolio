import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getCountFromServer,
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
  perQuestionTimeSec: number;
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

const PAGE_SIZE = 10;

export default function QuizzesPage() {
  const [topics, setTopics] = useState<Topic[]>([]);

  const [rows, setRows] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [pageCursors, setPageCursors] = useState<
    Array<QueryDocumentSnapshot<DocumentData> | null>
  >([null]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [totalQuizzes, setTotalQuizzes] = useState<number | null>(null);

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

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((qz) => {
      const hay = [
        qz.name ?? "",
        qz.mode ?? "",
        ...(qz.topicIds ?? []).map(topicName),
        String(qz.questionCount ?? ""),
        String(qz.perQuestionTimeSec ?? ""),
      ]
        .join("\n")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [rows, search, topics]);

  const buildQuery = (
    cursorAfter: QueryDocumentSnapshot<DocumentData> | null,
  ) => {
    const base = collection(db, "quizzes");

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
    pageIndex: number;
    cursorAfter: QueryDocumentSnapshot<DocumentData> | null;
    updateCursors?: boolean;
  }) {
    setLoading(true);

    try {
      if (opts.pageIndex === 1 || totalQuizzes === null) {
        getCountFromServer(collection(db, "quizzes"))
          .then((snap) => setTotalQuizzes(snap.data().count))
          .catch(() => {});
      }

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
          const copy = prev.slice(0, opts.pageIndex);
          copy[opts.pageIndex] = nextCursor;
          return copy;
        });
      }
    } catch (err: any) {
      console.error("fetchPage error:", err);
      alert("Failed to fetch quizzes: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    setPageCursors([null]);
    fetchPage({
      pageIndex: 1,
      cursorAfter: null,
      updateCursors: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goPrev = async () => {
    if (page <= 1) return;

    const newPage = page - 1;
    const cursorAfter = pageCursors[newPage - 1] ?? null;

    setPage(newPage);
    await fetchPage({
      pageIndex: newPage,
      cursorAfter,
      updateCursors: false,
    });
  };

  const goNext = async () => {
    if (!hasNext) return;

    const cursorAfter = pageCursors[page] ?? null;
    const newPage = page + 1;

    setPage(newPage);
    await fetchPage({
      pageIndex: newPage,
      cursorAfter,
      updateCursors: true,
    });
  };

  const startCreate = () => {
    setEditingId(null);
    const first = topics[0]?.id ? [topics[0].id] : [];
    setForm({ ...emptyForm, topicIds: first });
    setShowForm(true);
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
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.name.trim()) return alert("Quiz name required");
    if (!form.topicIds.length) return alert("Select at least 1 topic");
    if (form.questionCount <= 0) return alert("Question count must be > 0");
    if (form.perQuestionTimeSec <= 0) {
      return alert("Seconds per question must be > 0");
    }

    const payload: Omit<Quiz, "id"> = {
      name: form.name.trim(),
      topicIds: form.topicIds,
      mode: form.mode,
      questionCount: form.questionCount,
      perQuestionTimeSec: form.perQuestionTimeSec,
      isActive: form.isActive,
    };

    if (editingId) await updateQuiz(editingId, payload);
    else await createQuiz(payload);

    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);

    const cursorAfter = pageCursors[page - 1] ?? null;
    await fetchPage({
      pageIndex: page,
      cursorAfter,
      updateCursors: true,
    });
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete quiz? (Permanent)");
    if (!ok) return;

    await deleteQuiz(id);

    const cursorAfter = pageCursors[page - 1] ?? null;
    await fetchPage({
      pageIndex: page,
      cursorAfter,
      updateCursors: true,
    });
  };

  const toggleTopic = (topicId: string, checked: boolean) => {
    setForm((p) => ({
      ...p,
      topicIds: checked
        ? Array.from(new Set([...p.topicIds, topicId]))
        : p.topicIds.filter((x) => x !== topicId),
    }));
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {!showForm ? (
        <section className="card" style={{ marginTop: 24 }}>
          <div className="spaceBetween">
            <div>
              <div className="cardTitle" style={{ margin: 0 }}>
                Quizzes
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Total:{" "}
                <b style={{ color: "var(--text)" }}>
                  {totalQuizzes !== null ? totalQuizzes : "..."}
                </b>{" "}
                • Showing page {page}
              </div>
            </div>

            <div className="row">
              <button className="btn" onClick={startCreate}>
                + New
              </button>
            </div>
          </div>

          <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
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
            {visible.map((qz) => (
              <div
                key={qz.id}
                className="item"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 16,
                }}
              >
                <div
                  className="spaceBetween"
                  style={{
                    width: "100%",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div
                      className="itemName"
                      style={{ fontSize: 18, lineHeight: 1.4 }}
                    >
                      {qz.name}
                    </div>

                    <div className="row" style={{ marginTop: 10, gap: 8 }}>
                      <span className="badge">{qz.mode ?? "study"}</span>
                      <span
                        className="badge"
                        style={{
                          color: "var(--link)",
                          borderColor: "rgba(96,165,250,0.3)",
                        }}
                      >
                        {qz.questionCount ?? 20} questions
                      </span>
                      <span
                        className="badge"
                        style={{
                          color: "var(--link)",
                          borderColor: "rgba(96,165,250,0.3)",
                        }}
                      >
                        {qz.perQuestionTimeSec ?? 45}s / question
                      </span>
                      <span
                        className="badge"
                        style={{
                          color: qz.isActive ? "#4ade80" : "#94a3b8",
                          borderColor: qz.isActive
                            ? "rgba(74,222,128,0.2)"
                            : "var(--border)",
                          background: qz.isActive
                            ? "rgba(74,222,128,0.05)"
                            : "transparent",
                        }}
                      >
                        {qz.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="row" style={{ flexShrink: 0 }}>
                    <button
                      className="btn"
                      onClick={() => startEdit(qz)}
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        updateQuiz(qz.id, { isActive: !qz.isActive })
                      }
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      {qz.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="btn"
                      onClick={() => remove(qz.id)}
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div
                  className="grid"
                  style={{
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 10,
                    marginTop: 0,
                  }}
                >
                  {(qz.topicIds ?? []).map((topicId) => (
                    <div
                      key={topicId}
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontSize: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                        color: "var(--muted)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          minWidth: 24,
                          height: 24,
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 700,
                          background: "rgba(255,255,255,0.05)",
                          color: "var(--text)",
                          padding: "0 8px",
                        }}
                      >
                        T
                      </div>
                      <span>{topicName(topicId)}</span>
                    </div>
                  ))}

                  {(!qz.topicIds || qz.topicIds.length === 0) && (
                    <div
                      style={{
                        padding: "10px 14px",
                        borderRadius: 10,
                        fontSize: 14,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.02)",
                        color: "var(--muted)",
                      }}
                    >
                      No topics assigned.
                    </div>
                  )}
                </div>
              </div>
            ))}

            {!loading && visible.length === 0 && (
              <div
                className="item"
                style={{ justifyContent: "center", padding: 32 }}
              >
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
              {editingId ? "Edit Quiz" : "Create Quiz"}
            </div>
            <button className="btn btnGhost" onClick={closeForm}>
              ✕ Close
            </button>
          </div>

          <div className="list" style={{ marginTop: 12 }}>
            <label className="list">
              <span className="muted" style={{ fontSize: 12 }}>
                Name
              </span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. AWS Mixed Exam 40Q"
              />
            </label>

            <div className="list">
              <div className="spaceBetween">
                <span className="muted" style={{ fontSize: 12 }}>
                  Topics
                </span>
                <span className="muted" style={{ fontSize: 12 }}>
                  Selected: {form.topicIds.length}
                </span>
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
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
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${checked ? "var(--primary)" : "var(--border)"}`,
                        background: checked
                          ? "rgba(59, 130, 246, 0.08)"
                          : "rgba(255,255,255,0.02)",
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

            <div className="row" style={{ marginTop: 20 }}>
              <button className="btn" onClick={closeForm}>
                Cancel
              </button>
              <button className="btn btnPrimary" onClick={save}>
                {editingId ? "Save changes" : "Create Quiz"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
