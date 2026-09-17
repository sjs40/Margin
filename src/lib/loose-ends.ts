export type ResolvedThread = {
  question: string;
  comment: string | null;
};

export type LooseEndKind = "question" | "followup";
export type LooseEndActionStatus = "open" | "deferred" | "resolved" | "dismissed" | "completed";
export type QuestionStatus = "open" | "deferred" | "resolved" | "dismissed";
export type FollowupStatus = "open" | "deferred" | "completed" | "dismissed";

export type NestedRelation<T> = T | T[] | null | undefined;

export type LooseEndRelationRow = {
  note_id?: string | null;
  document_id?: string | null;
  entity_id?: string | null;
  theme_id?: string | null;
  resolved_by_note_id?: string | null;
  source_note?: NestedRelation<{ title: string | null }>;
  source_document?: NestedRelation<{ title: string | null }>;
  entity?: NestedRelation<{ ticker: string | null; canonical_name: string }>;
  theme?: NestedRelation<{ name: string }>;
  resolving_note?: NestedRelation<{ title: string | null }>;
  notes?: NestedRelation<{ title: string | null }>;
};

export type QuestionRecord = LooseEndRelationRow & {
  id: string;
  question_text: string;
  status: string;
  resolution_comment?: string | null;
  resolved_by_note_id?: string | null;
};

export type FollowupRecord = LooseEndRelationRow & {
  id: string;
  text: string;
  status: string;
  resolution_comment?: string | null;
  resolved_by_note_id?: string | null;
};

export type LooseEndProvenance = {
  entityLabel: string | null;
  entityId: string | null;
  themeName: string | null;
  themeId: string | null;
  sourceTitle: string | null;
  sourceHref: string | null;
  resolvingNoteTitle: string | null;
  resolvingNoteId: string | null;
};

export type LooseEndView = {
  id: string;
  kind: LooseEndKind;
  text: string;
  status: string;
  resolution_comment: string | null;
  resolved_by_note_id: string | null;
  note_id: string | null;
  document_id: string | null;
  entity_id: string | null;
  theme_id: string | null;
  source_title: string | null;
  source_href: string | null;
  source_line: string | null;
  entity_label: string | null;
  theme_name: string | null;
  resolving_note_title: string | null;
};

export type LooseEndInboxPayload = {
  kind: LooseEndKind;
  noteId: string | null;
  documentId: string | null;
  entityId: string | null;
  themeId: string | null;
  sourceTitle: string | null;
  sourceHref: string | null;
  entityLabel: string | null;
  themeName: string | null;
};

export const LOOSE_END_SELECT =
  "*, source_note:notes!note_id(title), source_document:documents!document_id(title), entity:entities!entity_id(ticker, canonical_name), theme:themes!theme_id(name), resolving_note:notes!resolved_by_note_id(title)";

export function formatResolvedThreads(items: ResolvedThread[]): string {
  if (items.length === 0) return "";
  return items
    .map((item) => `- ${item.question} → ${item.comment?.trim() || "(no comment)"}`)
    .join("\n");
}

export function firstRelated<T>(value: NestedRelation<T>): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function nonempty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function provenanceFromLooseEnd(row: LooseEndRelationRow): LooseEndProvenance {
  const sourceNote = firstRelated(row.source_note);
  const sourceDocument = firstRelated(row.source_document);
  const entity = firstRelated(row.entity);
  const theme = firstRelated(row.theme);
  const resolvingNote = firstRelated(row.resolving_note) ?? firstRelated(row.notes);
  const noteId = row.note_id ?? null;
  const documentId = row.document_id ?? null;
  let sourceTitle: string | null = null;
  let sourceHref: string | null = null;
  if (noteId) {
    sourceTitle = nonempty(sourceNote?.title) ?? "Untitled note";
    sourceHref = `/notes/${noteId}`;
  } else if (documentId) {
    sourceTitle = nonempty(sourceDocument?.title) ?? "Untitled document";
    sourceHref = `/documents/${documentId}`;
  }
  return {
    entityLabel: nonempty(entity?.ticker) ?? nonempty(entity?.canonical_name) ?? null,
    entityId: row.entity_id ?? null,
    themeName: nonempty(theme?.name),
    themeId: row.theme_id ?? null,
    sourceTitle,
    sourceHref,
    resolvingNoteTitle: nonempty(resolvingNote?.title),
    resolvingNoteId: row.resolved_by_note_id ?? null,
  };
}

export function formatLooseEndSourceLine(
  provenance: Pick<LooseEndProvenance, "entityLabel" | "themeName" | "sourceTitle">,
): string | null {
  const parts = [provenance.entityLabel, provenance.themeName, provenance.sourceTitle].filter(
    (part): part is string => Boolean(part),
  );
  if (parts.length === 0) return null;
  return `From: ${parts.join(" / ")} →`;
}

