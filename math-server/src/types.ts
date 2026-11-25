/** 与前端 types/quiz.ts 的 OpType 保持一致 */
export const OP_TYPES = ['add', 'sub', 'addsub', 'mul', 'div', 'muldiv'] as const
export type OpType = (typeof OP_TYPES)[number]

export interface QuizConfigDto {
  count: number
  opType: OpType
  range: number
  operands: number
  carry: boolean
}

export interface QuestionRecordDto {
  seq: number
  expr: string
  userAnswer: string
  correctAnswer: number
  isCorrect: boolean
  timeMs: number
}

/* ---------- MySQL 查询行类型 ---------- */
import type { RowDataPacket } from 'mysql2'

export type IdRow = RowDataPacket & { id: number }

export type UserAuthRow = RowDataPacket & {
  id: number
  username: string
  email: string
  password_hash: string
}

export type UserPublicRow = RowDataPacket & {
  id: number
  username: string
  email: string
  createdAt: string | Date
}

export type ResetRow = RowDataPacket & {
  id: number
  code_hash: string
  attempts: number
  unexpired: boolean
}

export type ElapsedRow = RowDataPacket & { elapsed: string }

export type TotalsRow = RowDataPacket & {
  totalSessions: number | string
  totalQuestions: number | string | null
  totalCorrect: number | string | null
}

export type PerTypeRow = RowDataPacket & {
  opType: string
  sessions: number | string
  bestAvgMs: number | string | null
  bestScore: number | null
}

export type SessionRow = RowDataPacket & {
  id: number
  opType: string
  count: number
  range: number
  operands: number
  carry: number | boolean
  total: number
  correct: number
  score: number
  durationMs: number
  createdAt: string | Date
}

export type CountRow = RowDataPacket & { total: number | string }

export type QuestionRow = RowDataPacket & {
  seq: number
  expr: string
  userAnswer: string
  correctAnswer: number
  isCorrect: number | boolean
  timeMs: number
}

export type LeaderboardRow = RowDataPacket & {
  username: string
  avgMs: number | string
  total: number
  createdAt: string | Date
}
