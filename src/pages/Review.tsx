import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  limit,
} from "firebase/firestore";
import { auth, db } from "../firebase";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type RunDoc = {
  quizId?: string;
  quizName?: string; // opcional si lo guardas
  createdAt?: any;
  finishedAt?: any;
  usedSec: number;
  perQuestionTimeSec: number;
  questions: Question[];
  answers: Record<string, number>;
};

type QuizDoc = {
  name?: string;
};

function tsToDate(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "number") return new Date(v);
  return null;
}

function fmtDate(v: any) {
  const d = tsToDate(v);
  if (!d) return "—";
  return d.toLocaleString();
}

export default function Review() {
  const { runId } = useParams<{ runId?: string }>();
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // list mode
  const [runs, setRuns] = useState<Array<{ id: string; data: RunDoc }>>([]);
  const [quizNames, setQuizNames] = useState<Record<string, string>>({});

  // detail mode
  const [run, setRun] = useState<RunDoc | null>(null);

  // ---------- Load list of runs ----------
  useEffect(() => {
    let cancelled = false;

    async function loadRuns() {
      try {
        setErr(null);
        setLoading(true);

        const u = auth.currentUser;
        if (!u) {
          setRuns([]);
          setLoading(false);
          return;
        }

        // If we are on /review/:runId, don't load list here
        if (runId) {
          setLoading(false);
          return;
        }

        const qy = query(
          collection(db, "users", u.uid, "runs"),
          orderBy("createdAt", "desc"),
          limit(50),
        );

        const snap = await getDocs(qy);

        const items = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as RunDoc,
        }));

        if (cancelled) return;

        setRuns(items);

        // Fetch quiz names (if run doesn't already have quizName)
        const ids = Array.from(
          new Set(
            items
              .map((x) => x.data.quizId)
              .filter((x): x is string => Boolean(x)),
          ),
        );

        const missing = ids.filter((id) => !quizNames[id]);
        if (missing.length) {
          const pairs = await Promise.all(
            missing.map(async (qid) => {
              try {
                const qs = await getDoc(doc(db, "quizzes", qid));
                const qd = qs.exists() ? (qs.data() as QuizDoc) : null;
                return [qid, qd?.name ?? "—"] as const;
              } catch {
                return [qid, "—"] as const;
              }
            }),
          );

          if (!cancelled) {
            setQuizNames((prev) => {
              const next = { ...prev };
              for (const [qid, name] of pairs) next[qid] = name;
              return next;
            });
          }
        }

        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Error loading runs");
        setLoading(false);
      }
    }

    loadRuns();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  // ---------- Load run detail ----------
  useEffect(() => {
    let cancelled = false;

    async function loadRunDetail() {
      try {
        setErr(null);
        setLoading(true);

        const u = auth.currentUser;
        if (!u || !runId) {
          setRun(null);
          setLoading(false);
          return;
        }

        const ref = doc(db, "users", u.uid, "runs", runId);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          if (!cancelled) {
            setRun(null);
            setLoading(false);
          }
          return;
        }

        const data = snap.data() as RunDoc;

        // ensure quiz name
        let qName = data.quizName;
        if (!qName && data.quizId) {
          try {
            const qs = await getDoc(doc(db, "quizzes", data.quizId));
            const qd = qs.exists() ? (qs.data() as QuizDoc) : null;
            qName = qd?.name ?? "—";
          } catch {
            qName = "—";
          }
        }

        if (cancelled) return;

        setRun({ ...data, quizName: qName });
        setLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;
        setErr(e instanceof Error ? e.message : "Error loading run");
        setLoading(false);
      }
    }

    loadRunDetail();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const weak = useMemo(() => {
    if (!run) return [];

    const out: Array<{
      q: Question;
      chosen: number | undefined;
      isCorrect: boolean;
    }> = [];

    for (const q of run.questions ?? []) {
      const chosen = run.answers?.[q.id];
      const isCorrect = chosen === q.correctIndex;
      if (!isCorrect) out.push({ q, chosen, isCorrect });
    }

    return out;
  }, [run]);

  // ---------- UI ----------
  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <section className="card">
            <div className="muted">Loading…</div>
          </section>
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="page">
        <div className="container">
          <section className="card">
            <div style={{ fontWeight: 900, fontSize: 18 }}>Review</div>
            <div className="muted" style={{ marginTop: 8 }}>
              {err}
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <Link className="btn" to="/">
                Home
              </Link>
              <Link className="btn" to="/review">
                Back to runs
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------- DETAIL PAGE: /review/:runId ----------
  if (runId) {
    if (!run) {
      return (
        <div className="page">
          <div className="container">
            <section className="card">
              <div style={{ fontWeight: 900, fontSize: 18 }}>No run data</div>
              <p className="muted" style={{ marginBottom: 0 }}>
                Run not found or you opened this link while logged out.
              </p>
              <div className="row" style={{ marginTop: 12 }}>
                <Link className="btn" to="/review">
                  Back
                </Link>
                <Link className="btn" to="/">
                  Home
                </Link>
              </div>
            </section>
          </div>
        </div>
      );
    }

    return (
      <div className="page">
        <div className="container">
          <div className="spaceBetween">
            <div>
              <div className="muted" style={{ fontSize: 12 }}>
                Weak Review
              </div>
              <div style={{ fontWeight: 900, fontSize: 22 }}>
                {run.quizName ?? "Quiz"} — wrong questions
              </div>
              <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                Finished: {fmtDate(run.finishedAt ?? run.createdAt)}
              </div>
            </div>

            <div className="row">
              <Link className="btn" to="/review">
                Back
              </Link>
              <Link className="btn" to="/">
                Home
              </Link>
            </div>
          </div>

          <section className="card" style={{ marginTop: 16 }}>
            <div className="spaceBetween">
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Wrong questions
                </div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {weak.length}
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Total questions
                </div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {run.questions?.length ?? 0}
                </div>
              </div>
            </div>
          </section>

          <div className="list" style={{ marginTop: 16 }}>
            {weak.map(({ q, chosen }, i) => (
              <section key={q.id} className="card">
                <div style={{ fontWeight: 900 }}>
                  {i + 1}. {q.prompt}
                </div>

                <div className="list" style={{ marginTop: 12 }}>
                  {q.options.map((opt, idx) => {
                    const isCorrect = idx === q.correctIndex;
                    const isChosen = idx === chosen;

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
                        </span>
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
            ))}

            {weak.length === 0 && (
              <section className="card">
                <div style={{ fontWeight: 900 }}>No weak questions 🎉</div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  You got everything correct in this run.
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- LIST PAGE: /review ----------
  return (
    <div className="page">
      <div className="container">
        <div className="spaceBetween">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Review
            </div>
            <div style={{ fontWeight: 900, fontSize: 22 }}>Your quiz runs</div>
          </div>

          <div className="row">
            <Link className="btn" to="/">
              Home
            </Link>
          </div>
        </div>

        {runs.length === 0 ? (
          <section className="card" style={{ marginTop: 16 }}>
            <div className="muted">No quiz runs yet. Take a quiz first.</div>
          </section>
        ) : (
          <section className="card" style={{ marginTop: 16 }}>
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                }}
              >
                <thead>
                  <tr>
                    <th style={thLeft}>Quiz</th>
                    <th style={thLeft}>Finished</th>
                    <th style={thLeft}>Questions</th>
                    <th style={thLeft}>Wrong</th>
                    <th style={thRight}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {runs.map((r) => {
                    const qName =
                      r.data.quizName ||
                      (r.data.quizId ? quizNames[r.data.quizId] : "") ||
                      "—";
                    const total = r.data.questions?.length ?? 0;
                    const wrong = (r.data.questions ?? []).reduce((acc, q) => {
                      const a = r.data.answers?.[q.id];
                      return acc + (a === q.correctIndex ? 0 : 1);
                    }, 0);

                    return (
                      <tr key={r.id}>
                        <td style={tdLeft}>
                          <div style={{ fontWeight: 900 }}>{qName}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            run: {r.id}
                          </div>
                        </td>

                        <td style={tdLeft}>
                          {fmtDate(r.data.finishedAt ?? r.data.createdAt)}
                        </td>

                        <td style={tdLeft}>{total}</td>

                        <td style={tdLeft}>
                          <span
                            className="badge"
                            style={{
                              color: wrong ? "#b91c1c" : "#166534",
                              borderColor: wrong ? "#fecaca" : "#bbf7d0",
                            }}
                          >
                            {wrong}
                          </span>
                        </td>

                        <td style={tdRight}>
                          <div
                            className="row"
                            style={{ justifyContent: "flex-end" }}
                          >
                            <button
                              className="btn btnPrimary"
                              onClick={() => nav(`/review/${r.id}`)}
                              disabled={total === 0}
                              title={
                                total === 0
                                  ? "No questions in this run"
                                  : "Open weak review"
                              }
                            >
                              Open
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
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
