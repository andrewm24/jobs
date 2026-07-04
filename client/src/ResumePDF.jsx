import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

// A clean, standard resume style
const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    color: '#000',
  },
  header: {
    marginBottom: 10,
    textAlign: 'center',
  },
  name: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  contact: {
    fontSize: 9,
    color: '#333',
  },
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    borderBottomStyle: 'solid',
    paddingBottom: 2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  itemGroup: {
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontFamily: 'Helvetica-Bold',
  },
  itemSubtitle: {
    fontFamily: 'Helvetica-Oblique',
  },
  itemDate: {
    fontSize: 9,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  bulletPoint: {
    width: 10,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
  },
  skillsCategory: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  skillsTitle: {
    fontFamily: 'Helvetica-Bold',
    width: 80,
  },
  skillsText: {
    flex: 1,
  }
});

const Bullet = ({ children }) => (
  <View style={styles.bulletRow}>
    <Text style={styles.bulletPoint}>•</Text>
    <Text style={styles.bulletText}>{children}</Text>
  </View>
);

export default function ResumePDF({ data }) {
  if (!data || !data.basics) return <Document><Page /></Document>;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.name}>{data.basics.name}</Text>
          <Text style={styles.contact}>
            {[data.basics.email, data.basics.phone, data.basics.location, data.basics.url].filter(Boolean).join('  |  ')}
          </Text>
        </View>

        {data.education && data.education.length > 0 && (
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
                {edu.bullets && edu.bullets.map((b, j) => <Bullet key={j}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}

        {data.experience && data.experience.length > 0 && (
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
                {exp.bullets && exp.bullets.map((b, j) => <Bullet key={j}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}

        {data.projects && data.projects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Projects</Text>
            {data.projects.map((proj, i) => (
              <View key={i} style={styles.itemGroup}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{proj.name}</Text>
                  <Text style={styles.itemDate}>{proj.date}</Text>
                </View>
                {proj.description && <Text style={styles.itemSubtitle}>{proj.description}</Text>}
                {proj.bullets && proj.bullets.map((b, j) => <Bullet key={j}>{b}</Bullet>)}
              </View>
            ))}
          </View>
        )}

        {data.skills && data.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            {data.skills.map((skill, i) => (
              <View key={i} style={styles.skillsCategory}>
                <Text style={styles.skillsTitle}>{skill.category}:</Text>
                <Text style={styles.skillsText}>{skill.items.join(', ')}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>
    </Document>
  );
}
