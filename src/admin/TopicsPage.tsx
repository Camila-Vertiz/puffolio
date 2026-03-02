import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { createTopic, deleteTopic, updateTopic } from "../data/firestoreRepo";
import type { Topic } from "../data/firestoreRepo";

type FormState = {
  name: string;
  order: number;
  isActive: boolean;
};

const emptyForm: FormState = { name: "", order: 1, isActive: true };

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    const qy = query(collection(db, "topics"), orderBy("order", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      })) as Topic[];
      setTopics(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      order: Math.max(1, (topics.at(-1)?.order ?? 0) + 1),
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
      await updateTopic(editingId, { ...form });
    } else {
      await createTopic({ ...form });
    }
    setEditingId(null);
    setForm(emptyForm);
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete topic? (This removes it permanently)");
    if (!ok) return;
    await deleteTopic(id);
  };

  const formTitle = editingId ? "Edit Topic" : "Create Topic";

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Topics</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Create and manage quiz topics
            </div>
          </div>
          <button className="btn" onClick={startCreate}>
            + New
          </button>
        </div>

        {loading ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : (
          <div className="list" style={{ marginTop: 12 }}>
            {topics.map((t) => (
              <div key={t.id} className="item">
                <div className="itemLeft">
                  <div className="itemName">{t.name}</div>
                  <div className="itemMeta">
                    order: {t.order ?? "-"} •{" "}
                    {t.isActive ? "active" : "inactive"}
                  </div>
                </div>

                <div className="row">
                  <button className="btn" onClick={() => startEdit(t)}>
                    Edit
                  </button>
                  <button
                    className="btn"
                    onClick={() => updateTopic(t.id, { isActive: !t.isActive })}
                  >
                    {t.isActive ? "Disable" : "Enable"}
                  </button>
                  <button className="btn" onClick={() => remove(t.id)}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div style={{ fontWeight: 900 }}>{formTitle}</div>

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
              onChange={(e) =>
                setForm((p) => ({ ...p, isActive: e.target.checked }))
              }
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
