import type { Analysis, ApplyVerdict } from '../types/domain';

function mdLine(label: string, val: string | undefined): string {
  return val ? `- **${label}:** ${val}\n` : '';
}

function applyVerdictLabel(verdict: ApplyVerdict): string {
  if (verdict === 'yes') return 'Yes';
  if (verdict === 'no') return 'No';
  return 'Maybe';
}

function skillStatusIcon(status: string): string {
  if (status === 'match') return '✓';
  if (status === 'partial') return '~';
  return '✗';
}

function fitApplySection(a: Analysis): string {
  let md = '';
  if (a.fit) {
    md += `**Fit:** ${a.fit.label} (${a.fit.score}%)`;
    if (a.fit.rationale) md += ` — ${a.fit.rationale}`;
    md += `\n`;
  }
  if (a.apply) {
    md += `**Apply?:** ${applyVerdictLabel(a.apply.verdict)}`;
    if (a.apply.rationale) md += ` — ${a.apply.rationale}`;
    md += `\n\n`;
    return md;
  }
  return `${md}\n`;
}

function mastheadSection(a: Analysis): string {
  const m = a.masthead;
  let md = `## Masthead\n`;
  md += mdLine('Work model', String(m.workModel || ''));
  md += mdLine('Travel', String(m.travel || ''));
  md += mdLine('Terms', String(m.employmentTerms || ''));
  md += mdLine('Health insurance', String(m.healthInsurance || ''));
  md += mdLine('Pay', m.payRange);
  md += mdLine('Seniority', m.seniority);
  md += mdLine('Work authorization', m.workAuthorization);
  return `${md}\n`;
}

function dealbreakersSection(a: Analysis): string {
  if (!a.dealbreakers.length) return '';
  let md = `## Dealbreakers\n`;
  for (const d of a.dealbreakers) {
    md += `- ${d.requirement} — ${d.reason || ''}\n  > ${d.evidence || ''}\n`;
  }
  return `${md}\n`;
}

function skipFlagsSection(a: Analysis): string {
  if (!a.skipFlags.length) return '';
  let md = `## Skip flags\n`;
  for (const s of a.skipFlags) {
    md += `- ${s.trigger}\n  > ${s.evidence || ''}\n`;
  }
  return `${md}\n`;
}

function skillsSection(a: Analysis): string {
  if (!a.skillMatches.length) return '';
  let md = `## Skills\n`;
  for (const s of a.skillMatches) {
    md += `- ${skillStatusIcon(s.status)} ${s.requirement} (${s.confidence})\n`;
    if (s.reason) md += `  ${s.reason}\n`;
    md += `  > ${s.evidence || ''}\n`;
  }
  return `${md}\n`;
}

export function analysisToMarkdown(
  a: Analysis | null | undefined,
  url: string
): string {
  if (!a) return '';
  const m = a.masthead;
  let md = `# ${m.organization || 'Unknown org'} — ${m.title || 'Untitled role'}\n\n`;
  md += `${url}\n\n`;
  md += fitApplySection(a);
  md += mastheadSection(a);
  if (a.geo) {
    md += `## Location\n- **${a.geo.verdict}** — ${a.geo.reason || ''}\n\n`;
  }
  md += dealbreakersSection(a);
  md += skipFlagsSection(a);
  md += skillsSection(a);
  if (a.postingSmell) md += `## Note\n${a.postingSmell}\n\n`;
  if (a.declutteredJD) md += `## Decluttered posting\n${a.declutteredJD}\n`;
  return md;
}
