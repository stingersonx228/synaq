export type Values = Record<string, number>;

export type RefuteSpec =
  | { mode: "diverge"; vars: string[]; wrong: string; right: string; prompt: string }
  | { mode: "claim_test" | "missing"; vars: string[]; claim: string; original: string; prompt: string };

export interface Bug {
  /** 1-based step numbers that count as "the wrong line". */
  accept_steps: number[];
  /** Canonical cause, 1–2 sentences. Used by the judge and in the debrief. */
  cause: string;
  /** Lowercase word roots for the no-LLM fallback judge. At least 3. */
  keywords: string[];
  fix: string;
  /** The correct final answer, shown in the debrief and kept out of intern replies. */
  correct_answer: string;
  refute: RefuteSpec;
  /** Values that MUST produce ok:true. */
  demo: Values[];
  /** Values that MUST produce ok:false. */
  decoy: Values[];
  defense: [string, string];
  concede: string;
}

export type Level = 8 | 9 | 10 | 11;

export const SUBJECTS = ["algebra", "physics"] as const;
export type Subject = (typeof SUBJECTS)[number];

export interface Case {
  id: string;
  subject: Subject;
  type_id: string;
  topic: string;
  level: Level;
  task: string;
  steps: string[];
  answer: string;
  /** null = clean case without a bug. */
  bug: Bug | null;
  /** Required when bug === null. */
  falseAccusation?: string;
  hints: [string, string, string];
  /** mathjs expressions, ALL must evaluate to true; they confirm the correct answer. */
  truth: string[];
}

export const OUTCOMES = ["solved", "wrong_line", "false_accusation", "missed_clean", "failed_proof"] as const;
export type Outcome = (typeof OUTCOMES)[number];
