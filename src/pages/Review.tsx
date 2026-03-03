import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";

type Question = {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

type RunDoc = {
  questions: Question[];
  answers: Record<string, number>;
};

export default function Review() {
  const [loading, setLoading] = useState(true);
  const [runs, setRuns] = useState<RunDoc[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const u = auth.currentUser;
        if (!u) return;

        const qy = query(
          collection(db, "users", u.uid, "runs"),
          orderBy("finishedAt", "desc"),
        );

        const snap = await getDocs(qy);
        setRuns(snap.docs.map((d) => d.data() as RunDoc));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const weakQuestions = useMemo(() => {
    const stats = new Map<string, { q: Question; wrong: number }>();

    for (const run of runs) {
      for (const q of run.questions) {
        const answer = run.answers[q.id];
        if (answer !== q.correctIndex) {
          const prev = stats.get(q.id);
          if (!prev) stats.set(q.id, { q, wrong: 1 });
          else prev.wrong++;
        }
      }
    }

    return Array.from(stats.values()).sort((a, b) => b.wrong - a.wrong);
  }, [runs]);

  if (loading) return <div className="container">Loading…</div>;

  if (!runs.length)
    return (
      <div className="container">
        <h2>Weak questions</h2>
        <p>No quiz runs yet. Take a quiz first.</p>
      </div>
    );

  if (!weakQuestions.length)
    return (
      <div className="container">
        <h2>Weak questions</h2>
        <p>Great job! No weak questions found 🎉</p>
      </div>
    );

  return (
    <div className="container">
      <h2>Weak questions</h2>

      {weakQuestions.map((item, i) => (
        <div key={item.q.id} style={{ marginBottom: 16 }}>
          <strong>
            {i + 1}. {item.q.prompt}
          </strong>
          <div style={{ color: "red" }}>Wrong attempts: {item.wrong}</div>
        </div>
      ))}

      <Link to="/">Home</Link>
    </div>
  );
}
