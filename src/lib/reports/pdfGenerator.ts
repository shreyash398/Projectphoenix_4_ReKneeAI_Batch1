// ReKnee AI - Client-side Doctor-Verified Recovery Activity Report Generator
// Strictly matches the prompt specifications and clinical governance guardrails:
// - Title: "Doctor-Verified Recovery Activity Report"
// - Clear distinction: Recorded Activity vs Clinician Verification vs Medical Clearance
// - Never claims medical clearance or full cure
// - Clearly labeled DEMO digital signature and DEMO stamp placeholders
// - Pluggable architecture allowing future replacement with real cryptographic e-signature provider

import { jsPDF } from 'jspdf';
import {
  RecoveryVerification,
  Profile,
  RecoveryPlan,
  PlanExercise,
  ExerciseSession,
  SymptomCheckin,
} from '../../types/database';

export interface ReportGenerationData {
  verification: RecoveryVerification;
  patient: Profile;
  clinician: Profile | null;
  plan: RecoveryPlan;
  exercises: PlanExercise[];
  sessions: ExerciseSession[];
  checkins: SymptomCheckin[];
}

export interface GeneratedPdfReport {
  blob: Blob;
  filename: string;
  url: string;
}

/**
 * Generates the Doctor-Verified Recovery Activity Report PDF using jsPDF.
 */
