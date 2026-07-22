/**
 * state.js — Centralized reactive store for the Attendance Dashboard.
 * Implements a simple pub/sub pattern so all UI modules react to state changes.
 */

const Store = (() => {
  // ===== Private state =====
  let _state = {
    currentView: CONFIG.VIEWS.DASHBOARD,
    currentMonth: CONFIG.MONTHS[new Date().getMonth()], // Default to current month
    currentDay: null,        // Selected day in the form (1-31)

    students: [],            // Array of student objects (rows 5-40)
    attendance: [],          // 2D array [studentIndex][dayIndex] of attendance codes
    dayHeaders: [],          // Array of day numbers from row 4 (e.g. [1,2,3,...31])
    evalDays: 0,             // K3 — total evaluated days
    summaryRows: [],         // 2D array from rows 51-58

    loading: false,          // Global loading indicator
    saving: false,           // Saving indicator for form
    error: null,             // Error message string or null
    successMessage: null,    // Transient success message

    dataLoaded: false,       // Whether data for currentMonth has been fetched
    pendingChanges: {},      // { dayIndex: { studentIndex: code } } — unsaved form changes
  };

  // ===== Subscribers =====
  const _subscribers = new Map(); // key -> Set<callback>

  /**
   * Get a shallow clone of the current state.
   */
  function getState() {
    return { ..._state };
  }

  /**
   * Get a specific state property.
   */
  function get(key) {
    return _state[key];
  }

  /**
   * Update state with partial changes and notify subscribers.
   * @param {Object} partial — key/value pairs to merge
   */
  function setState(partial) {
    const changedKeys = [];
    for (const key of Object.keys(partial)) {
      if (_state[key] !== partial[key]) {
        _state[key] = partial[key];
        changedKeys.push(key);
      }
    }
    // Notify subscribers of changed keys
    for (const key of changedKeys) {
      if (_subscribers.has(key)) {
        for (const cb of _subscribers.get(key)) {
          try { cb(_state[key], key); } catch (e) { console.error(`Store subscriber error [${key}]:`, e); }
        }
      }
    }
    // Always notify wildcard subscribers
    if (changedKeys.length > 0 && _subscribers.has('*')) {
      for (const cb of _subscribers.get('*')) {
        try { cb(_state, changedKeys); } catch (e) { console.error('Store wildcard subscriber error:', e); }
      }
    }
  }

  /**
   * Subscribe to state changes.
   * @param {string|string[]} keys — state key(s) to watch, or '*' for any change
   * @param {Function} callback — called with (newValue, key)
   * @returns {Function} unsubscribe function
   */
  function subscribe(keys, callback) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const key of keyList) {
      if (!_subscribers.has(key)) {
        _subscribers.set(key, new Set());
      }
      _subscribers.get(key).add(callback);
    }
    return () => {
      for (const key of keyList) {
        _subscribers.get(key)?.delete(callback);
      }
    };
  }

  // ===== Computed Getters =====

  /**
   * Calculate attendance percentage for a specific student.
   * @param {number} studentIndex — index in the students array
   * @returns {number} percentage 0-100
   */
  function getStudentAttendancePct(studentIndex) {
    const evalDays = _state.evalDays || 0;
    if (evalDays === 0) return 0;
    const row = _state.attendance[studentIndex] || [];
    const agCount = row.filter(v => v === 'AG').length;
    return (agCount / evalDays) * 100;
  }

  /**
   * Get average attendance % across all students.
   * @returns {number} percentage 0-100
   */
  function getAverageAttendancePct() {
    const students = _state.students || [];
    if (students.length === 0) return 0;
    let total = 0;
    for (let i = 0; i < students.length; i++) {
      total += getStudentAttendancePct(i);
    }
    return total / students.length;
  }

  /**
   * Get total count of a specific attendance code across all students and all days.
   * @param {string} code — e.g. 'AM', 'PU', 'EFM', 'SPD'
   * @returns {number}
   */
  function getCodeCount(code) {
    let count = 0;
    for (const row of _state.attendance) {
      for (const cell of row) {
        if (cell === code) count++;
      }
    }
    return count;
  }

  /**
   * Get students below the alert threshold.
   * @returns {Array<{student, index, pct}>}
   */
  function getAlertStudents() {
    const threshold = CONFIG.ALERT_THRESHOLD * 100;
    const alerts = [];
    for (let i = 0; i < _state.students.length; i++) {
      const pct = getStudentAttendancePct(i);
      if (pct < threshold) {
        alerts.push({
          student: _state.students[i],
          index: i,
          pct: pct,
        });
      }
    }
    // Sort ascending by percentage (worst first)
    alerts.sort((a, b) => a.pct - b.pct);
    return alerts;
  }

  /**
   * Safely parse a value into a number. Handles #VALUE!, #REF!, null,
   * undefined, empty strings, NaN, Infinity, and non-numeric strings.
   * @param {*} val - raw value from the sheet
   * @returns {number} a safe numeric value, or 0
   */
  function _safeNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'boolean') return 0;
    if (typeof val === 'number') return (isFinite(val) && !isNaN(val)) ? val : 0;
    if (typeof val === 'string') {
      const t = val.trim();
      if (t === '' || t.charAt(0) === '#' || t === 'NaN' || t === 'Infinity') return 0;
      const n = Number(t);
      return (isFinite(n) && !isNaN(n)) ? n : 0;
    }
    return 0;
  }

  /**
   * Get accumulated summary totals (sum each summary row across all day columns).
   * Uses robust validation to skip error cells (#VALUE!, etc.).
   * Returns an object with totals for each summary row.
   */
  function getSummaryTotals() {
    const rows = _state.summaryRows || [];
    const totals = {};
    const labels = ['ninosManana', 'ninosTarde', 'desayunos', 'almuerzos', 'algos'];
    for (let i = 0; i < Math.min(rows.length, labels.length); i++) {
      totals[labels[i]] = (rows[i] || []).reduce((sum, val) => {
        return sum + _safeNumber(val);
      }, 0);
    }
    return totals;
  }

  /**
   * Get daily attendance counts for Mañana and Tarde from summary rows.
   * Returns {manana: number[], tarde: number[], days: number[]}
   */
  function getDailyJornadaCounts() {
    const rows = _state.summaryRows || [];
    const days = _state.dayHeaders || [];
    const manana = (rows[0] || []).map(v => parseFloat(v) || 0);
    const tarde = (rows[1] || []).map(v => parseFloat(v) || 0);
    return { manana, tarde, days };
  }

  /**
   * Get the attendance data for a specific day across all students.
   * @param {number} dayIndex — 0-based index into dayHeaders
   * @returns {string[]} array of attendance codes per student
   */
  function getDayAttendance(dayIndex) {
    return _state.attendance.map(row => row[dayIndex] || '');
  }

  /**
   * Update a pending change in the form (not yet saved).
   */
  function setPendingChange(dayIndex, studentIndex, code) {
    const pending = { ..._state.pendingChanges };
    if (!pending[dayIndex]) pending[dayIndex] = {};
    pending[dayIndex][studentIndex] = code;
    setState({ pendingChanges: pending });
  }

  /**
   * Apply pending changes to the local attendance data (after successful save).
   */
  function applyPendingChanges(dayIndex) {
    const pending = _state.pendingChanges[dayIndex];
    if (!pending) return;

    const newAttendance = _state.attendance.map(row => [...row]);
    for (const [studentIdx, code] of Object.entries(pending)) {
      const idx = parseInt(studentIdx);
      if (newAttendance[idx]) {
        newAttendance[idx][dayIndex] = code;
      }
    }

    // Clear pending for this day
    const newPending = { ..._state.pendingChanges };
    delete newPending[dayIndex];

    setState({
      attendance: newAttendance,
      pendingChanges: newPending,
    });
  }

  /**
   * Clear all transient messages after a delay.
   */
  function clearMessages(delayMs = 4000) {
    setTimeout(() => {
      setState({ error: null, successMessage: null });
    }, delayMs);
  }

  // ===== Public API =====
  return {
    getState,
    get,
    setState,
    subscribe,
    getStudentAttendancePct,
    getAverageAttendancePct,
    getCodeCount,
    getAlertStudents,
    getSummaryTotals,
    getDailyJornadaCounts,
    getDayAttendance,
    setPendingChange,
    applyPendingChanges,
    clearMessages,
  };
})();