export function looseEndSourceHref(
  input: Pick<LooseEndProvenance, "sourceHref"> & LooseEndRelationRow,
): string | null {
  if (input.sourceHref) return input.sourceHref;
  return provenanceFromLooseEnd(input).sourceHref;
}

export function navigableLooseEndSourceHref(
  sourceHref: string | null,
  currentPathname?: string | null,
): string | null {
  if (!sourceHref) return null;
  if (!currentPathname) return sourceHref;
  const path = currentPathname.split("?")[0];
  if (path === sourceHref) return null;
  return sourceHref;
}

export function questionStatusForAction(status: LooseEndActionStatus): QuestionStatus {
  switch (status) {
    case "open":
    case "deferred":
    case "resolved":
    case "dismissed":
      return status;
    case "completed":
      return "resolved";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function followupStatusForAction(status: LooseEndActionStatus): FollowupStatus {
  switch (status) {
    case "open":
    case "deferred":
    case "completed":
    case "dismissed":
      return status;
    case "resolved":
      return "completed";
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

export function isActiveLooseEndStatus(status: string): boolean {
  return status === "open";
}

function mapLooseEndRecord(kind: LooseEndKind, text: string, row: LooseEndRelationRow & {
  id: string;
  status: string;
  resolution_comment?: string | null;
  resolved_by_note_id?: string | null;
}): LooseEndView {
  const provenance = provenanceFromLooseEnd(row);
  return {
    id: row.id,
    kind,
    text,
    status: row.status,
    resolution_comment: row.resolution_comment ?? null,
    resolved_by_note_id: row.resolved_by_note_id ?? null,
    note_id: row.note_id ?? null,
    document_id: row.document_id ?? null,
    entity_id: row.entity_id ?? null,
    theme_id: row.theme_id ?? null,
    source_title: provenance.sourceTitle,
    source_href: provenance.sourceHref,
    source_line: formatLooseEndSourceLine(provenance),
    entity_label: provenance.entityLabel,
    theme_name: provenance.themeName,
    resolving_note_title: provenance.resolvingNoteTitle,
  };
}

export function mapQuestionRecord(row: QuestionRecord): LooseEndView {
  return mapLooseEndRecord("question", row.question_text, row);
}

export function mapFollowupRecord(row: FollowupRecord): LooseEndView {
  return mapLooseEndRecord("followup", row.text, row);
}

export function buildLooseEndInboxInsert(input: {
  userId: string;
  kind: LooseEndKind;
  looseEndId: string;
  text: string;
  noteId?: string | null;
  documentId?: string | null;
  entityId?: string | null;
  themeId?: string | null;
  sourceTitle?: string | null;
  entityLabel?: string | null;
  themeName?: string | null;
}) {
  const sourceHref = looseEndSourceHref({
    note_id: input.noteId,
    document_id: input.documentId,
    sourceHref: null,
  });
  const payload: LooseEndInboxPayload = {
    kind: input.kind,
    noteId: input.noteId ?? null,
    documentId: input.documentId ?? null,
    entityId: input.entityId ?? null,
    themeId: input.themeId ?? null,
    sourceTitle: input.sourceTitle ?? null,
    sourceHref,
    entityLabel: input.entityLabel ?? null,
    themeName: input.themeName ?? null,
  };
  return {
    user_id: input.userId,
    category: "loose_end" as const,
    title: input.text,
    object_type: input.kind,
    object_id: input.looseEndId,
    status: "open" as const,
    payload,
  };
}

export function findOpenLooseEndInboxItem<
  T extends {
    category: string;
    object_type: string | null;
    object_id: string | null;
    status: string;
  },
>(items: T[], kind: LooseEndKind, looseEndId: string): T | undefined {
  return items.find(
    (item) =>
      item.category === "loose_end" &&
      item.status === "open" &&
      item.object_type === kind &&
      item.object_id === looseEndId,
  );
}

export function looseEndInboxCardModel(item: {
  title: string;
  payload: Partial<LooseEndInboxPayload> & { kind?: string };
}) {
  const kind: LooseEndKind = item.payload.kind === "followup" ? "followup" : "question";
  const provenance = {
    entityLabel: nonempty(item.payload.entityLabel),
    themeName: nonempty(item.payload.themeName),
    sourceTitle: nonempty(item.payload.sourceTitle),
    sourceHref:
      nonempty(item.payload.sourceHref) ??
      provenanceFromLooseEnd({
        note_id: item.payload.noteId,
        document_id: item.payload.documentId,
      }).sourceHref,
  };
  return {
    kind,
    kindLabel: kind === "followup" ? "Follow-up" : "Question",
    text: item.title,
    sourceLine: formatLooseEndSourceLine(provenance),
    sourceHref: provenance.sourceHref,
    sourceTitle: provenance.sourceTitle,
    entityLabel: provenance.entityLabel,
    themeName: provenance.themeName,
  };
}
