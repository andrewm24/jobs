// Server-side render of a tailored resume to a PDF file, for apply-assist uploads.
// Uses @react-pdf/renderer's Node renderer via React.createElement (no JSX build).
import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToFile } from "@react-pdf/renderer";

const h = React.createElement;

const getFonts = (fontFamily = "Helvetica") => {
  if (fontFamily === "Times-Roman") {
    return { regular: "Times-Roman", bold: "Times-Bold", italic: "Times-Italic" };
  }
  if (fontFamily === "Courier") {
    return { regular: "Courier", bold: "Courier-Bold", italic: "Courier-Oblique" };
  }
  return { regular: "Helvetica", bold: "Helvetica-Bold", italic: "Helvetica-Oblique" };
};

const bullets = (arr, bulletStyle, textStyle, rowStyle) =>
  (arr ?? []).map((b, j) =>
    h(View, { key: j, style: rowStyle }, [
      h(Text, { key: "p", style: bulletStyle }, "•"),
      h(Text, { key: "t", style: textStyle }, b),
    ])
  );

function buildClassicDoc(data, color, fonts) {
  const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: fonts.regular, fontSize: 10, lineHeight: 1.4, color: "#111" },
    header: { marginBottom: 12, textAlign: "center" },
    name: { fontSize: 22, fontFamily: fonts.bold, color: color, marginBottom: 4 },
    contact: { fontSize: 9, color: "#444" },
    section: { marginBottom: 10 },
    sectionTitle: {
      fontSize: 11, fontFamily: fonts.bold, borderBottomWidth: 1.5, borderBottomColor: color,
      paddingBottom: 2, marginBottom: 6, textTransform: "uppercase", color: color,
    },
    itemGroup: { marginBottom: 7 },
    itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
    itemTitle: { fontFamily: fonts.bold, fontSize: 10.5 },
    itemSubtitle: { fontFamily: fonts.italic, color: "#333" },
    itemDate: { fontSize: 9, color: "#555" },
    bulletRow: { flexDirection: "row", marginBottom: 2 },
    bulletPoint: { width: 10, fontSize: 10, color: color },
    bulletText: { flex: 1 },
    skillsCategory: { flexDirection: "row", marginBottom: 3 },
    skillsTitle: { fontFamily: fonts.bold, width: 90, color: "#222" },
    skillsText: { flex: 1 },
  });

  const b = data.basics ?? {};
  const kids = [
    h(View, { key: "header", style: styles.header }, [
      h(Text, { key: "n", style: styles.name }, b.name ?? ""),
      h(Text, { key: "c", style: styles.contact },
        [b.email, b.phone, b.location, b.url].filter(Boolean).join("  |  ")),
    ]),
  ];

  if (data.education?.length) {
    kids.push(h(View, { key: "edu", style: styles.section }, [
      h(Text, { key: "title", style: styles.sectionTitle }, "Education"),
      ...data.education.map((edu, i) =>
        h(View, { key: i, style: styles.itemGroup }, [
          h(View, { key: "h1", style: styles.itemHeader }, [
            h(Text, { key: "a", style: styles.itemTitle }, edu.institution ?? ""),
            h(Text, { key: "b", style: styles.itemDate }, edu.date ?? ""),
          ]),
          h(View, { key: "h2", style: styles.itemHeader }, [
            h(Text, { key: "a", style: styles.itemSubtitle }, edu.degree ?? ""),
            edu.gpa ? h(Text, { key: "b", style: styles.itemDate }, `GPA: ${edu.gpa}`) : null,
          ]),
          ...bullets(edu.bullets, styles.bulletPoint, styles.bulletText, styles.bulletRow),
        ])
      ),
    ]));
  }

  if (data.experience?.length) {
    kids.push(h(View, { key: "exp", style: styles.section }, [
      h(Text, { key: "title", style: styles.sectionTitle }, "Experience"),
      ...data.experience.map((exp, i) =>
        h(View, { key: i, style: styles.itemGroup }, [
          h(View, { key: "h1", style: styles.itemHeader }, [
            h(Text, { key: "a", style: styles.itemTitle }, exp.company ?? ""),
            h(Text, { key: "b", style: styles.itemDate }, exp.date ?? ""),
          ]),
          h(View, { key: "h2", style: styles.itemHeader }, [
            h(Text, { key: "a", style: styles.itemSubtitle }, exp.position ?? ""),
            h(Text, { key: "b", style: styles.itemDate }, exp.location ?? ""),
          ]),
          ...bullets(exp.bullets, styles.bulletPoint, styles.bulletText, styles.bulletRow),
        ])
      ),
    ]));
  }

  if (data.projects?.length) {
    kids.push(h(View, { key: "proj", style: styles.section }, [
      h(Text, { key: "title", style: styles.sectionTitle }, "Projects"),
      ...data.projects.map((proj, i) =>
        h(View, { key: i, style: styles.itemGroup }, [
          h(View, { key: "h1", style: styles.itemHeader }, [
            h(Text, { key: "a", style: styles.itemTitle }, proj.name ?? ""),
            h(Text, { key: "b", style: styles.itemDate }, proj.date ?? ""),
          ]),
          proj.description ? h(Text, { key: "d", style: styles.itemSubtitle }, proj.description) : null,
          ...bullets(proj.bullets, styles.bulletPoint, styles.bulletText, styles.bulletRow),
        ])
      ),
    ]));
  }

  if (data.skills?.length) {
    kids.push(h(View, { key: "skills", style: styles.section }, [
      h(Text, { key: "title", style: styles.sectionTitle }, "Skills"),
      ...data.skills.map((skill, i) =>
        h(View, { key: i, style: styles.skillsCategory }, [
          h(Text, { key: "a", style: styles.skillsTitle }, `${skill.category ?? ""}:`),
          h(Text, { key: "b", style: styles.skillsText }, (skill.items ?? []).join(", ")),
        ])
      ),
    ]));
  }

  return h(Document, {}, h(Page, { size: "A4", style: styles.page }, kids));
}

export async function renderResumePdf(data, outPath, options = {}) {
  if (!data || !data.basics) throw new Error("no structured resume data to render");

  const color = options.primaryColor || "#0F1D2E";
  const fonts = getFonts(options.fontFamily || "Helvetica");

  const doc = buildClassicDoc(data, color, fonts);
  await renderToFile(doc, outPath);
  return outPath;
}
