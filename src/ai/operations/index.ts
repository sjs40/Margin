import { generateStructured, embedText, aiConfig } from "@/ai/aiService";
import {
  ASK_PROMPT_VERSION,
  CLAIM_CONFLICTS_PROMPT_VERSION,
  COMPANY_MEMORY_PROMPT_VERSION,
  DAILY_SYNTHESIS_PROMPT_VERSION,
  DISCOVER_CONNECTIONS_PROMPT_VERSION,
  HANDWRITING_PROMPT_VERSION,
  PARSE_IMPORT_PROMPT_VERSION,
  PARSE_NOTE_PROMPT_VERSION,
  THEME_MEMORY_PROMPT_VERSION,
  askFromMemoryPrompt,
  claimConflictsPrompt,
  companyMemoryPrompt,
  dailySynthesisPrompt,
  discoverConnectionsPrompt,
  handwritingPrompt,
  parseImportPrompt,
  parseNotePrompt,
  themeMemoryPrompt,
  type AttachedSource,
} from "@/ai/prompts";
import { AskAnswerSchema } from "@/ai/schemas/ask";
import { HandwritingSchema } from "@/ai/schemas/handwriting";
import { ClaimConflictsSchema } from "@/ai/schemas/claim-conflicts";
import {
  ConnectionDiscoverySchema,
  DailySynthesisSchema,
  MemoryUpdateSchema,
  ParsedImportSchema,
} from "@/ai/schemas/memory-update";
import { ParsedNoteSchema } from "@/ai/schemas/parsed-note";

export const ai = {
  parseNote(rawText: string, existingThemes: string[], attachedSources: AttachedSource[] = [], taggedTickers: string[] = []) {
    return generateStructured({
      schema: ParsedNoteSchema,
      prompt: parseNotePrompt(rawText, existingThemes, attachedSources, taggedTickers),
      model: aiConfig.fastModel,
      thinkingLevel: "low",
      promptVersion: PARSE_NOTE_PROMPT_VERSION,
      jobType: "parse_note",
    });
  },

  interpretHandwriting(image: { mimeType: string; dataBase64: string }) {
    return generateStructured({
      schema: HandwritingSchema,
      prompt: handwritingPrompt(),
      model: aiConfig.visionModel,
      thinkingLevel: "low",
      image,
      promptVersion: HANDWRITING_PROMPT_VERSION,
      jobType: "interpret_handwriting",
    });
  },

  parseAIImport(raw: string, existingThemes: string[]) {
    return generateStructured({
      schema: ParsedImportSchema,
      prompt: parseImportPrompt(raw, existingThemes),
      model: aiConfig.fastModel,
      thinkingLevel: "low",
      promptVersion: PARSE_IMPORT_PROMPT_VERSION,
      jobType: "parse_ai_import",
    });
  },

  synthesizeDay(input: {
    date: string;
    notes: string;
    existingDaily?: string | null;
    userEdited?: boolean;
    resolvedQuestions?: string;
  }) {
    return generateStructured({
      schema: DailySynthesisSchema,
      prompt: dailySynthesisPrompt(input),
      model: aiConfig.synthesisModel,
      thinkingLevel: "medium",
      promptVersion: DAILY_SYNTHESIS_PROMPT_VERSION,
      jobType: "synthesize_day",
    });
  },

  updateCompanyMemory(input: {
    name: string;
    ticker: string | null;
    existing: string | null;
    userEdited: boolean;
    recent: string;
    priorClaims?: string;
    resolvedQuestions?: string;
  }) {
    return generateStructured({
      schema: MemoryUpdateSchema,
      prompt: companyMemoryPrompt(input),
      model: aiConfig.synthesisModel,
      thinkingLevel: "medium",
      promptVersion: COMPANY_MEMORY_PROMPT_VERSION,
      jobType: "update_company_memory",
    });
  },

  detectClaimConflicts(input: {
    ticker: string | null;
    name: string;
    newClaims: string;
    priorClaims: string;
  }) {
    return generateStructured({
      schema: ClaimConflictsSchema,
      prompt: claimConflictsPrompt(input),
      model: aiConfig.fastModel,
      thinkingLevel: "low",
      promptVersion: CLAIM_CONFLICTS_PROMPT_VERSION,
      jobType: "detect_claim_conflicts",
    });
  },

  updateThemeMemory(input: {
    name: string;
    existing: string | null;
    userEdited: boolean;
    recent: string;
  }) {
    return generateStructured({
      schema: MemoryUpdateSchema,
      prompt: themeMemoryPrompt(input),
      model: aiConfig.synthesisModel,
      thinkingLevel: "medium",
      promptVersion: THEME_MEMORY_PROMPT_VERSION,
      jobType: "update_theme_memory",
    });
  },

  discoverConnections(input: { notes: string; existingThemes: string[] }) {
    return generateStructured({
      schema: ConnectionDiscoverySchema,
      prompt: discoverConnectionsPrompt(input),
      model: aiConfig.deepModel,
      thinkingLevel: "medium",
      promptVersion: DISCOVER_CONNECTIONS_PROMPT_VERSION,
      jobType: "discover_connections",
    });
  },

  answerFromMemory(input: { question: string; context: string }) {
    return generateStructured({
      schema: AskAnswerSchema,
      prompt: askFromMemoryPrompt(input),
      model: aiConfig.synthesisModel,
      thinkingLevel: "medium",
      promptVersion: ASK_PROMPT_VERSION,
      jobType: "answer_from_memory",
    });
  },

  embed: embedText,
};