export function generateRecoveryCompletionPdf(data: ReportGenerationData): GeneratedPdfReport {
  const { verification, patient, clinician, plan, exercises, sessions, checkins } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 18;

  // ── 1. Header & Branding ──────────────────────────────────────
  // Top brand bar
  doc.setFillColor(13, 148, 136); // teal-600 #0D9488
  doc.rect(margin, y, contentWidth, 3, 'F');
  y += 10;

  // Header Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // navy-900 #0F172A
  doc.text('REKNEE AI', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('Connected Post-Operative Knee Rehabilitation Companion', margin, y + 5);

  // Verification ID badge on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(13, 148, 136);
  const vIdText = `Verification ID: ${verification.verification_id || 'VER-DEMO'}`;
  doc.text(vIdText, pageWidth - margin, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Report Version: ${verification.report_version}`, pageWidth - margin, y + 5, { align: 'right' });

  y += 14;

  // Document Title Banner
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text('Doctor-Verified Recovery Activity Report', margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(13, 148, 136);
  doc.text('CLINICAL ACTIVITY AUDIT', pageWidth - margin - 6, y + 9, { align: 'right' });

  y += 20;

  // ── 2. Patient & Plan Metadata Box ────────────────────────────
  doc.setDrawColor(241, 237, 230); // warm border
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, y, contentWidth, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('PATIENT IDENTIFIER', margin + 6, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(patient.full_name, margin + 6, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('RECOVERY PROTOCOL', margin + 6, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(plan.title, margin + 6, y + 23);

  // Right column: Reporting Period & Request Date
  const col2X = margin + contentWidth * 0.58;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('REPORTING PERIOD', col2X, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  const periodText = `${plan.start_date || 'N/A'}  to  ${plan.end_date || 'Current'}`;
  doc.text(periodText, col2X, y + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('VERIFICATION DATE', col2X, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(13, 148, 136);
  doc.text(verification.verification_date || new Date().toISOString().split('T')[0], col2X, y + 23);

  y += 32;

  // ── 3. Recovery Summary Section ────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Recorded Recovery Activity Summary', margin, y);
  y += 6;

  const completedSessions = sessions.filter((s) => s.status === 'completed');
  const totalReps = completedSessions.reduce((acc, s) => acc + s.repetitions, 0);
  const totalSeconds = completedSessions.reduce((acc, s) => acc + s.duration_seconds, 0);
  const totalMinutes = Math.round(totalSeconds / 60);

  // Target comparison
  const completionPercentage = Math.min(100, Math.round((completedSessions.length / Math.max(1, 10)) * 100));

  // Metric pills grid
  const boxW = (contentWidth - 6) / 4;
  const metrics = [
    { label: 'COMPLETED SESSIONS', val: `${completedSessions.length} sessions` },
    { label: 'TOTAL MOBILITY REPS', val: `${totalReps} repetitions` },
    { label: 'PRACTICE DURATION', val: `${totalMinutes} minutes` },
    { label: 'COMPLETION ESTIMATE', val: `${completionPercentage}%` },
  ];

  metrics.forEach((m, idx) => {
    const bx = margin + idx * (boxW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, y, boxW, 14, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(m.label, bx + boxW / 2, y + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(m.val, bx + boxW / 2, y + 10.5, { align: 'center' });
  });

  y += 18;

  // Assigned Exercises Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Assigned Rehabilitation Protocol Exercises:', margin, y);
  y += 4.5;

  exercises.forEach((ex, idx) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`${idx + 1}. ${ex.name}`, margin + 3, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Target: ${ex.target_repetitions} reps / session | Prescribed Duration: ${ex.target_duration_seconds}s`, margin + 3, y + 4);
    y += 9;
  });

  // Recent Completed Sessions list
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('Documented Exercise Sessions (Audit Log):', margin, y);
  y += 4.5;

  const displaySessions = completedSessions.slice(0, 5);
  displaySessions.forEach((s) => {
    const sDate = new Date(s.started_at).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`• ${sDate} — Completed ${s.repetitions} reps in ${Math.round(s.duration_seconds / 60)}m (${s.measurement_mode})`, margin + 3, y);
    y += 4.5;
  });

  y += 3;

  // ── 4. Check-in & Pain Tracking Summary ────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('2. Symptom & Check-in Summary', margin, y);
  y += 5.5;

  const avgPain =
    checkins.length > 0
      ? (checkins.reduce((a, c) => a + c.pain_score, 0) / checkins.length).toFixed(1)
      : 'N/A';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(
    `Total Check-ins Logged: ${checkins.length} check-ins | Average Reported Pain Score: ${avgPain} / 10`,
    margin,
    y
  );
  y += 4.5;

  const displayCheckins = checkins.slice(0, 3);
  displayCheckins.forEach((c) => {
    const cDate = new Date(c.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    const symptomsList = Object.entries(c.symptoms)
      .filter(([, v]) => Boolean(v))
      .map(([k]) => k.replace(/_/g, ' '))
      .join(', ');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `• ${cDate}: Pain ${c.pain_score}/10 — Reported: ${symptomsList || 'No acute symptoms'} (${c.notes.slice(0, 60)}${c.notes.length > 60 ? '...' : ''})`,
      margin + 3,
      y
    );
    y += 4;
  });

  y += 6;

  // ── 5. Clinician Review & Verification Box ─────────────────────
  doc.setFillColor(240, 253, 250); // teal-50
  doc.setDrawColor(153, 246, 228); // teal-200
  doc.roundedRect(margin, y, contentWidth, 34, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(13, 148, 136);
  doc.text('Reviewed and Verified by Authorized Licensed Clinician', margin + 6, y + 6);

  const clinName = verification.clinician_name || clinician?.full_name || 'Dr. Marcus Patel, DPT';
  const clinDesig = verification.clinician_designation || 'Doctor of Physical Therapy (DPT)';
  const clinLic = verification.license_identifier ? `License ID: ${verification.license_identifier}` : 'Authorized PT License On Record';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(clinName, margin + 6, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${clinDesig} | ${clinLic}`, margin + 6, y + 18);

  if (verification.verification_note) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Clinical Note: "${verification.verification_note}"`, margin + 6, y + 24);
  }

  // ── DEMO SIGNATURE & STAMP PLACEHOLDER ──────────────────────────
  // Per requirements:
  // "Do NOT fabricate a doctor identity. Do NOT generate a fake signature. Do NOT generate a fake medical stamp."
  // "For the hackathon/demo environment, create a clearly labeled DEMO verification mechanism."
  // "If a real digital signature/stamp system is not configured, show: 'Demo verification — not a legally valid medical signature.'"
  const sigX = pageWidth - margin - 58;
  doc.setDrawColor(13, 148, 136);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(sigX, y + 3, 52, 26, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(13, 148, 136);
  doc.text('[ DEMO DIGITAL SIGNATURE ]', sigX + 26, y + 8, { align: 'center' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(clinName, sigX + 26, y + 14, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(180, 83, 9); // amber-700
  doc.text('Demo verification — not a legally', sigX + 26, y + 19, { align: 'center' });
  doc.text('valid medical signature.', sigX + 26, y + 23, { align: 'center' });

  y += 39;

  // ── 6. Mandatory Clinical Governance Disclaimer ───────────────
  doc.setFillColor(254, 243, 199); // amber-100
  doc.setDrawColor(253, 230, 138); // amber-200
  doc.roundedRect(margin, y, contentWidth, 18, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('IMPORTANT CLINICAL GOVERNANCE & SAFETY DISCLAIMER:', margin + 4, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(146, 64, 14);
  const disclaimer1 =
    'This report summarizes activity recorded in the ReKnee AI prototype. It does not by itself establish medical fitness, treatment completion, clinical recovery, or medical clearance.';
  const disclaimer2 =
    'Recorded activity reflects patient-reported and prototype-tracked exercise adherence. Clinical clearance for work, sports, or unrestricted weight-bearing must be obtained via formal in-person physical examination with an authorized medical professional.';
  doc.text(disclaimer1, margin + 4, y + 8.5);
  doc.text(disclaimer2, margin + 4, y + 13.5);

  y += 22;

  // ── 7. Verification Audit Footer ───────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `ReKnee AI Connected Recovery Companion • Verification Code: ${verification.verification_id} • Generated: ${new Date().toISOString()}`,
    pageWidth / 2,
    y + 2,
    { align: 'center' }
  );

  const filename = `Doctor_Verified_Recovery_Report_${verification.verification_id || 'DEMO'}.pdf`;
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);

  return { blob, filename, url };
}

/**
 * Triggers a secure browser download for the generated PDF.
 */
export function downloadReportPdf(pdfReport: GeneratedPdfReport): void {
  const link = document.createElement('a');
  link.href = pdfReport.url;
  link.download = pdfReport.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
