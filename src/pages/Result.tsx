import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type RunDoc = {
  quizId?: string | null;
  questions: Question[];
  answers: Record<string, number>;
  usedSec: number;
  perQuestionTimeSec?: number;
};

function mins(sec: number) {
  return Math.max(0, Math.ceil(sec / 60));
}

export default function Result() {
  const { runId } = useParams<{ runId: string }>();

  const [run, setRun] = useState<RunDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const u = auth.currentUser;
      if (!u || !runId) {
        setRun(null);
        setLoading(false);
        return;
      }

      const ref = doc(db, "users", u.uid, "runs", runId);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setRun(null);
        setLoading(false);
        return;
      }

      setRun(snap.data() as RunDoc);
      setLoading(false);
    };

    load();
  }, [runId]);

  const computed = useMemo(() => {
    if (!run) return null;

    const { questions, answers } = run;
    let correct = 0;
    const wrongIds: string[] = [];

    for (const q of questions) {
      const a = answers[q.id];
      if (a === q.correctIndex) correct++;
      else wrongIds.push(q.id);
    }

    const scorePct = Math.round((correct / questions.length) * 100);
    return { correct, wrongIds, scorePct };
  }, [run]);

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <section className="card">
            <div className="muted">Loading result…</div>
          </section>
        </div>
      </div>
    );
  }

  if (!run || !computed) {
    return (
      <div className="page">
        <div className="container">
          <section className="card">
            <div style={{ fontWeight: 900, fontSize: 18 }}>No result data</div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Run not found (maybe deleted) or you opened this link while logged
              out.
            </p>
            <div className="row" style={{ marginTop: 12 }}>
              <Link className="btn" to="/">
                Go Home
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const { questions, answers, usedSec, perQuestionTimeSec } = run;
  const { correct, wrongIds, scorePct } = computed;

  // totalTimeSec: por pregunta (configurable) * cantidad
  const totalTimeSec = (perQuestionTimeSec ?? 45) * questions.length;

  return (
    <div className="page">
      <div className="container">
        <div className="spaceBetween">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Results
            </div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>{scorePct}%</div>
            <div className="muted" style={{ fontSize: 13 }}>
              {correct}/{questions.length} correct
            </div>
          </div>

          <div className="row">
            <Link className="btn" to="/">
              Home
            </Link>
            <Link className="btn" to="/review">
              Review weak
            </Link>
          </div>
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: "1fr", marginTop: 16 }}
        >
          <section className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Time used
                </div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {mins(usedSec)} min
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  of {mins(totalTimeSec)} min
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Wrong questions
                </div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {wrongIds.length}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Save for review
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="list" style={{ marginTop: 16 }}>
          {questions.map((q, i) => {
            const a = answers[q.id];
            const ok = a === q.correctIndex;

            return (
              <section key={q.id} className="card">
                <div className="spaceBetween">
                  <div style={{ fontWeight: 900 }}>
                    {i + 1}. {q.prompt}
                  </div>
                  <span
                    className="badge"
                    style={{
                      color: ok ? "#166534" : "#b91c1c",
                      borderColor: ok ? "#bbf7d0" : "#fecaca",
                    }}
                  >
                    {ok ? "Correct" : "Wrong"}
                  </span>
                </div>

                <div className="list" style={{ marginTop: 12 }}>
                  {q.options.map((opt, idx) => {
                    const isCorrect = idx === q.correctIndex;
                    const isChosen = idx === a;

                    const bg = isCorrect
                      ? "#f0fdf4"
                      : isChosen && !isCorrect
                        ? "#fef2f2"
                        : "#fff";
                    const border = isCorrect
                      ? "#bbf7d0"
                      : isChosen && !isCorrect
                        ? "#fecaca"
                        : "var(--border)";

                    return (
                      <div
                        key={idx}
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          border: `1px solid ${border}`,
                          background: bg,
                        }}
                      >
                        <span className="kbd">
                          {String.fromCharCode(65 + idx)}
                        </span>{" "}
                        <span style={{ marginLeft: 8 }}>{opt}</span>
                        {isCorrect ? " ✅" : ""}
                        {isChosen && !isCorrect ? " ❌" : ""}
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{ marginTop: 12, fontSize: 14, color: "var(--muted)" }}
                >
                  <b style={{ color: "var(--text)" }}>Explanation:</b>{" "}
                  {q.explanation}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
