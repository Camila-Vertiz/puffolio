import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAt,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import type { Quiz, QuizRun, Question, Topic } from "./models";
export type { Quiz, QuizRun, Question, Topic };

/* -------------------- Admin CRUD -------------------- */

export async function createTopic(payload: Omit<Topic, "id">) {
  await addDoc(collection(db, "topics"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateTopic(
  id: string,
  patch: Partial<Omit<Topic, "id">>,
) {
  await setDoc(
    doc(db, "topics", id),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteTopic(id: string) {
  await deleteDoc(doc(db, "topics", id));
}

export async function createQuestion(payload: Omit<Question, "id">) {
  await addDoc(collection(db, "questions"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateQuestion(
  id: string,
  patch: Partial<Omit<Question, "id">>,
) {
  await setDoc(
    doc(db, "questions", id),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteQuestion(id: string) {
  await deleteDoc(doc(db, "questions", id));
}

export async function createQuiz(payload: Omit<Quiz, "id">) {
  await addDoc(collection(db, "quizzes"), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateQuiz(id: string, patch: Partial<Omit<Quiz, "id">>) {
  await setDoc(
    doc(db, "quizzes", id),
    { ...patch, updatedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function deleteQuiz(id: string) {
  await deleteDoc(doc(db, "quizzes", id));
}

/* -------------------- Runtime Reads -------------------- */

export async function getActiveQuizzes(): Promise<Quiz[]> {
  const snap = await getDocs(
    query(
      collection(db, "quizzes"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc"),
    ),
  );

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Quiz, "id">),
  }));
}

export async function getTopics(): Promise<Topic[]> {
  const snap = await getDocs(
    query(collection(db, "topics"), orderBy("order", "asc")),
  );

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Topic, "id">),
  }));
}

export async function getQuizById(quizId: string): Promise<Quiz> {
  const snap = await getDoc(doc(db, "quizzes", quizId));
  if (!snap.exists()) throw new Error("Quiz not found");
  return { id: snap.id, ...(snap.data() as Omit<Quiz, "id">) };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Loads questions for a quiz using:
 * - per-topic sampling ordered by rand
 * - client-side shuffle + slice to quiz.questionCount
 *
 * Requires index: questions(topicId==, isActive==, orderBy rand)
 */
export async function loadQuestionsForQuiz(quiz: Quiz): Promise<Question[]> {
  const topicIds = quiz.topicIds ?? [];
  const total = quiz.questionCount ?? 20;

  if (!topicIds.length) return [];

  const takePerTopic = Math.ceil(total / topicIds.length) + 3; // buffer
  const seed = Math.random();

  const all: Question[] = [];

  for (const topicId of topicIds) {
    const snap = await getDocs(
      query(
        collection(db, "questions"),
        where("isActive", "==", true),
        where("topicId", "==", topicId),
        orderBy("rand"),
        startAt(seed),
        limit(takePerTopic),
      ),
    );

    const rows = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Question, "id">),
    }));

    all.push(...rows);
  }

  return shuffle(all).slice(0, total);
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  // simple batched gets (ids are usually small: wrong list)
  const out: Question[] = [];
  for (const id of ids) {
    const snap = await getDoc(doc(db, "questions", id));
    if (snap.exists())
      out.push({ id: snap.id, ...(snap.data() as Omit<Question, "id">) });
  }
  return out;
}

/* -------------------- User Runs -------------------- */

export async function saveQuizRun(
  uid: string,
  run: Omit<QuizRun, "id">,
): Promise<string> {
  const ref = await addDoc(collection(db, "users", uid, "quizRuns"), {
    ...run,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function getQuizRun(uid: string, runId: string): Promise<QuizRun> {
  const snap = await getDoc(doc(db, "users", uid, "quizRuns", runId));
  if (!snap.exists()) throw new Error("Run not found");
  return { id: snap.id, ...(snap.data() as Omit<QuizRun, "id">) };
}

export async function getLatestQuizRun(uid: string): Promise<QuizRun | null> {
  const snap = await getDocs(
    query(
      collection(db, "users", uid, "quizRuns"),
      orderBy("createdAt", "desc"),
      limit(1),
    ),
  );
  const d = snap.docs[0];
  if (!d) return null;
  return { id: d.id, ...(d.data() as Omit<QuizRun, "id">) };
}
