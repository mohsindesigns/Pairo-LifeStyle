// A spreadsheet runs a cell that starts with = + - @ (or a tab / carriage return) as a formula, and some exported text is
// typed by people outside the company (the public contact form, visitor analytics). Such a cell is prefixed with a single
// quote so it opens as plain text instead of running. Numbers, and strings that are only a number or a phone number
// ("-5.00", "+1 (555) 123-4567"), cannot do any harm and are left exactly as they are.
const FORMULA_START = /^[=+\-@\t\r]/;
const NUMBER_OR_PHONE = /^[+-]?[\d\s().-]*\d[\d\s().-]*$/;

// RFC 4180 field escaping: quote fields that contain a comma, quote, CR or LF,
// doubling any inner quotes. null/undefined become empty fields.
export function escapeCsvField(value) {
  let str = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && FORMULA_START.test(str) && !NUMBER_OR_PHONE.test(str)) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

// Builds a CSV document (CRLF line endings) with a UTF-8 BOM so Excel detects the encoding.
export function buildCsv(rows) {
  return "﻿" + rows.map(row => row.map(escapeCsvField).join(",")).join("\r\n");
}
