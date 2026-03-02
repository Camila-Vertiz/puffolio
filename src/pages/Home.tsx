import { Link } from "react-router-dom";

type Topic = { id: string; name: string; count: number };
type Quiz = {
  id: string;
  name: string;
  topicId: string;
  questionCount: number;
  totalTimeSec: number;
  mode: "exam" | "study";
};

const TOPICS: Topic[] = [
  { id: "t1", name: "AWS", count: 120 },
  { id: "t2", name: "Java", count: 80 },
  { id: "t3", name: "Networking", count: 150 },
];

const QUIZZES: Quiz[] = [
  {
    id: "q1",
    name: "AWS Basics - 40Q",
    topicId: "t1",
    questionCount: 40,
    totalTimeSec: 3600,
    mode: "exam",
  },
  {
    id: "q2",
    name: "Java OOP - 25Q",
    topicId: "t2",
    questionCount: 25,
    totalTimeSec: 1800,
    mode: "study",
  },
  {
    id: "q3",
    name: "Networking Mixed - 50Q",
    topicId: "t3",
    questionCount: 50,
    totalTimeSec: 3600,
    mode: "exam",
  },
];

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h > 0) return `${h}h ${mm}m`;
  return `${m}m`;
}

export default function Home() {
  return (
    <div className="page">
      <div className="container">
        <h1 className="h1">Puffolio</h1>
        <p className="subtitle">
          Banqueo-style learning • Total timer • Study & Exam mode
        </p>

        <div className="grid">
          <section className="card">
            <h3 className="cardTitle">Topics</h3>
            <div className="list">
              {TOPICS.map((t) => (
                <div key={t.id} className="item">
                  <div className="itemLeft">
                    <div className="itemName">{t.name}</div>
                    <div className="itemMeta">{t.count} questions</div>
                  </div>
                  <Link to={`/topic/${t.id}`}>View →</Link>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <h3 className="cardTitle">Quizzes</h3>
            <div className="list">
              {QUIZZES.map((q) => (
                <div
                  key={q.id}
                  className="item"
                  style={{ alignItems: "flex-start" }}
                >
                  <div className="itemLeft" style={{ gap: 6 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <div className="itemName">{q.name}</div>
                      <span className="badge">{q.mode.toUpperCase()}</span>
                    </div>
                    <div className="itemMeta">
                      {q.questionCount} questions • {formatTime(q.totalTimeSec)}{" "}
                      total
                    </div>

                    <div className="actions">
                      <Link to={`/quiz/${q.id}`}>Start →</Link>
                      <Link to="/review" style={{ color: "var(--muted)" }}>
                        Review weak →
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

      </div>
    </div>
  );
}
