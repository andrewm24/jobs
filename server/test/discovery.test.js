import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

// scan.js imports db.js on load; keep it off the real dev database.
process.env.JOBOPS_DB_PATH = path.join(os.tmpdir(), `jobops-test-${randomUUID()}.db`);
const { prefilter, dedupeHash } = await import("../src/discovery/scan.js");
const { htmlToText } = await import("../src/discovery/ats.js");

test("prefilter applies include, exclude, and location rules", () => {
  const settings = { include_keywords: "intern", exclude_keywords: "senior", locations: "maryland" };
  const posts = [
    { title: "Software Intern", location: "Maryland" }, // pass
    { title: "Senior Intern", location: "Maryland" }, // excluded: senior
    { title: "Intern", location: "California" }, // excluded: location
    { title: "Intern", location: "Remote" }, // pass: remote always allowed
    { title: "Engineer", location: "Maryland" }, // excluded: no include keyword
  ];
  assert.deepEqual(prefilter(posts, settings).map((p) => p.title), ["Software Intern", "Intern"]);
});

test("dedupeHash is stable and case/whitespace-insensitive", () => {
  const a = dedupeHash({ company: "Acme", title: "SWE Intern", location: "NY" });
  const b = dedupeHash({ company: "  acme ", title: "swe  intern", location: "ny" });
  assert.equal(a, b);
  const c = dedupeHash({ company: "Acme", title: "Data Intern", location: "NY" });
  assert.notEqual(a, c);
});

test("htmlToText strips tags and decodes entities", () => {
  const out = htmlToText("<p>Hello &amp; <b>world</b></p><li>item</li>");
  assert.ok(out.includes("Hello & world"));
  assert.ok(!out.includes("<"));
});
