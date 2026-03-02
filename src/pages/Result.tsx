import { Link, useLocation } from "react-router-dom";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type ResultState = {
  questions: Question[];
  answers: Record<string, number>;
  totalTimeSec: number;
  usedSec: number;
  quizId?: string;
};

export default function Result() {
  const location = useLocation();
  const state = location.state as ResultState | null;

  // If user refreshes the page, state will be null (React Router state is not persisted)
  if (!state?.questions || !state?.answers) {
    return (
      <div style={{ padding: 24 }}>
        <p>No result data. Start a quiz first.</p>
        <Link to="/">Go Home</Link>
      </div>
    );
  }

  const { questions, answers, totalTimeSec, usedSec } = state;

  let correct = 0;
  const wrongIds: string[] = [];

  for (const q of questions) {
    const a = answers[q.id];
    if (a === q.correctIndex) correct++;
    else wrongIds.push(q.id);
  }

  const scorePct = Math.round((correct / questions.length) * 100);

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Results</h2>

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}
      >
        <div
          style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Score</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{scorePct}%</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {correct}/{questions.length} correct
          </div>
        </div>

        <div
          style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Time used</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {Math.ceil(usedSec / 60)} min
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            of {Math.ceil(totalTimeSec / 60)} min
          </div>
        </div>

        <div
          style={{ border: "1px solid #eee", borderRadius: 12, padding: 14 }}
        >
          <div style={{ fontSize: 12, opacity: 0.7 }}>Wrong questions</div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>{wrongIds.length}</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Review them next</div>
        </div>
      </div>

      <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
        <Link to="/" style={{ textDecoration: "none" }}>
          ← Home
        </Link>
        <Link to="/review" style={{ textDecoration: "none" }}>
          Review weak →
        </Link>
      </div>

      <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
        {questions.map((q, i) => {
          const a = answers[q.id];
          const ok = a === q.correctIndex;

          return (
            <div
              key={q.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 12,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  {i + 1}. {q.prompt}
                </div>
                <div
                  style={{ fontWeight: 900, color: ok ? "green" : "crimson" }}
                >
                  {ok ? "Correct" : "Wrong"}
                </div>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                {q.options.map((opt, idx) => {
                  const isCorrect = idx === q.correctIndex;
                  const isChosen = idx === a;

                  return (
                    <div
                      key={idx}
                      style={{
                        padding: 10,
                        borderRadius: 10,
                        border: "1px solid #f0f0f0",
                        background: isCorrect
                          ? "#f3fff3"
                          : isChosen
                            ? "#fff6f6"
                            : "white",
                      }}
                    >
                      <b>{String.fromCharCode(65 + idx)}.</b> {opt}
                      {isCorrect ? " ✅" : ""}
                      {isChosen && !isCorrect ? " ❌" : ""}
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8 }}>
                <b>Explanation:</b> {q.explanation}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
