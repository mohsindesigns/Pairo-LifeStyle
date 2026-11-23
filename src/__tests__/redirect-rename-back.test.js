import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import Redirect from "@/models/Redirect";
import { registerRedirect, resolveRedirect } from "@/lib/redirect-resolver";

const T = `rt${Date.now()}`;
const p = (s) => `/blog/${T}-${s}`;

describe("renaming a slug away and back must not leave a stale redirect on the live URL", () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/pairo");
  });
  afterAll(async () => {
    await Redirect.deleteMany({ oldPath: { $regex: T } });
    await mongoose.disconnect();
  });

  it("a -> b creates a redirect a => b", async () => {
    await registerRedirect(p("a"), p("b"));
    expect((await resolveRedirect(p("a"))).newPath).toBe(p("b"));
  });

  it("renaming back b -> a removes the redirect on the live url and redirects b => a", async () => {
    await registerRedirect(p("b"), p("a"));
    expect(await resolveRedirect(p("a"))).toBeNull(); // the live URL no longer redirects anywhere
    expect((await resolveRedirect(p("b"))).newPath).toBe(p("a"));
  });

  it("a three-way rename a -> b -> c -> a also ends clean", async () => {
    await registerRedirect(p("a"), p("b"));
    await registerRedirect(p("b"), p("c"));
    await registerRedirect(p("c"), p("a"));
    expect(await resolveRedirect(p("a"))).toBeNull();
    expect((await resolveRedirect(p("b"))).newPath).toBe(p("a"));
    expect((await resolveRedirect(p("c"))).newPath).toBe(p("a"));
  });

  it("a normal rename still redirects the old url to the new one", async () => {
    await registerRedirect(p("x"), p("y"));
    expect((await resolveRedirect(p("x"))).newPath).toBe(p("y"));
  });
});
