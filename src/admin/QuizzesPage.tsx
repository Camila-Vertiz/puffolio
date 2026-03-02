import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import type { Quiz, Topic } from "../data/firestoreRepo";
import { createQuiz, deleteQuiz, updateQuiz } from "../data/firestoreRepo";

type FormState = {
  name: string;
  topicIds: string[]; // multi-topic
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

export default function QuizzesPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  // load topics
  useEffect(() => {
    const qy = query(collection(db, "topics"), orderBy("order", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as Omit<Topic, "id">;
        return { id: d.id, ...data };
      });
      setTopics(rows);
    });
    return () => unsub();
  }, []);

  // load quizzes
  useEffect(() => {
    const qy = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(qy, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as Omit<Quiz, "id">;
        return { id: d.id, ...data };
      });
      setQuizzes(rows);
    });
    return () => unsub();
  }, []);

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.name ?? "—";
  const topicNames = (ids: string[]) => (ids ?? []).map(topicName).join(", ");

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

    if (editingId) {
      await updateQuiz(editingId, payload);
    } else {
      await createQuiz(payload);
    }

    setEditingId(null);
    setForm(emptyForm);
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete quiz? (Permanent)");
    if (!ok) return;
    await deleteQuiz(id);
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
      {/* LIST */}
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Quizzes</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Quiz configs (multi-topic + per-question timer)
            </div>
          </div>
          <button className="btn" onClick={startCreate}>
            + New
          </button>
        </div>

        <div className="list" style={{ marginTop: 12 }}>
          {quizzes.map((qz) => (
            <div key={qz.id} className="item">
              <div className="itemLeft">
                <div className="itemName">{qz.name}</div>
                <div className="itemMeta">
                  {topicNames(qz.topicIds ?? []) || "—"} • {qz.mode} •{" "}
                  {qz.questionCount}Q • {qz.perQuestionTimeSec ?? 45}s/Q •{" "}
                  {qz.isActive ? "active" : "inactive"}
                </div>
              </div>
              <div className="row">
                <button className="btn" onClick={() => startEdit(qz)}>
                  Edit
                </button>
                <button
                  className="btn"
                  onClick={() => updateQuiz(qz.id, { isActive: !qz.isActive })}
                >
                  {qz.isActive ? "Disable" : "Enable"}
                </button>
                <button className="btn" onClick={() => remove(qz.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
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
