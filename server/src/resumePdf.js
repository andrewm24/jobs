// Server-side render of a tailored resume to a PDF file, for apply-assist uploads.
// Uses @react-pdf/renderer's Node renderer via React.createElement (no JSX build).
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToFile } from "@react-pdf/renderer";

const h = React.createElement;

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#000" },
  header: { marginBottom: 10, textAlign: "center" },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  contact: { fontSize: 9, color: "#333" },
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 12, fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#000",
    borderBottomStyle: "solid", paddingBottom: 2, marginBottom: 6, textTransform: "uppercase",
  },
  itemGroup: { marginBottom: 8 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  itemTitle: { fontFamily: "Helvetica-Bold" },
  itemSubtitle: { fontFamily: "Helvetica-Oblique" },
  itemDate: { fontSize: 9 },
  bulletRow: { flexDirection: "row", marginBottom: 2 },
  bulletPoint: { width: 10, fontSize: 10 },
  bulletText: { flex: 1 },
  skillsCategory: { flexDirection: "row", marginBottom: 2 },
  skillsTitle: { fontFamily: "Helvetica-Bold", width: 80 },
  skillsText: { flex: 1 },
});

const bullets = (arr) =>
  (arr ?? []).map((b, j) =>
    h(View, { key: j, style: styles.bulletRow }, [
      h(Text, { key: "p", style: styles.bulletPoint }, "•"),
      h(Text, { key: "t", style: styles.bulletText }, b),
    ])
  );

const section = (key, title, children) =>
  h(View, { key, style: styles.section }, [
    h(Text, { key: "title", style: styles.sectionTitle }, title),
    ...children,
  ]);

function buildDoc(data) {
  const b = data.basics ?? {};
  const kids = [
    h(View, { key: "header", style: styles.header }, [
      h(Text, { key: "n", style: styles.name }, b.name ?? ""),
      h(Text, { key: "c", style: styles.contact },
        [b.email, b.phone, b.location, b.url].filter(Boolean).join("  |  ")),
    ]),
  ];

  if (data.education?.length) {
    kids.push(section("edu", "Education", data.education.map((edu, i) =>
      h(View, { key: i, style: styles.itemGroup }, [
        h(View, { key: "h1", style: styles.itemHeader }, [
          h(Text, { key: "a", style: styles.itemTitle }, edu.institution ?? ""),
          h(Text, { key: "b", style: styles.itemDate }, edu.date ?? ""),
        ]),
        h(View, { key: "h2", style: styles.itemHeader }, [
          h(Text, { key: "a", style: styles.itemSubtitle }, edu.degree ?? ""),
          edu.gpa ? h(Text, { key: "b", style: styles.itemDate }, `GPA: ${edu.gpa}`) : null,
        ]),
        ...bullets(edu.bullets),
      ])
    )));
  }

  if (data.experience?.length) {
    kids.push(section("exp", "Experience", data.experience.map((exp, i) =>
      h(View, { key: i, style: styles.itemGroup }, [
        h(View, { key: "h1", style: styles.itemHeader }, [
          h(Text, { key: "a", style: styles.itemTitle }, exp.company ?? ""),
          h(Text, { key: "b", style: styles.itemDate }, exp.date ?? ""),
        ]),
        h(View, { key: "h2", style: styles.itemHeader }, [
          h(Text, { key: "a", style: styles.itemSubtitle }, exp.position ?? ""),
          h(Text, { key: "b", style: styles.itemDate }, exp.location ?? ""),
        ]),
        ...bullets(exp.bullets),
      ])
    )));
  }

  if (data.projects?.length) {
    kids.push(section("proj", "Projects", data.projects.map((proj, i) =>
      h(View, { key: i, style: styles.itemGroup }, [
        h(View, { key: "h1", style: styles.itemHeader }, [
          h(Text, { key: "a", style: styles.itemTitle }, proj.name ?? ""),
          h(Text, { key: "b", style: styles.itemDate }, proj.date ?? ""),
        ]),
        proj.description ? h(Text, { key: "d", style: styles.itemSubtitle }, proj.description) : null,
        ...bullets(proj.bullets),
      ])
    )));
  }

  if (data.skills?.length) {
    kids.push(section("skills", "Skills", data.skills.map((skill, i) =>
      h(View, { key: i, style: styles.skillsCategory }, [
        h(Text, { key: "a", style: styles.skillsTitle }, `${skill.category ?? ""}:`),
        h(Text, { key: "b", style: styles.skillsText }, (skill.items ?? []).join(", ")),
      ])
    )));
  }

  return h(Document, {}, h(Page, { size: "A4", style: styles.page }, kids));
}

export async function renderResumePdf(data, outPath) {
  if (!data || !data.basics) throw new Error("no structured resume data to render");
  await renderToFile(buildDoc(data), outPath);
  return outPath;
}
