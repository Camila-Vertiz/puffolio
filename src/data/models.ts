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

export type QuizRun = {
  id: string;
  quizId: string;
  quizName: string;
  topicIds: string[];
  questionIds: string[];
  answers: Record<string, number>; // questionId -> chosenIndex
  correctCount: number;
  usedSec: number;
  perQuestionTimeSec: number;
  wrongQuestionIds: string[];
  createdAt?: unknown;
};