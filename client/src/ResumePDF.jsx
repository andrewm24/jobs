import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export const TEMPLATES = [
  { id: 'classic', name: 'Classic Standard', description: 'Clean, traditional single-column layout with horizontal section dividers.' },
  { id: 'modern', name: 'Modern Executive', description: 'Bold header banner with primary accent highlights and styled section blocks.' },
  { id: 'minimal', name: 'Minimal Compact', description: 'Tight line height and compact margins to maximize content density on one page.' },
  { id: 'tech', name: 'Tech Two-Column', description: 'Sidebar for Contact, Skills & Education alongside a main Experience feed.' },
];

export const COLORS = [
  { id: 'navy', label: 'Navy Ink', hex: '#0F1D2E' },
  { id: 'steel', label: 'Steel Blue', hex: '#3E6285' },
  { id: 'forest', label: 'Forest Green', hex: '#1F7A47' },
  { id: 'orange', label: 'International Orange', hex: '#E8500A' },
  { id: 'charcoal', label: 'Slate Charcoal', hex: '#222831' },
  { id: 'burgundy', label: 'Classic Burgundy', hex: '#6B1111' },
];

export const FONTS = [
  { id: 'Helvetica', label: 'Helvetica (Sans-Serif)' },
  { id: 'Times-Roman', label: 'Times New Roman (Serif)' },
  { id: 'Courier', label: 'Courier (Monospace)' },
];

const getFontVariants = (fontFamily = 'Helvetica') => {
  if (fontFamily === 'Times-Roman') {
    return {
      regular: 'Times-Roman',
      bold: 'Times-Bold',
      italic: 'Times-Italic',
    };
  }
  if (fontFamily === 'Courier') {
    return {
      regular: 'Courier',
      bold: 'Courier-Bold',
      italic: 'Courier-Oblique',
    };
  }
  return {
    regular: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
  };
};

const Bullet = ({ children, style, bulletStyle }) => (
  <View style={style.bulletRow}>
    <Text style={bulletStyle || style.bulletPoint}>•</Text>
    <Text style={style.bulletText}>{children}</Text>
  </View>
);

