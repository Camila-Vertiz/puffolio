import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import type { Question, QuizRun } from "../data/models";
import { getLatestQuizRun, getQuestionsByIds } from "../data/firestoreRepo";

export default function Review() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [run, setRun] = useState<QuizRun | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  useEffect(() => {
    const load = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;

      setLoading(true);

      const latest = await getLatestQuizRun(uid);
      setRun(latest);

      if (!latest || !latest.wrongQuestionIds.length) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      const qs = await getQuestionsByIds(latest.wrongQuestionIds);
      setQuestions(qs);
      setLoading(false);
    };

    load().catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, []);

  const retakeWrong = () => {
    // simplest: reuse quiz runner by starting the same quiz again
    // and you can later implement a special "review mode" if you want.
    if (!run) return;
    nav(`/quiz/${run.quizId}`);
  };

  return (
    <div className="page">
      <div className="container">
        <div className="spaceBetween">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Review
            </div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>Weak questions</div>
          </div>
          <div className="row">
            <Link className="btn" to="/">
              Home
            </Link>
            {run?.quizId && (
              <button className="btn btnPrimary" onClick={retakeWrong}>
                Retake quiz
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Loading…
          </div>
        ) : !run ? (
          <section className="card" style={{ marginTop: 16 }}>
            <div className="muted">No quiz runs yet. Take a quiz first.</div>
          </section>
        ) : run.wrongQuestionIds.length === 0 ? (
          <section className="card" style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 900 }}>Nice.</div>
            <div className="muted" style={{ marginTop: 6 }}>
              No wrong questions in your latest run.
            </div>
          </section>
        ) : (
          <div className="list" style={{ marginTop: 16 }}>
            {questions.map((q, i) => (
              <section key={q.id} className="card">
                <div style={{ fontWeight: 900 }}>
                  {i + 1}. {q.prompt}
                </div>
                <div className="list" style={{ marginTop: 12 }}>
                  {q.options.map((opt, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: `1px solid ${idx === q.correctIndex ? "#bbf7d0" : "var(--border)"}`,
                        background: idx === q.correctIndex ? "#f0fdf4" : "#fff",
                      }}
                    >
                      <span className="kbd">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span style={{ marginLeft: 8 }}>{opt}</span>
                    </div>
                  ))}
                </div>
                <div
                  style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}
                >
                  <b style={{ color: "var(--text)" }}>Explanation:</b>{" "}
                  {q.explanation}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
