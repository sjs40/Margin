"use client";

import { useEffect, useState } from "react";
import { formatCapturedAt, formatDateTime, formatLongDate } from "@/lib/dates";

type FormatKind = "time" | "date" | "datetime";

function formatLabel(kind: FormatKind, iso: string): string {
  switch (kind) {
    case "time":
      return formatCapturedAt(iso);
    case "date":
      return formatLongDate(iso);
    case "datetime":
      return formatDateTime(iso);
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

function LocalInstant({ iso, kind }: { iso: string; kind: FormatKind }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(formatLabel(kind, iso));
  }, [iso, kind]);
  return <time dateTime={iso}>{label}</time>;
}

export function LocalTime({ iso }: { iso: string }) {
  return <LocalInstant iso={iso} kind="time" />;
}

export function LocalDate({ iso }: { iso: string }) {
  return <LocalInstant iso={iso} kind="date" />;
}

export function LocalDateTime({ iso }: { iso: string }) {
  return <LocalInstant iso={iso} kind="datetime" />;
}
