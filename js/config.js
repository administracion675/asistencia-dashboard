/**
 * config.js — Centralized configuration for the Attendance Dashboard
 */

const CONFIG = {
  // ===== Google Apps Script Web App URL =====
  // Replace this with your deployed Apps Script URL
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxiJIuDNT-7glw9KZjJT_kvKe_WuRyFaUPeHA5Zw3bLOzmSntijeUeENuvKoUqnz0n_/exec',

  // ===== Month names (tab names in Google Sheets) =====
  MONTHS: [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ],

  // ===== Google Sheet ranges =====
  SHEET: {
    STUDENT_ROW_START: 5,
    STUDENT_ROW_END: 40,
    DAY_COL_START: 'L',       // Column L = index 11 (0-based)
    DAY_COL_END: 'AO',       // Column AO = index 40 (0-based)
    DAY_COL_START_INDEX: 11,  // 0-based column index for L
    DAY_COL_END_INDEX: 40,    // 0-based column index for AO
    MAX_DAYS: 30,             // L to AO = 30 columns
    DAY_HEADER_ROW: 4,       // Row 4 has day numbers
    EVAL_DAYS_CELL: 'K3',    // Total evaluated days
    SUMMARY_ROW_START: 51,
    SUMMARY_ROW_END: 58,
    JORNADA_COL: 'J',        // Column J = Jornada (Mañana/Tarde)
    JORNADA_COL_INDEX: 9,    // 0-based
  },

  // ===== Student data columns (A through K) =====
  STUDENT_COLUMNS: {
    ID: 0,          // Column A
    EDAD: 1,        // Column B
    GENERO: 2,      // Column C
    GRUPO: 3,       // Column D
    NOMBRE: 4,      // Column E
    APELLIDO: 5,    // Column F
    // Columns G, H, I may vary
    JORNADA: 9,     // Column J
    PCT_ASISTENCIA: 10, // Column K (% Asistencia)
  },

  // ===== Attendance codes =====
  ATTENDANCE_CODES: {
    AG:  { label: 'Asistió',          short: 'AG',  color: '#10b981', bgClass: 'bg-emerald-500', textClass: 'text-white' },
    AM:  { label: 'Falta Injust.',    short: 'AM',  color: '#ef4444', bgClass: 'bg-red-500',     textClass: 'text-white' },
    PU:  { label: 'Falta Just.',      short: 'PU',  color: '#f97316', bgClass: 'bg-orange-500',  textClass: 'text-white' },
    HEC: { label: 'Extracurricular',  short: 'HEC', color: '#8b5cf6', bgClass: 'bg-violet-500',  textClass: 'text-white' },
    EFM: { label: 'Enfermedad',       short: 'EFM', color: '#eab308', bgClass: 'bg-yellow-500',  textClass: 'text-black' },
    SPD: { label: 'Suspendido',       short: 'SPD', color: '#64748b', bgClass: 'bg-slate-500',   textClass: 'text-white' },
  },

  // Ordered code keys for UI rendering
  ATTENDANCE_CODE_ORDER: ['AG', 'AM', 'PU', 'HEC', 'EFM', 'SPD'],

  // ===== Absence codes (everything except AG) for charts =====
  ABSENCE_CODES: ['AM', 'PU', 'HEC', 'EFM', 'SPD'],

  // ===== Alert threshold =====
  ALERT_THRESHOLD: 0.80, // 80% — students below this trigger alerts

  // ===== UI Navigation =====
  VIEWS: {
    DASHBOARD: 'dashboard',
    FORM: 'form',
    REPORTS: 'reports',    // Future
    STUDENTS: 'students',  // Future
  },

  // ===== Summary row labels (rows 51-58 in the sheet) =====
  SUMMARY_LABELS: {
    NINOS_MANANA: 0,    // Index within summary rows
    NINOS_TARDE: 1,
    DESAYUNOS: 2,
    ALMUERZOS: 3,
    ALGOS: 4,
    // Additional rows may exist (5-7)
  },
};

// Freeze to prevent accidental mutation
Object.freeze(CONFIG);
Object.freeze(CONFIG.SHEET);
Object.freeze(CONFIG.STUDENT_COLUMNS);
Object.freeze(CONFIG.ATTENDANCE_CODES);
Object.freeze(CONFIG.VIEWS);
Object.freeze(CONFIG.SUMMARY_LABELS);
