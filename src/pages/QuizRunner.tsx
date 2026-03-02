import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

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

  // Draft: configure total time here
  const totalTimeSec = 5 * 60; // 5 minutes for UI testing

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
    // In real app: compute score + write batch to Firestore.
    // For draft: navigate to results with state
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

  const progress = `${idx + 1}/${questions.length}`;
  const selected = answers[current?.id];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Quiz</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>#{quizId}</div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Time remaining</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            {formatRemaining(remaining)}
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          height: 8,
          background: "#f2f2f2",
          borderRadius: 999,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((idx + 1) / questions.length) * 100}%`,
            background: "#111",
            borderRadius: 999,
            transition: "width .2s ease",
          }}
        />
      </div>

      <div
        style={{
          marginTop: 16,
          display: "flex",
          justifyContent: "space-between",
          opacity: 0.75,
        }}
      >
        <div>Progress: {progress}</div>
        <div>
          Answered: {Object.keys(answers).length}/{questions.length}
        </div>
      </div>

      <div
        style={{
          marginTop: 18,
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
          Question {idx + 1}
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>{current.prompt}</div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {current.options.map((opt, i) => {
            const isSel = selected === i;
            return (
              <button
                key={i}
                onClick={() => select(i)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 10,
                  border: isSel ? "2px solid #111" : "1px solid #eaeaea",
                  background: isSel ? "#fafafa" : "white",
                  cursor: timeUp ? "not-allowed" : "pointer",
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  {String.fromCharCode(65 + i)}.
                </div>
                <div style={{ marginTop: 4 }}>{opt}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <button
          onClick={prev}
          disabled={idx === 0}
          style={{ padding: "10px 14px" }}
        >
          ← Prev
        </button>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={finish} style={{ padding: "10px 14px" }}>
            Finish
          </button>
          <button
            onClick={next}
            disabled={idx === questions.length - 1}
            style={{ padding: "10px 14px" }}
          >
            Next →
          </button>
        </div>
      </div>

      {timeUp && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            background: "#fff3f3",
            border: "1px solid #ffd5d5",
          }}
        >
          Time is up. Submitting…
        </div>
      )}
    </div>
  );
}
