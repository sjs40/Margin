import { describe, expect, it } from "vitest";
import {
  buildLooseEndInboxInsert,
  findOpenLooseEndInboxItem,
  firstRelated,
  followupStatusForAction,
  formatLooseEndSourceLine,
  formatResolvedThreads,
  isActiveLooseEndStatus,
  looseEndInboxCardModel,
  looseEndSourceHref,
  mapFollowupRecord,
  mapQuestionRecord,
  provenanceFromLooseEnd,
  questionStatusForAction,
} from "@/lib/loose-ends";

describe("formatResolvedThreads", () => {
  it("formats question to comment lines for memory prompts", () => {
    expect(
      formatResolvedThreads([
        { question: "Will NVTS inflect?", comment: "No, not this year." },
      ]),
    ).toBe("- Will NVTS inflect? → No, not this year.");
  });

  it("returns empty string when there is nothing resolved", () => {
    expect(formatResolvedThreads([])).toBe("");
  });
});

describe("loose end provenance", () => {
  it("builds From: ticker / note title for a note-backed question", () => {
    const provenance = provenanceFromLooseEnd({
      note_id: "note-1",
      document_id: null,
      resolved_by_note_id: "note-resolved",
      source_note: { title: "VITL Egg Industry Notes" },
      source_document: null,
      entity: { ticker: "CALM", canonical_name: "Cal-Maine Foods" },
      theme: { name: "Egg Industry" },
      resolving_note: { title: "Later answer note" },
    });
    expect(formatLooseEndSourceLine(provenance)).toBe(
      "From: CALM / Egg Industry / VITL Egg Industry Notes →",
    );
    expect(provenance.sourceHref).toBe("/notes/note-1");
    expect(provenance.sourceTitle).toBe("VITL Egg Industry Notes");
    expect(provenance.sourceHref).not.toBe("/notes/note-resolved");
  });

  it("links a document-backed follow-up to /documents/[id]", () => {
    const provenance = provenanceFromLooseEnd({
      note_id: null,
      document_id: "doc-1",
      resolved_by_note_id: null,
      source_note: null,
      source_document: { title: "Q2 research dump" },
      entity: { ticker: null, canonical_name: "Cal-Maine Foods" },
      theme: null,
      resolving_note: null,
    });
    expect(formatLooseEndSourceLine(provenance)).toBe("From: Cal-Maine Foods / Q2 research dump →");
    expect(looseEndSourceHref(provenance)).toBe("/documents/doc-1");
  });

  it("prefers the originating note over a document when both exist", () => {
    const provenance = provenanceFromLooseEnd({
      note_id: "note-1",
      document_id: "doc-1",
      source_note: { title: "Desk note" },
      source_document: { title: "Imported session" },
    });
    expect(provenance.sourceHref).toBe("/notes/note-1");
    expect(provenance.sourceTitle).toBe("Desk note");
  });

  it("uses Untitled note/document when an id exists without a title", () => {
    expect(
      provenanceFromLooseEnd({ note_id: "note-1", source_note: { title: null } }).sourceTitle,
    ).toBe("Untitled note");
    expect(
      provenanceFromLooseEnd({ document_id: "doc-1", source_document: { title: "" } }).sourceTitle,
    ).toBe("Untitled document");
  });

  it("returns null source line when nothing is known", () => {
    expect(formatLooseEndSourceLine(provenanceFromLooseEnd({}))).toBeNull();
    expect(looseEndSourceHref(provenanceFromLooseEnd({}))).toBeNull();
  });

  it("reads first nested supabase relation whether it is an object or array", () => {
    expect(firstRelated({ title: "A" })).toEqual({ title: "A" });
    expect(firstRelated([{ title: "B" }])).toEqual({ title: "B" });
    expect(firstRelated([])).toBeNull();
    expect(firstRelated(null)).toBeNull();
  });
});

