import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderResumePdf } from "../src/resumePdf.js";

test("renderResumePdf creates valid PDF file with custom options", async () => {
  const sampleData = {
    basics: {
      name: "Test Candidate",
      email: "candidate@example.com",
      phone: "555-0199",
      location: "Washington, DC",
      url: "example.com",
    },
    education: [
      { institution: "Test University", degree: "B.S. CS", date: "2024", gpa: "3.9", bullets: ["Honor Roll"] },
    ],
    experience: [
      { company: "Acme Corp", position: "Software Engineer", date: "2024-Present", location: "Remote", bullets: ["Built APIs"] },
    ],
    skills: [{ category: "Languages", items: ["JavaScript", "Python"] }],
  };

  const tempPdf = path.join(os.tmpdir(), `test-resume-${Date.now()}.pdf`);

  try {
    await renderResumePdf(sampleData, tempPdf, {
      template: "modern",
      primaryColor: "steel",
      fontFamily: "Helvetica",
    });

    assert.ok(fs.existsSync(tempPdf), "PDF file should exist");
    const stat = fs.statSync(tempPdf);
    assert.ok(stat.size > 1000, "PDF should not be empty");
  } finally {
    if (fs.existsSync(tempPdf)) {
      fs.unlinkSync(tempPdf);
    }
  }
});
