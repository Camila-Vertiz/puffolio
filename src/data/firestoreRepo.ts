import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";

export type Topic = {
  id: string;
  name: string;
  order: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Question = {
  id: string;
  topicId: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  rand: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type Quiz = {
  id: string;
  name: string;
  topicIds: string[];
  mode: "study" | "exam";
  questionCount: number;
  perQuestionTimeSec: number; // default 45
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export async function createTopic(
  input: Omit<Topic, "id" | "createdAt" | "updatedAt">,
) {
  const ref = await addDoc(collection(db, "topics"), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTopic(id: string, patch: Partial<Topic>) {
  await updateDoc(doc(db, "topics", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTopic(id: string) {
  await deleteDoc(doc(db, "topics", id));
}

export async function createQuestion(
  input: Omit<Question, "id" | "createdAt" | "updatedAt">,
) {
  const ref = await addDoc(collection(db, "questions"), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuestion(id: string, patch: Partial<Question>) {
  await updateDoc(doc(db, "questions", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQuestion(id: string) {
  await deleteDoc(doc(db, "questions", id));
}

export async function createQuiz(
  input: Omit<Quiz, "id" | "createdAt" | "updatedAt">,
) {
  const ref = await addDoc(collection(db, "quizzes"), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateQuiz(id: string, patch: Partial<Quiz>) {
  await updateDoc(doc(db, "quizzes", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteQuiz(id: string) {
  await deleteDoc(doc(db, "quizzes", id));
}
