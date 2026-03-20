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
import { createTopic, deleteTopic, updateTopic } from "../data/firestoreRepo";
import type { Topic } from "../data/firestoreRepo";

type FormState = {
  name: string;
  order: number;
  isActive: boolean;
};

const emptyForm: FormState = { name: "", order: 1, isActive: true };
const PAGE_SIZE = 10;

export default function TopicsPage() {
  const [rows, setRows] = useState<Topic[]>([]);
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
  const [totalTopics, setTotalTopics] = useState<number | null>(null);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;

    return rows.filter((t) => {
      const hay = [t.name ?? "", String(t.order ?? "")]
        .join("\n")
        .toLowerCase();

      return hay.includes(s);
    });
  }, [rows, search]);

  const buildQuery = (
    cursorAfter: QueryDocumentSnapshot<DocumentData> | null,
  ) => {
    const base = collection(db, "topics");

    return cursorAfter
      ? query(
          base,
          orderBy("order", "asc"),
          startAfter(cursorAfter),
          limit(PAGE_SIZE + 1),
        )
      : query(base, orderBy("order", "asc"), limit(PAGE_SIZE + 1));
  };

  async function fetchPage(opts: {
    pageIndex: number;
    cursorAfter: QueryDocumentSnapshot<DocumentData> | null;
    updateCursors?: boolean;
  }) {
    setLoading(true);

    try {
      if (opts.pageIndex === 1 || totalTopics === null) {
        getCountFromServer(collection(db, "topics"))
          .then((snap) => setTotalTopics(snap.data().count))
          .catch(() => {});
      }

      const snap = await getDocs(buildQuery(opts.cursorAfter));

      const pageDocs = snap.docs.slice(0, PAGE_SIZE);
      const items = pageDocs.map((d) => {
        const data = d.data() as Omit<Topic, "id">;
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
      alert("Failed to fetch topics: " + err.message);
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
    const nextOrder = Math.max(1, (rows.at(-1)?.order ?? 0) + 1);
    setForm({ ...emptyForm, order: nextOrder });
    setShowForm(true);
  };

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setForm({
      name: t.name ?? "",
      order: t.order ?? 1,
      isActive: t.isActive ?? true,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const save = async () => {
    if (!form.name.trim()) return alert("Topic name required");

    const payload = { ...form, name: form.name.trim() };

    if (editingId) await updateTopic(editingId, payload);
    else await createTopic(payload);

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
    const ok = confirm("Delete topic? (Permanent)");
    if (!ok) return;

    await deleteTopic(id);

    const cursorAfter = pageCursors[page - 1] ?? null;
    await fetchPage({
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
              <div className="cardTitle" style={{ margin: 0 }}>
                Topics
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Total:{" "}
                <b style={{ color: "var(--text)" }}>
                  {totalTopics !== null ? totalTopics : "..."}
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
            {visible.map((t) => (
              <div
                key={t.id}
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
                      {t.name}
                    </div>

                    <div className="row" style={{ marginTop: 10, gap: 8 }}>
                      <span
                        className="badge"
                        style={{
                          color: "var(--link)",
                          borderColor: "rgba(96,165,250,0.3)",
                        }}
                      >
                        Order {t.order ?? "-"}
                      </span>
                      <span
                        className="badge"
                        style={{
                          color: t.isActive ? "#4ade80" : "#94a3b8",
                          borderColor: t.isActive
                            ? "rgba(74,222,128,0.2)"
                            : "var(--border)",
                          background: t.isActive
                            ? "rgba(74,222,128,0.05)"
                            : "transparent",
                        }}
                      >
                        {t.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>

                  <div className="row" style={{ flexShrink: 0 }}>
                    <button
                      className="btn"
                      onClick={() => startEdit(t)}
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      onClick={() => updateTopic(t.id, { isActive: !t.isActive })}
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      {t.isActive ? "Disable" : "Enable"}
                    </button>
                    <button
                      className="btn"
                      onClick={() => remove(t.id)}
                      style={{ padding: "6px 12px", fontSize: 13 }}
                    >
                      Delete
                    </button>
                  </div>
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
              {editingId ? "Edit Topic" : "Create Topic"}
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
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. AWS, Java, Networking"
              />
            </label>

            <label className="list">
              <span className="muted" style={{ fontSize: 12 }}>
                Order
              </span>
              <input
                type="number"
                value={form.order}
                onChange={(e) =>
                  setForm((p) => ({ ...p, order: Number(e.target.value) }))
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
                {editingId ? "Save changes" : "Create Topic"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
