import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import type { Quiz, Topic } from "../data/models";

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tq = query(collection(db, "topics"), orderBy("order", "asc"));
    const unsubTopics = onSnapshot(tq, (snap) => {
      const rows = snap.docs.map((d) => {
        const data = d.data() as Omit<Topic, "id">;
        return { id: d.id, ...data };
      });
      setTopics(rows);
    });

    // If you are not 100% sure every quiz has createdAt, use orderBy("name") instead.
    const qq = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
    const unsubQuizzes = onSnapshot(
      qq,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data() as Omit<Quiz, "id">;
          return { id: d.id, ...data };
        });
        setQuizzes(rows);
        setLoading(false);
      },
      (err) => {
        console.error("Quizzes snapshot error:", err);
        setLoading(false);
      },
    );

    return () => {
      unsubTopics();
      unsubQuizzes();
    };
  }, []);

  const activeTopics = useMemo(
    () => topics.filter((t) => t.isActive !== false),
    [topics],
  );

  const activeQuizzes = useMemo(
    () => quizzes.filter((q) => q.isActive !== false),
    [quizzes],
  );

  const topicName = (id: string) =>
    topics.find((t) => t.id === id)?.name ?? "—";

  return (
    <div className="page">
      <div className="container">
        <div className="spaceBetween">
          <div>
            <div className="subtitle" style={{ margin: 0, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>
              Quizzes
            </div>
            <div className="h1">Start</div>
          </div>

          <div className="row">
            <Link className="btn" to="/review">
              Weak Review
            </Link>
            <Link className="btn" to="/admin">
              Admin
            </Link>
          </div>
        </div>

        {loading ? (
          <section className="card" style={{ marginTop: 16 }}>
            <div className="muted">Loading…</div>
          </section>
        ) : activeQuizzes.length === 0 ? (
          <section className="card" style={{ marginTop: 16 }}>
            <div className="muted">No active quizzes. Create one in Admin.</div>
          </section>
        ) : (
          <div className="grid">
            <section className="card">
              <div className="cardTitle">
                Available quizzes
              </div>
              <div className="list">
                {activeQuizzes.map((q) => (
                  <div key={q.id} className="item">
                    <div className="itemLeft">
                      <div className="itemName">{q.name}</div>
                      <div className="itemMeta">
                        {(q.topicIds ?? []).map(topicName).join(", ")} •{" "}
                        {q.mode} • {q.questionCount}Q •{" "}
                        {q.perQuestionTimeSec ?? 45}s/Q
                      </div>
                    </div>
                    <div className="row">
                      <Link className="btn btnPrimary" to={`/quiz/${q.id}`}>
                        Start
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="cardTitle">Topics</div>
              <div className="list">
                {activeTopics.map((t) => (
                  <div key={t.id} className="item">
                    <div className="itemLeft">
                      <div className="itemName">{t.name}</div>
                      <div className="itemMeta">order: {t.order ?? "-"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
