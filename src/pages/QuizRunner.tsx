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
    explanation:
      "5xx status codes represent server errors. 500 = Internal Server Error.",
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

  const totalTimeSec = 5 * 60;

  const questions = useMemo(() => DUMMY_QUESTIONS, []);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [remaining, setRemaining] = useState(totalTimeSec);
  const [timeUp, setTimeUp] = useState(false);

  const current = questions[idx];
  const selected = answers[current.id];

  // TIMER
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

  // SELECT ANSWER
  const select = (optIndex: number) => {
    if (timeUp || showExplanation) return;

    setAnswers((prev) => ({ ...prev, [current.id]: optIndex }));
    setShowExplanation(true);
  };

  const next = () => {
    if (idx < questions.length - 1) {
      setIdx((v) => v + 1);
      setShowExplanation(false);
    } else {
      finish();
    }
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
          <div>
            <div className="muted" style={{ fontSize: 12 }}>
              Time
            </div>
            <div style={{ fontWeight: 900 }}>{formatRemaining(remaining)}</div>
          </div>
        </div>

        <div className="progressBar">
          <div className="progressFill" style={{ width: `${progressPct}%` }} />
        </div>

        <section className="card" style={{ marginTop: 20 }}>
          <div className="muted" style={{ fontSize: 12 }}>
            Question {idx + 1}
          </div>
          <div style={{ fontWeight: 900, fontSize: 18, marginTop: 6 }}>
            {current.prompt}
          </div>

          <div className="list" style={{ marginTop: 16 }}>
            {current.options.map((opt, i) => {
              const isSel = selected === i;
              const isRight = i === current.correctIndex;

              let className = "option";
              if (showExplanation) {
                if (isRight) className += " optionSelected";
              } else if (isSel) {
                className += " optionSelected";
              }

              return (
                <button
                  key={i}
                  onClick={() => select(i)}
                  className={className}
                  disabled={showExplanation}
                >
                  <div>
                    <b>{String.fromCharCode(65 + i)}.</b> {opt}
                    {showExplanation && isRight && " ✅"}
                    {showExplanation && isSel && !isRight && " ❌"}
                  </div>
                </button>
              );
            })}
          </div>

          {/* EXPLANATION BLOCK */}
          {showExplanation && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 12,
                background: isCorrect ? "#f0fdf4" : "#fef2f2",
                border: `1px solid ${isCorrect ? "#bbf7d0" : "#fecaca"}`,
              }}
            >
              <div style={{ fontWeight: 800 }}>
                {isCorrect ? "Correct answer 🎉" : "Incorrect answer"}
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
