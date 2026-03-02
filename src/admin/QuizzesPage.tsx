import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import {
  createQuiz,
  deleteQuiz,
  updateQuiz,
} from "../data/firestoreRepo";
import type { Topic } from "../data/firestoreRepo";
import type { Quiz } from "../data/firestoreRepo";
type FormState = {
  name: string;
  topicId: string;
  mode: "study" | "exam";
  questionCount: number;
  perQuestionTimeSec: number;
  isActive: boolean;
};

const emptyForm: FormState = {
  name: "",
  topicId: "",
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

  useEffect(() => {
    const qy = query(collection(db, "topics"), orderBy("order", "asc"));
    return onSnapshot(qy, (snap) =>
      setTopics(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Topic[],
      ),
    );
  }, []);

  useEffect(() => {
    const qy = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    return onSnapshot(qy, (snap) =>
      setQuizzes(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Quiz[],
      ),
    );
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, topicId: topics[0]?.id ?? "" });
  };

  const startEdit = (qz: Quiz) => {
    setEditingId(qz.id);
    setForm({
      name: qz.name,
      topicId: qz.topicId,
      mode: qz.mode,
      questionCount: qz.questionCount,
      perQuestionTimeSec: qz.perQuestionTimeSec ?? 45,
      isActive: qz.isActive ?? true,
    });
  };

  const save = async () => {
    if (!form.name.trim()) return alert("Quiz name required");
    if (!form.topicId) return alert("Select a topic");
    if (form.questionCount <= 0) return alert("questionCount must be > 0");
    if (form.perQuestionTimeSec <= 0)
      return alert("perQuestionTimeSec must be > 0");

    if (editingId) {
      await updateQuiz(editingId, { ...form });
    } else {
      await createQuiz({ ...form });
    }

    setEditingId(null);
    setForm(emptyForm);
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete quiz? (Permanent)");
    if (!ok) return;
    await deleteQuiz(id);
  };

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Quizzes</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Quiz configs (mode, count, total timer)
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
                  {topicName(qz.topicId)} • {qz.mode} • {qz.questionCount}Q •{" "}
                  {qz.perQuestionTimeSec ?? 45}s/question •{" "}
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
              placeholder="e.g. AWS Basics - 40Q"
            />
          </label>

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

          <div className="row">
            <label className="list" style={{ flex: 1 }}>
              <span className="muted" style={{ fontSize: 12 }}>
                Mode
              </span>
              <select
                value={form.mode}
                onChange={(e) =>
                  setForm((p) => ({ ...p, mode: e.target.value as any }))
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