// ---------------- 1. CLASSIC TEMPLATE ----------------
function ClassicLayout({ data, color, fonts }) {
  const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: fonts.regular, fontSize: 10, lineHeight: 1.4, color: '#111' },
    header: { marginBottom: 12, textAlign: 'center' },
    name: { fontSize: 22, fontFamily: fonts.bold, color: color, marginBottom: 4 },
    contact: { fontSize: 9, color: '#444' },
    section: { marginBottom: 10 },
    sectionTitle: {
      fontSize: 11,
      fontFamily: fonts.bold,
      borderBottomWidth: 1.5,
      borderBottomColor: color,
      paddingBottom: 2,
      marginBottom: 6,
      textTransform: 'uppercase',
      color: color,
    },
    itemGroup: { marginBottom: 7 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    itemTitle: { fontFamily: fonts.bold, fontSize: 10.5 },
    itemSubtitle: { fontFamily: fonts.italic, color: '#333' },
    itemDate: { fontSize: 9, color: '#555' },
    bulletRow: { flexDirection: 'row', marginBottom: 2 },
    bulletPoint: { width: 10, fontSize: 10, color: color },
    bulletText: { flex: 1 },
    skillsCategory: { flexDirection: 'row', marginBottom: 3 },
    skillsTitle: { fontFamily: fonts.bold, width: 90, color: '#222' },
    skillsText: { flex: 1 },
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.name}>{data.basics?.name}</Text>
        <Text style={styles.contact}>
          {[data.basics?.email, data.basics?.phone, data.basics?.location, data.basics?.url].filter(Boolean).join('  |  ')}
        </Text>
      </View>

      {data.education?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          {data.education.map((edu, i) => (
            <View key={i} style={styles.itemGroup}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{edu.institution}</Text>
                <Text style={styles.itemDate}>{edu.date}</Text>
              </View>
              <View style={styles.itemHeader}>
                <Text style={styles.itemSubtitle}>{edu.degree}</Text>
                {edu.gpa && <Text style={styles.itemDate}>GPA: {edu.gpa}</Text>}
              </View>
              {edu.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
            </View>
          ))}
        </View>
      )}

      {data.experience?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {data.experience.map((exp, i) => (
            <View key={i} style={styles.itemGroup}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{exp.company}</Text>
                <Text style={styles.itemDate}>{exp.date}</Text>
              </View>
              <View style={styles.itemHeader}>
                <Text style={styles.itemSubtitle}>{exp.position}</Text>
                <Text style={styles.itemDate}>{exp.location}</Text>
              </View>
              {exp.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
            </View>
          ))}
        </View>
      )}

      {data.projects?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {data.projects.map((proj, i) => (
            <View key={i} style={styles.itemGroup}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{proj.name}</Text>
                <Text style={styles.itemDate}>{proj.date}</Text>
              </View>
              {proj.description && <Text style={styles.itemSubtitle}>{proj.description}</Text>}
              {proj.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
            </View>
          ))}
        </View>
      )}

      {data.skills?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          {data.skills.map((skill, i) => (
            <View key={i} style={styles.skillsCategory}>
              <Text style={styles.skillsTitle}>{skill.category}:</Text>
              <Text style={styles.skillsText}>{(skill.items || []).join(', ')}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

// ---------------- 2. MODERN EXECUTIVE TEMPLATE ----------------
function ModernLayout({ data, color, fonts }) {
  const styles = StyleSheet.create({
    page: { padding: 0, fontFamily: fonts.regular, fontSize: 10, lineHeight: 1.4, color: '#222' },
    banner: { backgroundColor: color, padding: 24, paddingBottom: 20 },
    name: { fontSize: 24, fontFamily: fonts.bold, color: '#FFF', marginBottom: 4 },
    contact: { fontSize: 9.5, color: '#EAF0F6' },
    body: { padding: 24, paddingTop: 18 },
    section: { marginBottom: 12 },
    sectionTitle: {
      fontSize: 11,
      fontFamily: fonts.bold,
      color: color,
      backgroundColor: '#F2F5F8',
      padding: '4 8',
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    itemGroup: { marginBottom: 8 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    itemTitle: { fontFamily: fonts.bold, fontSize: 10.5, color: '#111' },
    itemSubtitle: { fontFamily: fonts.italic, color: color },
    itemDate: { fontSize: 9, color: '#666' },
    bulletRow: { flexDirection: 'row', marginBottom: 2 },
    bulletPoint: { width: 10, fontSize: 10, color: color },
    bulletText: { flex: 1 },
    skillsCategory: { flexDirection: 'row', marginBottom: 3 },
    skillsTitle: { fontFamily: fonts.bold, width: 85, color: color },
    skillsText: { flex: 1 },
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.banner}>
        <Text style={styles.name}>{data.basics?.name}</Text>
        <Text style={styles.contact}>
          {[data.basics?.email, data.basics?.phone, data.basics?.location, data.basics?.url].filter(Boolean).join('  •  ')}
        </Text>
      </View>
      <View style={styles.body}>
        {data.experience?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Experience</Text>
            {data.experience.map((exp, i) => (
              <View key={i} style={styles.itemGroup}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{exp.company}</Text>
                  <Text style={styles.itemDate}>{exp.date}</Text>
                </View>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemSubtitle}>{exp.position}</Text>
                  <Text style={styles.itemDate}>{exp.location}</Text>
                </View>
                {exp.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}

        {data.education?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Education</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={styles.itemGroup}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{edu.institution}</Text>
                  <Text style={styles.itemDate}>{edu.date}</Text>
                </View>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemSubtitle}>{edu.degree}</Text>
                  {edu.gpa && <Text style={styles.itemDate}>GPA: {edu.gpa}</Text>}
                </View>
                {edu.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}

        {data.projects?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {data.projects.map((proj, i) => (
              <View key={i} style={styles.itemGroup}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{proj.name}</Text>
                  <Text style={styles.itemDate}>{proj.date}</Text>
                </View>
                {proj.description && <Text style={styles.itemSubtitle}>{proj.description}</Text>}
                {proj.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}

        {data.skills?.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills & Expertise</Text>
            {data.skills.map((skill, i) => (
              <View key={i} style={styles.skillsCategory}>
                <Text style={styles.skillsTitle}>{skill.category}:</Text>
                <Text style={styles.skillsText}>{(skill.items || []).join(', ')}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </Page>
  );
}

// ---------------- 3. MINIMAL COMPACT TEMPLATE ----------------
function MinimalLayout({ data, color, fonts }) {
  const styles = StyleSheet.create({
    page: { padding: 22, fontFamily: fonts.regular, fontSize: 9.5, lineHeight: 1.35, color: '#111' },
    header: { marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#DDD', paddingBottom: 6 },
    name: { fontSize: 18, fontFamily: fonts.bold, color: color },
    contact: { fontSize: 8.5, color: '#555', textAlign: 'right' },
    section: { marginBottom: 8 },
    sectionTitle: {
      fontSize: 10,
      fontFamily: fonts.bold,
      color: color,
      marginBottom: 4,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    itemGroup: { marginBottom: 5 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 1 },
    itemTitle: { fontFamily: fonts.bold, fontSize: 9.5 },
    itemSubtitle: { fontFamily: fonts.italic, color: '#444' },
    itemDate: { fontSize: 8.5, color: '#666' },
    bulletRow: { flexDirection: 'row', marginBottom: 1 },
    bulletPoint: { width: 8, fontSize: 9, color: color },
    bulletText: { flex: 1 },
    skillsCategory: { flexDirection: 'row', marginBottom: 2 },
    skillsTitle: { fontFamily: fonts.bold, width: 80, color: '#333' },
    skillsText: { flex: 1 },
  });

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{data.basics?.name}</Text>
          {data.basics?.location && <Text style={{ fontSize: 8.5, color: '#666' }}>{data.basics.location}</Text>}
        </View>
        <View style={styles.contact}>
          {data.basics?.email && <Text>{data.basics.email}</Text>}
          {data.basics?.phone && <Text>{data.basics.phone}</Text>}
          {data.basics?.url && <Text>{data.basics.url}</Text>}
        </View>
      </View>

      {data.experience?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {data.experience.map((exp, i) => (
            <View key={i} style={styles.itemGroup}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{exp.company} — {exp.position}</Text>
                <Text style={styles.itemDate}>{exp.date}</Text>
              </View>
              {exp.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
            </View>
          ))}
        </View>
      )}

      {data.education?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          {data.education.map((edu, i) => (
            <View key={i} style={styles.itemGroup}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{edu.institution} ({edu.degree})</Text>
                <Text style={styles.itemDate}>{edu.date}</Text>
              </View>
              {edu.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
            </View>
          ))}
        </View>
      )}

      {data.projects?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Projects</Text>
          {data.projects.map((proj, i) => (
            <View key={i} style={styles.itemGroup}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>{proj.name}</Text>
                <Text style={styles.itemDate}>{proj.date}</Text>
              </View>
              {proj.description && <Text style={styles.itemSubtitle}>{proj.description}</Text>}
              {proj.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
            </View>
          ))}
        </View>
      )}

      {data.skills?.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          {data.skills.map((skill, i) => (
            <View key={i} style={styles.skillsCategory}>
              <Text style={styles.skillsTitle}>{skill.category}:</Text>
              <Text style={styles.skillsText}>{(skill.items || []).join(', ')}</Text>
            </View>
          ))}
        </View>
      )}
    </Page>
  );
}

// ---------------- 4. TECH TWO-COLUMN TEMPLATE ----------------
function TechLayout({ data, color, fonts }) {
  const styles = StyleSheet.create({
    page: { padding: 0, flexDirection: 'row', fontFamily: fonts.regular, fontSize: 9.5, lineHeight: 1.4, color: '#111' },
    sidebar: { width: '32%', backgroundColor: '#F4F6F8', padding: 18, borderRightWidth: 1, borderRightColor: '#E1E6EB' },
    main: { width: '68%', padding: 20, paddingTop: 18 },
    sidebarName: { fontSize: 18, fontFamily: fonts.bold, color: color, marginBottom: 8 },
    sidebarSection: { marginBottom: 14 },
    sidebarTitle: { fontSize: 10, fontFamily: fonts.bold, color: color, textTransform: 'uppercase', marginBottom: 5, borderBottomWidth: 1, borderBottomColor: color, paddingBottom: 2 },
    sidebarText: { fontSize: 8.5, color: '#444', marginBottom: 3 },
    mainSection: { marginBottom: 12 },
    mainTitle: { fontSize: 11, fontFamily: fonts.bold, color: color, textTransform: 'uppercase', marginBottom: 8, borderBottomWidth: 1.5, borderBottomColor: color, paddingBottom: 2 },
    itemGroup: { marginBottom: 7 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    itemTitle: { fontFamily: fonts.bold, fontSize: 10 },
    itemSubtitle: { fontFamily: fonts.italic, color: color },
    itemDate: { fontSize: 8.5, color: '#666' },
    bulletRow: { flexDirection: 'row', marginBottom: 2 },
    bulletPoint: { width: 8, fontSize: 9, color: color },
    bulletText: { flex: 1 },
  });

  return (
    <Page size="A4" style={styles.page}>
      {/* Sidebar Column */}
      <View style={styles.sidebar}>
        <Text style={styles.sidebarName}>{data.basics?.name}</Text>
        
        <View style={styles.sidebarSection}>
          <Text style={styles.sidebarTitle}>Contact</Text>
          {data.basics?.email && <Text style={styles.sidebarText}>{data.basics.email}</Text>}
          {data.basics?.phone && <Text style={styles.sidebarText}>{data.basics.phone}</Text>}
          {data.basics?.location && <Text style={styles.sidebarText}>{data.basics.location}</Text>}
          {data.basics?.url && <Text style={styles.sidebarText}>{data.basics.url}</Text>}
        </View>

        {data.skills?.length > 0 && (
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarTitle}>Skills</Text>
            {data.skills.map((skill, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 8.5, color: '#222' }}>{skill.category}</Text>
                <Text style={{ fontSize: 8, color: '#555' }}>{(skill.items || []).join(', ')}</Text>
              </View>
            ))}
          </View>
        )}

        {data.education?.length > 0 && (
          <View style={styles.sidebarSection}>
            <Text style={styles.sidebarTitle}>Education</Text>
            {data.education.map((edu, i) => (
              <View key={i} style={{ marginBottom: 6 }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 8.5 }}>{edu.institution}</Text>
                <Text style={{ fontSize: 8, color: color }}>{edu.degree}</Text>
                <Text style={{ fontSize: 8, color: '#666' }}>{edu.date}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Main Content Column */}
      <View style={styles.main}>
        {data.experience?.length > 0 && (
          <View style={styles.mainSection}>
            <Text style={styles.mainTitle}>Experience</Text>
            {data.experience.map((exp, i) => (
              <View key={i} style={styles.itemGroup}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{exp.company}</Text>
                  <Text style={styles.itemDate}>{exp.date}</Text>
                </View>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemSubtitle}>{exp.position}</Text>
                  <Text style={styles.itemDate}>{exp.location}</Text>
                </View>
                {exp.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}

        {data.projects?.length > 0 && (
          <View style={styles.mainSection}>
            <Text style={styles.mainTitle}>Projects</Text>
            {data.projects.map((proj, i) => (
              <View key={i} style={styles.itemGroup}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{proj.name}</Text>
                  <Text style={styles.itemDate}>{proj.date}</Text>
                </View>
                {proj.description && <Text style={{ fontFamily: fonts.italic, fontSize: 8.5, color: '#444', marginBottom: 2 }}>{proj.description}</Text>}
                {proj.bullets?.map((b, j) => <Bullet key={j} style={styles}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}
      </View>
    </Page>
  );
}

// ---------------- MAIN EXPORT COMPONENT ----------------
export default function ResumePDF({ data, template = 'classic', primaryColor = '#0F1D2E', fontFamily = 'Helvetica' }) {
  if (!data || !data.basics) return <Document><Page /></Document>;

  const fonts = getFontVariants(fontFamily);
  const selectedColor = COLORS.find((c) => c.id === primaryColor || c.hex === primaryColor)?.hex || primaryColor;

  let content;
  switch (template) {
    case 'modern':
      content = <ModernLayout data={data} color={selectedColor} fonts={fonts} />;
      break;
    case 'minimal':
      content = <MinimalLayout data={data} color={selectedColor} fonts={fonts} />;
      break;
    case 'tech':
      content = <TechLayout data={data} color={selectedColor} fonts={fonts} />;
      break;
    case 'classic':
    default:
      content = <ClassicLayout data={data} color={selectedColor} fonts={fonts} />;
      break;
  }

  return <Document>{content}</Document>;
}
