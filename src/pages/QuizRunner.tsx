import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { auth, db } from "../firebase";

// Local types
export type Quiz = {
  id: string;
  name: string;
  topicIds: string[];
  mode: "study" | "exam";
  questionCount: number;
  perQuestionTimeSec?: number; // default 45
  isActive?: boolean;
};

export type Question = {
  id: string;
  topicId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty?: "easy" | "medium" | "hard";
  isActive?: boolean;
  rand?: number;
};

function fmt(sec: number) {
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function QuizRunner() {
  const { quizId } = useParams();
  const nav = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(45);

  const tickRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const perQ = quiz?.perQuestionTimeSec ?? 45;

  // Load quiz + questions from Firestore
  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        if (!quizId) throw new Error("Missing quizId");

        const quizSnap = await getDoc(doc(db, "quizzes", quizId));
        if (!quizSnap.exists()) throw new Error("Quiz not found");

        const quizData = quizSnap.data() as DocumentData;

        const qz: Quiz = {
          id: quizSnap.id,
          name: String(quizData.name ?? ""),
          topicIds: Array.isArray(quizData.topicIds) ? quizData.topicIds : [],
          mode: (quizData.mode as "study" | "exam") ?? "study",
          questionCount: Number(quizData.questionCount ?? 20),
          perQuestionTimeSec: Number(quizData.perQuestionTimeSec ?? 45),
          isActive: Boolean(quizData.isActive ?? true),
        };

        if (!qz.topicIds.length)
          throw new Error("Quiz has no topics configured");
        if (!qz.isActive) throw new Error("Quiz is disabled");

        // Firestore `in` supports up to 10 values
        const topicChunks = chunk(qz.topicIds, 10);

        const want = Math.max(1, qz.questionCount);
        const perChunkLimit = Math.max(
          want,
          Math.ceil(want / topicChunks.length),
        );

        const snaps = await Promise.all(
          topicChunks.map((ids) => {
            const qy = query(
              collection(db, "questions"),
              where("isActive", "==", true),
              where("topicId", "in", ids),
              orderBy("rand", "asc"),
              limit(perChunkLimit),
            );
            return getDocs(qy);
          }),
        );

        const merged: Question[] = [];
        for (const s of snaps) {
          for (const d of s.docs) {
            const data = d.data() as Omit<Question, "id">;
            merged.push({ id: d.id, ...data });
          }
        }

        function shuffleQuestionOptions(q: Question): Question {
          const withMeta = q.options.map((opt, idx) => ({
            text: opt,
            isCorrect: idx === q.correctIndex,
          }));

          const shuffled = shuffle(withMeta);

          const newOptions = shuffled.map((o) => o.text);
          const newCorrectIndex = shuffled.findIndex((o) => o.isCorrect);

          return {
            ...q,
            options: newOptions,
            correctIndex: newCorrectIndex,
          };
        }

        const finalQs = shuffle(merged)
          .slice(0, want)
          .map(shuffleQuestionOptions);
        if (!finalQs.length)
          throw new Error("No active questions found for this quiz");

        if (cancelled) return;
        
        setQuiz(qz);
        setQuestions(finalQs);

        // reset run state
        setIdx(0);
        setAnswers({});
        setShowExplanation(false);
        setTimeLeft(qz.perQuestionTimeSec ?? 45);

        // Date.now only here
        startedAtRef.current = Date.now();

        setLoading(false);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) {
          setErr(msg);
          setLoading(false);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [quizId]);

  const current = questions[idx];
  const selected = current ? answers[current.id] : undefined;

  // Timer tick
  useEffect(() => {
    if (!quiz) return;
    if (!questions.length) return;

    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;

    if (showExplanation) return;

    tickRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          setShowExplanation(true);
          if (tickRef.current) window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [quiz, questions.length, idx, showExplanation]);

  const goTo = (nextIdx: number) => {
    setIdx(nextIdx);
    setShowExplanation(false);
    setTimeLeft(perQ);
  };

  const select = (optIndex: number) => {
    if (!current) return;
    if (showExplanation) return;

    setAnswers((prev) => ({ ...prev, [current.id]: optIndex }));
    setShowExplanation(true);

    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  const finish = async () => {
    if (finishing) return;

    const u = auth.currentUser;
    if (!u) {
      nav("/login");
      return;
    }

    setFinishing(true);
    try {
      const startedAt = startedAtRef.current;
      const usedSec = startedAt
        ? Math.ceil((Date.now() - startedAt) / 1000)
        : 0;

      // Guarda SOLO lo necesario para resultados + review (reduce tamaño)
      const questionsForRun = questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        topicId: q.topicId, // útil para weak review
      }));

      const runPayload = {
        quizId: quizId ?? null,
        createdAt: serverTimestamp(),
        finishedAt: serverTimestamp(),
        usedSec,
        perQuestionTimeSec: perQ,
        questions: questionsForRun,
        answers,
      };

      const runsCol = collection(db, "users", u.uid, "runs");
      const runRef = await addDoc(runsCol, runPayload);

      nav(`/result/${runRef.id}`);
    } finally {
      setFinishing(false);
    }
  };

  const next = () => {
    if (idx < questions.length - 1) goTo(idx + 1);
    else void finish();
  };

  const progressPct = useMemo(() => {
    if (!questions.length) return 0;
    return ((idx + 1) / questions.length) * 100;
  }, [idx, questions.length]);

  const isCorrect =
    current && selected != null ? selected === current.correctIndex : false;

  if (loading) {
    return (
      <div className="page">
        <div className="container">
          <section className="card">
            <div style={{ fontWeight: 900, fontSize: 18 }}>Loading quiz…</div>
            <div className="muted" style={{ marginTop: 8 }}>
              Fetching config + questions from Firestore.
            </div>
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
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              Cannot start quiz
            </div>
            <div className="muted" style={{ marginTop: 8 }}>
              {err}
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <Link className="btn" to="/">
                Go Home
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (!quiz || !current) {
    return (
      <div className="page">
        <div className="container">
          <section className="card">
            <div style={{ fontWeight: 900, fontSize: 18 }}>No questions</div>
            <div className="muted" style={{ marginTop: 8 }}>
              This quiz doesn’t have questions available.
            </div>
            <div className="row" style={{ marginTop: 14 }}>
              <Link className="btn" to="/">
                Go Home
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
              {quiz.name || "Quiz"}
            </div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {idx + 1} / {questions.length}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Time left
            </div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{fmt(timeLeft)}</div>
          </div>
        </div>

        <div className="progressBar">
          <div className="progressFill" style={{ width: `${progressPct}%` }} />
        </div>

        <div
          className="spaceBetween muted"
          style={{ marginTop: 12, fontSize: 13 }}
        >
          <div>
            Answered <b>{Object.keys(answers).length}</b> / {questions.length}
          </div>
          <div>{perQ}s per question</div>
        </div>

        <section className="card" style={{ marginTop: 16 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Prompt
          </div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{current.prompt}</div>

          <div className="list" style={{ marginTop: 14 }}>
            {current.options.map((opt, i) => {
              const isSel = selected === i;
              const isRight = i === current.correctIndex;

              return (
                <button
                  key={i}
                  onClick={() => select(i)}
                  className={`option ${!showExplanation && isSel ? "optionSelected" : ""}`}
                  disabled={showExplanation}
                >
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <span className="kbd">{String.fromCharCode(65 + i)}</span>
                    <span>{opt}</span>
                    {showExplanation && isRight && <span>✅</span>}
                    {showExplanation && isSel && !isRight && <span>❌</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {showExplanation && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                background:
                  selected == null
                    ? "#fff7ed"
                    : isCorrect
                      ? "#f0fdf4"
                      : "#fef2f2",
                border: `1px solid ${
                  selected == null
                    ? "#fed7aa"
                    : isCorrect
                      ? "#bbf7d0"
                      : "#fecaca"
                }`,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {selected == null
                  ? "Time’s up"
                  : isCorrect
                    ? "Correct"
                    : "Incorrect"}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {current.explanation}
              </div>

              <div style={{ marginTop: 14 }}>
                <button
                  className="btn btnPrimary"
                  onClick={next}
                  disabled={finishing}
                >
                  {idx < questions.length - 1
                    ? "Continue →"
                    : finishing
                      ? "Saving…"
                      : "Finish Quiz"}
                </button>
              </div>
            </div>
          )}
        </section>

        <div
          className="row"
          style={{ marginTop: 16, justifyContent: "space-between" }}
        >
          <Link className="btn btnGhost" to="/">
            Exit
          </Link>
          <button
            className="btn"
            onClick={() => void finish()}
            disabled={finishing}
          >
            {finishing ? "Saving…" : "Finish now"}
          </button>
        </div>
      </div>
    </div>
  );
}
