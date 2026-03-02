import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  createQuestion,
  deleteQuestion,
  updateQuestion,
} from "../data/firestoreRepo";
import type { Topic } from "../data/firestoreRepo";
import type { Question } from "../data/firestoreRepo";

type FormState = {
  topicId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
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

export default function QuestionsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterTopicId, setFilterTopicId] = useState<string>("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    const qy = query(collection(db, "topics"), orderBy("order", "asc"));
    return onSnapshot(qy, (snap) => {
      setTopics(
        snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Topic[],
      );
    });
  }, []);

  useEffect(() => {
    const base = collection(db, "questions");

    const qy = filterTopicId
      ? query(
          base,
          where("topicId", "==", filterTopicId),
          orderBy("createdAt", "desc"),
        )
      : query(base, orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      qy,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as Omit<Question, "id">; // ✅ no any
          return { id: d.id, ...data };
        });

        setQuestions(rows);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [filterTopicId]);

  const startCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      topicId: topics[0]?.id ?? "",
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
      difficulty: (q.difficulty as any) ?? "medium",
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

    if (editingId) {
      await updateQuestion(editingId, payload);
    } else {
      await createQuestion(payload);
    }

    setEditingId(null);
    setForm(emptyForm);
  };

  const remove = async (id: string) => {
    const ok = confirm("Delete question? (Permanent)");
    if (!ok) return;
    await deleteQuestion(id);
  };

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="grid" style={{ gridTemplateColumns: "1fr", gap: 16 }}>
      <section className="card">
        <div className="spaceBetween">
          <div>
            <div style={{ fontWeight: 900 }}>Questions</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Create and manage question bank
            </div>
          </div>

          <div className="row">
            <select
              value={filterTopicId}
              onChange={(e) => {
                setLoading(true); // ✅ move it here
                setFilterTopicId(e.target.value);
              }}
              style={{
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--border)",
              }}
            >
              <option value="">All topics</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="btn" onClick={startCreate}>
              + New
            </button>
          </div>
        </div>

        {loading ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : (
          <div className="list" style={{ marginTop: 12 }}>
            {questions.map((q) => (
              <div
                key={q.id}
                className="item"
                style={{ alignItems: "flex-start" }}
              >
                <div className="itemLeft" style={{ gap: 6 }}>
                  <div className="itemName">{q.prompt}</div>
                  <div className="itemMeta">
                    {topicName(q.topicId)} • {q.difficulty ?? "medium"} •{" "}
                    {q.isActive ? "active" : "inactive"}
                  </div>
                </div>

                <div className="row">
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
              </div>
            ))}
          </div>
        )}
      </section>

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
                  setForm((p) => ({ ...p, difficulty: e.target.value as any }))
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
