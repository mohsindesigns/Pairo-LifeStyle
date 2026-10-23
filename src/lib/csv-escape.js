// RFC 4180 field escaping: quote fields that contain a comma, quote, CR or LF,
// doubling any inner quotes. null/undefined become empty fields.
export function escapeCsvField(value) {
  const str = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Builds a CSV document (CRLF line endings) with a UTF-8 BOM so Excel detects the encoding.
export function buildCsv(rows) {
  return "﻿" + rows.map(row => row.map(escapeCsvField).join(",")).join("\r\n");
}
