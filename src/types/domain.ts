export type SourceType =
  | "typed"
  | "dictated"
  | "handwritten_image"
  | "ai_import"
  | "longform";

export type NoteKind =
  | "quick"
  | "research"
  | "thinking"
  | "question"
  | "observation"
  | "mixed";

export type ProcessingStatus =
  | "pending"
  | "processing"
  | "ready"
  | "failed"
  | "needs_review";

export type ClaimType =
  | "fact"
  | "management_claim"
  | "external_claim"
  | "observation"
  | "inference"
  | "thesis"
  | "risk"
  | "counterargument";

export type EntityType = "company" | "person" | "industry";
export type MetaType = "daily" | "company" | "theme";
export type InboxCategory =
  | "needs_interpretation"
  | "ambiguous_entity"
  | "processing_failed"
  | "suggested_theme"
  | "contradiction"
  | "loose_end";

export type LinkFetchStatus = "pending" | "ready" | "failed";

export type NoteLink = {
  id: string;
  user_id: string;
  note_id: string;
  url: string;
  canonical_url: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  fetch_status: LinkFetchStatus;
  fetch_error: string | null;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  source_type: SourceType;
  raw_text: string | null;
  original_raw_text: string | null;
  interpreted_text: string | null;
  literal_transcription: string | null;
  uncertain_segments: unknown[];
  title: string | null;
  note_kind: NoteKind | null;
  processing_status: ProcessingStatus;
  ai_confidence: number | null;
  captured_at: string;
  created_at: string;
  updated_at: string;
  source_asset_id: string | null;
  parent_document_id: string | null;
};

export type DocumentRecord = {
  id: string;
  user_id: string;
  title: string | null;
  document_type: "longform" | "ai_research_session" | "research_session";
  raw_content: string;
  interpreted_content: string | null;
  source: string | null;
  processing_status: ProcessingStatus;
  captured_at: string;
  created_at: string;
  updated_at: string;
};

export type Entity = {
  id: string;
  entity_type: EntityType;
  canonical_name: string;
  ticker: string | null;
  exchange: string | null;
  aliases: string[];
  cik?: string | null;
  source?: "sec" | "user";
  last_synced_at?: string | null;
};

export type Theme = {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  description: string | null;
  status: "active" | "suggested" | "archived";
};

export type MetaNote = {
  id: string;
  user_id: string;
  meta_type: MetaType;
  entity_id: string | null;
  theme_id: string | null;
  date: string | null;
  title: string;
  current_content: string;
  user_edited: boolean;
  created_at: string;
  updated_at: string;
};

export type InboxItem = {
  id: string;
  user_id: string;
  category: InboxCategory;
  title: string;
  body: string | null;
  object_type: string | null;
  object_id: string | null;
  payload: Record<string, unknown>;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
};
