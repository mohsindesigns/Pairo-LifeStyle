import { describe, it, expect } from "vitest";
import { escapeCsvField, buildCsv } from "@/lib/csv-escape";
import { addressFromCustomer, isSameAddress } from "@/lib/order-address-prefill";

describe("escapeCsvField (RFC 4180)", () => {
  it("leaves plain values alone", () => {
    expect(escapeCsvField("hello")).toBe("hello");
    expect(escapeCsvField(12)).toBe("12");
  });
  it("turns null/undefined into empty fields", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });
  it("quotes commas, quotes and newlines", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("x\r\ny")).toBe('"x\r\ny"');
  });
  it("builds a BOM-prefixed CRLF document", () => {
    const csv = buildCsv([["Name", "Note"], ["Doe, Jane", 'a "b"']]);
    expect(csv).toBe('﻿Name,Note\r\n"Doe, Jane","a ""b"""');
  });
});

describe("escapeCsvField: spreadsheet formula injection", () => {
  it.each([
    ['=HYPERLINK("http://evil.example","click")', `"'=HYPERLINK(""http://evil.example"",""click"")"`],
    ["=1+1", "'=1+1"],
    ["+cmd|' /C calc'!A0", "'+cmd|' /C calc'!A0"],
    ["-2+3+cmd", "'-2+3+cmd"],
    ["@SUM(A1:A9)", "'@SUM(A1:A9)"],
    ["\t=1+1", "'\t=1+1"],
    ["\r=1+1", `"'\r=1+1"`],
    ["- need a quote", "'- need a quote"],
  ])("neutralises %j", (input, expected) => {
    expect(escapeCsvField(input)).toBe(expected);
  });

  it("leaves real numbers, numeric strings and phone numbers alone", () => {
    expect(escapeCsvField(-5)).toBe("-5");
    expect(escapeCsvField(-5.5)).toBe("-5.5");
    expect(escapeCsvField("-5.00")).toBe("-5.00");
    expect(escapeCsvField("+923001234567")).toBe("+923001234567");
    expect(escapeCsvField("+1 (555) 123-4567")).toBe('+1 (555) 123-4567');
    expect(escapeCsvField("555-123-4567")).toBe("555-123-4567");
  });

  it("only prefixes values that START with a formula character", () => {
    expect(escapeCsvField("a=1")).toBe("a=1");
    expect(escapeCsvField("Jane - Doe")).toBe("Jane - Doe");
    expect(escapeCsvField("name@example.com")).toBe("name@example.com");
  });

  it("is applied to every cell of a built document, header included", () => {
    expect(buildCsv([["=Name", "Note"], ["x", "@evil"]])).toBe("﻿'=Name,Note\r\nx,'@evil");
  });
});

describe("addressFromCustomer", () => {
  const customer = {
    name: "Jane Doe",
    phone: "555",
    addresses: [
      { fullName: "Office", street: "1 A St", city: "X", state: "S", zipCode: "111", country: "US" },
      { fullName: "Home", street: "2 B St", city: "Y", state: "T", zipCode: "222", country: "CA", isDefault: true },
    ],
  };
  it("prefers the default address", () => {
    expect(addressFromCustomer(customer)).toEqual({
      fullName: "Home", street: "2 B St", city: "Y", state: "T", zip: "222", country: "CA", phone: "555",
    });
  });
  it("falls back to the first address and customer name", () => {
    const c = { name: "Jo", addresses: [{ street: "9 Z", city: "Q", zipCode: "9" }] };
    expect(addressFromCustomer(c, { country: "United States" })).toEqual({
      fullName: "Jo", street: "9 Z", city: "Q", state: "", zip: "9", country: "United States", phone: "",
    });
  });
  it("returns null without saved addresses", () => {
    expect(addressFromCustomer({ name: "N", addresses: [] })).toBeNull();
    expect(addressFromCustomer({ name: "N" })).toBeNull();
  });
  it("compares addresses field by field", () => {
    const a = { fullName: "A", street: "s", city: "c", state: "", zip: "", country: "US", phone: "" };
    expect(isSameAddress(a, { ...a })).toBe(true);
    expect(isSameAddress(a, { ...a, city: "d" })).toBe(false);
  });
});
