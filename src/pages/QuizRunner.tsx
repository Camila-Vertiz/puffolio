import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

const DUMMY_QUESTIONS: Question[] = [
  {
    id: "qq1",
    prompt: "What does IAM stand for in AWS?",
    options: [
      "Identity and Access Management",
      "Internal Access Module",
      "Instance Access Manager",
      "Identity Allocation Method",
    ],
    correctIndex: 0,
    explanation:
      "IAM = Identity and Access Management. It controls users, roles, and permissions.",
  },
  {
    id: "qq2",
    prompt: "Which HTTP status code indicates a server error?",
    options: ["200", "301", "403", "500"],
    correctIndex: 3,
    explanation:
      "5xx status codes represent server errors. 500 = Internal Server Error.",
  },
];

function fmt(sec: number) {
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export default function QuizRunner() {
  const { quizId } = useParams();
  const nav = useNavigate();

  // ✅ default 45s per question (later: load from quiz doc)
  const perQuestionTimeSec = 45;

  const questions = useMemo(() => DUMMY_QUESTIONS, []);
  const [idx, setIdx] = useState(0);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(perQuestionTimeSec);

  const startedAtRef = useRef<number>(Date.now());
  const current = questions[idx];
  const selected = answers[current.id];

  // Reset per-question timer when question changes
  useEffect(() => {
    setTimeLeft(perQuestionTimeSec);
    setShowExplanation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, perQuestionTimeSec]);

  // Timer tick (stops when explanation is shown)
  useEffect(() => {
    if (showExplanation) return;

    const t = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(t);
  }, [showExplanation]);

  // Time up => reveal explanation (unanswered counts as wrong)
  useEffect(() => {
    if (showExplanation) return;
    if (timeLeft === 0) {
      setShowExplanation(true);
    }
  }, [timeLeft, showExplanation]);

  const select = (optIndex: number) => {
    if (showExplanation) return;
    setAnswers((prev) => ({ ...prev, [current.id]: optIndex }));
    setShowExplanation(true);
  };

  const next = () => {
    if (idx < questions.length - 1) setIdx((v) => v + 1);
    else finish();
  };

  const finish = () => {
    const usedSec = Math.ceil((Date.now() - startedAtRef.current) / 1000);

    nav(`/result/${quizId ?? "draft"}`, {
      state: {
        quizId,
        questions,
        answers,
        usedSec,
        perQuestionTimeSec,
      },
    });
  };

  const progressPct = ((idx + 1) / questions.length) * 100;
  const isCorrect = selected === current.correctIndex;

  return (
    <div className="page">
      <div className="container">
        <div className="spaceBetween">
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Quiz
            </div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>#{quizId}</div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div className="muted" style={{ fontSize: 12 }}>
              Time (this question)
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
            Question <b>{idx + 1}</b> / {questions.length}
          </div>
          <div>
            Answered <b>{Object.keys(answers).length}</b> / {questions.length}
          </div>
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
                  ? "Time's up"
                  : isCorrect
                    ? "Correct"
                    : "Incorrect"}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>
                {current.explanation}
              </div>

              <div style={{ marginTop: 14 }}>
                <button className="btn btnPrimary" onClick={next}>
                  {idx < questions.length - 1 ? "Continue →" : "Finish Quiz"}
                </button>
              </div>
            </div>
          )}
        </section>

        <div style={{ marginTop: 16 }}>
          <Link className="btn btnGhost" to="/">
            Exit
          </Link>
        </div>
      </div>
    </div>
  );
}
