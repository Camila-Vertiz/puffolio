import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";

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
    explanation: "5xx codes are server errors. 500 = Internal Server Error.",
  },
  {
    id: "qq3",
    prompt: "In OOP, what does encapsulation mean?",
    options: [
      "Hiding internal state with controlled access",
      "Running code in parallel",
      "Storing data in the cloud",
      "Encrypting a database",
    ],
    correctIndex: 0,
    explanation:
      "Encapsulation hides internal state and exposes behavior via methods.",
  },
];

function formatRemaining(sec: number) {
  const s = Math.max(0, sec);
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

export default function QuizRunner() {
  const { quizId } = useParams();
  const nav = useNavigate();

  // Draft: total time for UI testing
  const totalTimeSec = 5 * 60;

  const questions = useMemo(() => DUMMY_QUESTIONS, []);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startedAt] = useState(() => Date.now());
  const [remaining, setRemaining] = useState(totalTimeSec);
  const [timeUp, setTimeUp] = useState(false);

  const current = questions[idx];

  useEffect(() => {
    const deadline = startedAt + totalTimeSec * 1000;

    const t = window.setInterval(() => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        setTimeUp(true);
        window.clearInterval(t);
      } else {
        setRemaining(left);
      }
    }, 250);

    return () => window.clearInterval(t);
  }, [startedAt, totalTimeSec]);

  const select = (optIndex: number) => {
    if (timeUp) return;
    setAnswers((prev) => ({ ...prev, [current.id]: optIndex }));
  };

  const next = () => {
    if (idx < questions.length - 1) setIdx((v) => v + 1);
  };

  const prev = () => {
    if (idx > 0) setIdx((v) => v - 1);
  };

  const finish = () => {
    nav(`/result/${quizId ?? "draft"}`, {
      state: {
        quizId,
        questions,
        answers,
        totalTimeSec,
        usedSec: totalTimeSec - remaining,
      },
    });
  };

  useEffect(() => {
    if (timeUp) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  const progressPct = ((idx + 1) / questions.length) * 100;
  const selected = answers[current.id];

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
              Time remaining
            </div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              {formatRemaining(remaining)}
            </div>
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
              return (
                <button
                  key={i}
                  onClick={() => select(i)}
                  className={`option ${isSel ? "optionSelected" : ""}`}
                  disabled={timeUp}
                >
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <span className="kbd">{String.fromCharCode(65 + i)}</span>
                  </div>
                  <div style={{ marginTop: 8 }}>{opt}</div>
                </button>
              );
            })}
          </div>
        </section>

        <div className="spaceBetween" style={{ marginTop: 14 }}>
          <button className="btn" onClick={prev} disabled={idx === 0}>
            ← Prev
          </button>

          <div className="row">
            <Link
              className="btn btnGhost"
              to="/"
              style={{ display: "inline-flex", alignItems: "center" }}
            >
              Exit
            </Link>
            <button className="btn btnPrimary" onClick={finish}>
              Finish
            </button>
            <button
              className="btn"
              onClick={next}
              disabled={idx === questions.length - 1}
            >
              Next →
            </button>
          </div>
        </div>

        {timeUp && <div className="alert">Time is up. Submitting…</div>}
      </div>
    </div>
  );
}
