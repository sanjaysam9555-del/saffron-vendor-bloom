import Papa from "papaparse";

export interface ProjectCsvRow {
  bride_name: string;
  groom_name: string;
  wedding_date: string;
  notes: string | null;
  total_installments: number;
  planning_fee: number;
  target_income?: number;
}

export interface ProjectCsvField {
  key: keyof ProjectCsvRow;
  header: string;
  required: boolean;
  type: "text" | "number" | "date";
  example: string;
}

export const PROJECT_CSV_FIELDS: ProjectCsvField[] = [
  { key: "bride_name", header: "Bride Name", required: true, type: "text", example: "Stuty" },
  { key: "groom_name", header: "Groom Name", required: true, type: "text", example: "Bharat" },
  { key: "wedding_date", header: "Wedding Date (YYYY-MM-DD)", required: true, type: "date", example: "2026-12-02" },
  { key: "planning_fee", header: "Planning Fee", required: true, type: "number", example: "500000" },
  { key: "total_installments", header: "Number of Instalments (1-4)", required: true, type: "number", example: "2" },
  { key: "target_income", header: "Target Income", required: false, type: "number", example: "600000" },
  { key: "notes", header: "Notes", required: false, type: "text", example: "Destination wedding, 3-day itinerary" },
];

function normalizeHeader(s: string): string {
  return s.trim().toLowerCase().replace(/[\s_]+/g, " ").replace(/\(.*\)/, "").trim();
}

const HEADER_LOOKUP: Map<string, ProjectCsvField> = new Map(
  PROJECT_CSV_FIELDS.flatMap((f) => [
    [normalizeHeader(f.header), f],
    [normalizeHeader(f.key), f],
  ] as [string, ProjectCsvField][]),
);

export function projectsToCsv(
  projects: { bride_name: string; groom_name: string; wedding_date: string; notes: string | null; total_installments: number; planning_fee: number; target_income: number | null }[],
): string {
  const header = PROJECT_CSV_FIELDS.map((f) => f.header);
  const rows = projects.map((p) =>
    PROJECT_CSV_FIELDS.map((f) => {
      const value = (p as any)[f.key];
      return value == null ? "" : String(value);
    }),
  );
  return Papa.unparse({ fields: header, data: rows });
}

export function buildProjectTemplateCsv(): string {
  const header = PROJECT_CSV_FIELDS.map((f) => f.header);
  const example = PROJECT_CSV_FIELDS.map((f) => f.example);
  return Papa.unparse({ fields: header, data: [example] });
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ParsedProjectRow {
  rowNumber: number;
  input: ProjectCsvRow | null;
  errors: string[];
}

export interface ParseProjectCsvResult {
  rows: ParsedProjectRow[];
  unrecognizedColumns: string[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseProjectCsv(fileText: string): ParseProjectCsvResult {
  const parsed = Papa.parse<Record<string, string>>(fileText, {
    header: true,
    skipEmptyLines: true,
  });

  const sourceHeaders = parsed.meta.fields ?? [];
  const unrecognizedColumns = sourceHeaders.filter((h) => !HEADER_LOOKUP.has(normalizeHeader(h)));

  const rows: ParsedProjectRow[] = parsed.data.map((raw, i) => {
    const errors: string[] = [];
    const draft: Record<string, any> = {};

    for (const field of PROJECT_CSV_FIELDS) {
      const sourceHeader = sourceHeaders.find(
        (h) => normalizeHeader(h) === normalizeHeader(field.header) || normalizeHeader(h) === normalizeHeader(field.key),
      );
      const rawValue = sourceHeader != null ? (raw[sourceHeader] ?? "").trim() : "";

      if (!rawValue) {
        if (field.required) errors.push(`${field.header} is required.`);
        else if (field.key === "target_income") draft[field.key] = undefined;
        else draft[field.key] = null;
        continue;
      }

      if (field.type === "number") {
        const n = Number(rawValue);
        if (Number.isNaN(n)) {
          errors.push(`${field.header} must be a number (got "${rawValue}").`);
        } else if (field.key === "total_installments" && (n < 1 || n > 4 || !Number.isInteger(n))) {
          errors.push(`${field.header} must be a whole number from 1 to 4.`);
        } else {
          draft[field.key] = n;
        }
      } else if (field.type === "date") {
        if (!DATE_RE.test(rawValue) || Number.isNaN(new Date(rawValue).getTime())) {
          errors.push(`${field.header} must be in YYYY-MM-DD format (got "${rawValue}").`);
        } else {
          draft[field.key] = rawValue;
        }
      } else {
        draft[field.key] = rawValue;
      }
    }

    return {
      rowNumber: i + 2,
      input: errors.length === 0 ? (draft as ProjectCsvRow) : null,
      errors,
    };
  });

  return { rows, unrecognizedColumns };
}
