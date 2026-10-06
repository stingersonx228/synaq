import { z } from "zod";
import { getCase } from "./catalog";
import { normalizeExplanation } from "./http";
import { OUTCOMES } from "./types";

export const EXPLANATION_MIN = 10;
export const EXPLANATION_MAX = 200;

export const buggyCaseId = z
  .string()
  .max(32)
  .refine((id) => getCase(id)?.bug != null, "unknown case");

export const explanation = z
  .string()
  .max(1000)
  .transform(normalizeExplanation)
  .pipe(z.string().min(EXPLANATION_MIN).max(EXPLANATION_MAX));

export const studentId = z.uuid();

export const JudgeBody = z.object({
  caseId: buggyCaseId,
  explanation,
  studentId: studentId.optional(),
});

export const InternBody = z.object({
  caseId: buggyCaseId,
  stage: z.union([z.literal(0), z.literal(1)]),
  explanation,
  studentId: studentId.optional(),
});

export const CLASS_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;

export const JoinBody = z.object({
  code: z
    .string()
    .transform((s) => s.trim().toUpperCase())
    .pipe(z.string().regex(CLASS_CODE_RE)),
  nickname: z
    .string()
    .max(100)
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2)
        .max(24)
        .regex(/^[\p{L}\p{N} _.-]+$/u),
    ),
});

export const AttemptBody = z.object({
  studentId,
  caseId: z
    .string()
    .max(32)
    .refine((id) => getCase(id) !== undefined, "unknown case"),
  outcome: z.enum(OUTCOMES),
  hintsUsed: z.number().int().min(0).max(3),
  causeOk: z.boolean().nullable(),
  refuteTries: z.number().int().min(0).max(3),
  livesLost: z.number().int().min(0).max(3),
});

export const CreateClassBody = z.object({
  name: z
    .string()
    .max(200)
    .transform((s) => s.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1).max(60)),
});

export const TEACHER_TOKEN_RE = /^[0-9a-f]{64}$/;
