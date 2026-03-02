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
import { createTopic, deleteTopic, updateTopic } from "../data/firestoreRepo";
import type { Topic } from "../data/firestoreRepo";

type FormState = {
  name: string;
  order: number;
  isActive: boolean;
};

const emptyForm: FormState = { name: "", order: 1, isActive: true };
const PAGE_SIZE = 2;

export default function TopicsPage() {
  // current page rows only (NOT growing)
  const [rows, setRows] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  // filters
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

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((t) => (t.name ?? "").toLowerCase().includes(s));
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
          limit(PAGE_SIZE + 1), // +1 to detect next page
        )
      : query(base, orderBy("order", "asc"), limit(PAGE_SIZE + 1));
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
      const data = d.data() as Omit<Topic, "id">;
      return { id: d.id, ...data };
    });

    setRows(items);

    const nextExists = snap.docs.length > PAGE_SIZE;
    setHasNext(nextExists);

    const nextCursor = pageDocs.at(-1) ?? null;

    if (opts.updateCursors) {
      setPageCursors((prev) => {
        const copy = prev.slice(0, opts.pageIndex); // keep up to current page
        copy[opts.pageIndex] = nextCursor; // store cursor for NEXT page
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

  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = () => {
    setEditingId(null);
    // keep it simple: default order = current max + 1 within current page
    const nextOrder = Math.max(1, (rows.at(-1)?.order ?? 0) + 1);
    setForm({ ...emptyForm, order: nextOrder });
  };

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setForm({
      name: t.name ?? "",
      order: t.order ?? 1,
      isActive: t.isActive ?? true,
    });
  };

  const save = async () => {
    if (!form.name.trim()) return alert("Topic name required");

    const payload = { ...form, name: form.name.trim() };

    if (editingId) await updateTopic(editingId, payload);
    else await createTopic(payload);

    setEditingId(null);
    setForm(emptyForm);

    // reload current page
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

  const formTitle = editingId ? "Edit Topic" : "Create Topic";

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      {/* TABLE */}
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Topics</div>
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
                <th style={thLeft}>Order</th>
                <th style={thLeft}>Status</th>
                <th style={thRight}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {visible.map((t) => (
                <tr key={t.id}>
                  <td style={tdLeft}>
                    <div style={{ fontWeight: 800 }}>{t.name}</div>
                  </td>

                  <td style={tdLeft}>{t.order ?? "-"}</td>

                  <td style={tdLeft}>
                    <span
                      className="badge"
                      style={{
                        color: t.isActive ? "#166534" : "#6b7280",
                        borderColor: t.isActive ? "#bbf7d0" : "var(--border)",
                      }}
                    >
                      {t.isActive ? "active" : "inactive"}
                    </span>
                  </td>

                  <td style={tdRight}>
                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="btn" onClick={() => startEdit(t)}>
                        Edit
                      </button>
                      <button
                        className="btn"
                        onClick={() =>
                          updateTopic(t.id, { isActive: !t.isActive })
                        }
                      >
                        {t.isActive ? "Disable" : "Enable"}
                      </button>
                      <button className="btn" onClick={() => remove(t.id)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && visible.length === 0 && (
                <tr>
                  <td style={{ ...tdLeft, padding: 16 }} colSpan={4}>
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
        <div style={{ fontWeight: 900 }}>{formTitle}</div>

        <div className="list" style={{ marginTop: 12 }}>
          <label className="list">
            <span className="muted" style={{ fontSize: 12 }}>
              Name
            </span>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
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
                setForm({ ...form, order: Number(e.target.value) })
              }
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            />
          </label>

          <label className="row" style={{ marginTop: 6 }}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            <span>Active</span>
          </label>

          <div className="row" style={{ marginTop: 8 }}>
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