describe("map loose end records", () => {
  it("maps a question without using resolved_by_note_id as the originating source", () => {
    const view = mapQuestionRecord({
      id: "q1",
      question_text: "Is mix durable?",
      status: "open",
      resolution_comment: null,
      resolved_by_note_id: "note-resolved",
      note_id: "note-src",
      document_id: null,
      entity_id: "ent-1",
      theme_id: "theme-1",
      source_note: [{ title: "Desk note" }],
      entity: { ticker: "CALM", canonical_name: "Cal-Maine Foods" },
      theme: [{ name: "Egg Industry" }],
      resolving_note: { title: "Answer note" },
    });
    expect(view.kind).toBe("question");
    expect(view.text).toBe("Is mix durable?");
    expect(view.note_id).toBe("note-src");
    expect(view.source_title).toBe("Desk note");
    expect(view.source_href).toBe("/notes/note-src");
    expect(view.entity_label).toBe("CALM");
    expect(view.theme_name).toBe("Egg Industry");
    expect(view.resolving_note_title).toBe("Answer note");
    expect(view.source_line).toBe("From: CALM / Egg Industry / Desk note →");
  });

  it("maps a follow-up from a document", () => {
    const view = mapFollowupRecord({
      id: "f1",
      text: "Re-read the filing",
      status: "open",
      document_id: "doc-9",
      source_document: { title: "Imported 10-Q notes" },
    });
    expect(view.kind).toBe("followup");
    expect(view.source_href).toBe("/documents/doc-9");
    expect(view.source_line).toBe("From: Imported 10-Q notes →");
  });
});

describe("deferred loose end status", () => {
  it("keeps questions on open | deferred | resolved | dismissed", () => {
    expect(questionStatusForAction("open")).toBe("open");
    expect(questionStatusForAction("deferred")).toBe("deferred");
    expect(questionStatusForAction("resolved")).toBe("resolved");
    expect(questionStatusForAction("completed")).toBe("resolved");
    expect(questionStatusForAction("dismissed")).toBe("dismissed");
  });

  it("keeps follow-ups on open | deferred | completed | dismissed", () => {
    expect(followupStatusForAction("open")).toBe("open");
    expect(followupStatusForAction("deferred")).toBe("deferred");
    expect(followupStatusForAction("completed")).toBe("completed");
    expect(followupStatusForAction("resolved")).toBe("completed");
    expect(followupStatusForAction("dismissed")).toBe("dismissed");
  });

  it("treats only open as the active Loose Ends queue", () => {
    expect(isActiveLooseEndStatus("open")).toBe(true);
    expect(isActiveLooseEndStatus("deferred")).toBe(false);
    expect(isActiveLooseEndStatus("resolved")).toBe(false);
    expect(isActiveLooseEndStatus("completed")).toBe(false);
    expect(isActiveLooseEndStatus("dismissed")).toBe(false);
  });
});

describe("send to inbox", () => {
  it("builds a loose_end inbox row pointing at the canonical question", () => {
    const insert = buildLooseEndInboxInsert({
      userId: "user-1",
      kind: "question",
      looseEndId: "q1",
      text: "Is mix durable?",
      noteId: "note-src",
      documentId: null,
      entityId: "ent-1",
      themeId: "theme-1",
      sourceTitle: "Desk note",
      entityLabel: "CALM",
      themeName: "Egg Industry",
    });
    expect(insert).toEqual({
      user_id: "user-1",
      category: "loose_end",
      title: "Is mix durable?",
      object_type: "question",
      object_id: "q1",
      status: "open",
      payload: {
        kind: "question",
        noteId: "note-src",
        documentId: null,
        entityId: "ent-1",
        themeId: "theme-1",
        sourceTitle: "Desk note",
        sourceHref: "/notes/note-src",
        entityLabel: "CALM",
        themeName: "Egg Industry",
      },
    });
  });

  it("does not create a second open inbox item for the same loose end", () => {
    const existing = [
      {
        id: "inbox-1",
        category: "loose_end",
        object_type: "followup",
        object_id: "f1",
        status: "open",
      },
      {
        id: "inbox-2",
        category: "loose_end",
        object_type: "followup",
        object_id: "f1",
        status: "resolved",
      },
    ];
    expect(findOpenLooseEndInboxItem(existing, "followup", "f1")?.id).toBe("inbox-1");
    expect(findOpenLooseEndInboxItem(existing, "question", "f1")).toBeUndefined();
    expect(findOpenLooseEndInboxItem(existing, "followup", "other")).toBeUndefined();
  });

  it("presents an inbox card as Question or Follow-up with originating source", () => {
    const card = looseEndInboxCardModel({
      title: "Is mix durable?",
      payload: {
        kind: "question",
        sourceTitle: "Desk note",
        sourceHref: "/notes/note-src",
        entityLabel: "CALM",
        themeName: "Egg Industry",
      },
    });
    expect(card.kindLabel).toBe("Question");
    expect(card.text).toBe("Is mix durable?");
    expect(card.sourceLine).toBe("From: CALM / Egg Industry / Desk note →");
    expect(card.sourceHref).toBe("/notes/note-src");
    expect(card.sourceTitle).toBe("Desk note");
  });
});
