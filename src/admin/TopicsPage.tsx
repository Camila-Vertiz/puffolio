import { useEffect, useMemo, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
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
const PAGE_SIZE = 25;

export default function TopicsPage() {
  const [rows, setRows] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((t) => t.name.toLowerCase().includes(s));
  }, [rows, search]);

  async function loadFirstPage() {
    setLoading(true);

    const qy = query(
      collection(db, "topics"),
      orderBy("order", "asc"),
      limit(PAGE_SIZE),
    );

    const snap = await getDocs(qy);

    const items = snap.docs.map((d) => {
      const data = d.data() as Omit<Topic, "id">;
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

    const qy = query(
      collection(db, "topics"),
      orderBy("order", "asc"),
      startAfter(cursor),
      limit(PAGE_SIZE),
    );

    const snap = await getDocs(qy);

    const items = snap.docs.map((d) => {
      const data = d.data() as Omit<Topic, "id">;
      return { id: d.id, ...data };
    });

    setRows((prev) => [...prev, ...items]);

    const last = snap.docs.at(-1) ?? null;
    setCursor(last);
    setHasMore(snap.docs.length === PAGE_SIZE);

    setLoading(false);
  }

  useEffect(() => {
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      order: Math.max(1, (rows.at(-1)?.order ?? 0) + 1),
    });
  };

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      order: t.order ?? 1,
      isActive: t.isActive ?? true,
    });
  };

  const save = async () => {
    if (!form.name.trim()) return alert("Topic name required");

    if (editingId) {
      await updateTopic(editingId, { ...form, name: form.name.trim() });
    } else {
      await createTopic({ ...form, name: form.name.trim() });
    }

    setEditingId(null);
    setForm(emptyForm);

    // Refresh list so table stays consistent
    await loadFirstPage();
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete topic? (Permanent)");
    if (!ok) return;
    await deleteTopic(id);
    await loadFirstPage();
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
              Paged table + search filter
            </div>
          </div>

          <div className="row">
            <button className="btn" onClick={startCreate}>
              + New
            </button>
          </div>
        </div>

        {/* Search + paging controls */}
        <div className="row" style={{ marginTop: 12, alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search topic name…"
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

          <button
            className="btn"
            onClick={loadMore}
            disabled={loading || !hasMore}
            title={!hasMore ? "No more rows" : "Load next page"}
          >
            {hasMore ? "Load more" : "No more"}
          </button>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Showing <b>{visible.length}</b> of <b>{rows.length}</b> loaded{" "}
          {hasMore ? `(more available)` : `(all loaded)`}.
        </div>

        {/* Table wrapper with horizontal scroll */}
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
                    {/* <div className="muted" style={{ fontSize: 12 }}>
                      id: {t.id}
                    </div> */}
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
