/* =====================================================================
   FormModule — Attendance Form (Daily Registration)
   =====================================================================
   Renders into #view-content.  Depends on CONFIG, Store, API globals.
   ===================================================================== */

// eslint-disable-next-line no-unused-vars
var FormModule = (function () {
  'use strict';

  /* -------------------------------------------------------------------
     Private state
     ------------------------------------------------------------------- */
  var _subscriptions = [];   // Store‑subscription teardown handles
  var _abortController = null; // DOM event‑delegation controller

  /* -------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------- */

  /** Safely query inside #view-content */
  function _qs(sel) {
    var root = document.getElementById('view-content');
    return root ? root.querySelector(sel) : null;
  }

  /** Build a className string from an array, filtering falsy values */
  function _cx(classes) {
    return classes.filter(Boolean).join(' ');
  }

  /** Return the ATTENDANCE_CODES config entry for a given code key */
  function _codeConfig(code) {
    return CONFIG.ATTENDANCE_CODES[code] || {};
  }

  /** Return the color class for a jornada value */
  function _jornadaBadge(jornada) {
    var lower = (jornada || '').toLowerCase();
    if (lower.indexOf('tarde') !== -1) {
      return {
        bg: 'bg-teal-500/20',
        text: 'text-teal-300',
        border: 'border-teal-500/30'
      };
    }
    // Default: Mañana
    return {
      bg: 'bg-blue-500/20',
      text: 'text-blue-300',
      border: 'border-blue-500/30'
    };
  }

  /** Return the Tailwind color classes for a code when active */
  function _activeCodeClasses(code) {
    var cfg = _codeConfig(code);
    var color = (cfg.color || '#3b82f6').toLowerCase();
    // Map hex colors to Tailwind utilities
    var map = {
      '#22c55e': { bg: 'bg-green-500', ring: 'ring-green-400/50', text: 'text-white', shadow: 'shadow-green-500/30' },
      '#f59e0b': { bg: 'bg-amber-500', ring: 'ring-amber-400/50', text: 'text-white', shadow: 'shadow-amber-500/30' },
      '#ef4444': { bg: 'bg-red-500', ring: 'ring-red-400/50', text: 'text-white', shadow: 'shadow-red-500/30' },
      '#8b5cf6': { bg: 'bg-violet-500', ring: 'ring-violet-400/50', text: 'text-white', shadow: 'shadow-violet-500/30' },
      '#3b82f6': { bg: 'bg-blue-500', ring: 'ring-blue-400/50', text: 'text-white', shadow: 'shadow-blue-500/30' },
      '#06b6d4': { bg: 'bg-cyan-500', ring: 'ring-cyan-400/50', text: 'text-white', shadow: 'shadow-cyan-500/30' },
      '#ec4899': { bg: 'bg-pink-500', ring: 'ring-pink-400/50', text: 'text-white', shadow: 'shadow-pink-500/30' },
      '#f97316': { bg: 'bg-orange-500', ring: 'ring-orange-400/50', text: 'text-white', shadow: 'shadow-orange-500/30' },
      '#14b8a6': { bg: 'bg-teal-500', ring: 'ring-teal-400/50', text: 'text-white', shadow: 'shadow-teal-500/30' },
      '#6366f1': { bg: 'bg-indigo-500', ring: 'ring-indigo-400/50', text: 'text-white', shadow: 'shadow-indigo-500/30' }
    };
    return map[color] || { bg: 'bg-blue-500', ring: 'ring-blue-400/50', text: 'text-white', shadow: 'shadow-blue-500/30' };
  }

  /* -------------------------------------------------------------------
     Toast helpers
     ------------------------------------------------------------------- */

  function _showToast(message, type) {
    // Remove any existing toast
    _hideToast();

    var isError = type === 'error';
    var toast = document.createElement('div');
    toast.id = 'form-toast';
    toast.className = _cx([
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl',
      'backdrop-blur-xl border transition-all duration-300 transform translate-y-4 opacity-0',
      isError
        ? 'bg-red-500/20 border-red-500/30 text-red-200'
        : 'bg-green-500/20 border-green-500/30 text-green-200'
    ]);
    toast.innerHTML =
      '<span class="text-lg">' + (isError ? '⚠️' : '✅') + '</span>' +
      '<span class="text-sm font-medium">' + _escHtml(message) + '</span>';

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(function () {
      toast.classList.remove('translate-y-4', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto‑hide after 4s
    setTimeout(function () { _hideToast(); }, 4000);
  }

  function _hideToast() {
    var existing = document.getElementById('form-toast');
    if (existing) {
      existing.classList.add('translate-y-4', 'opacity-0');
      setTimeout(function () { existing && existing.remove(); }, 300);
    }
  }

  function _escHtml(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  /* -------------------------------------------------------------------
     HTML builders
     ------------------------------------------------------------------- */

  /** Main container */
  function _buildRoot() {
    return '<div id="form-root" class="space-y-6">' +
      _buildDaySelector() +
      _buildQuickActions() +
      _buildStudentGrid() +
      _buildSaveBar() +
      '</div>';
  }

  /** Day selector card */
  function _buildDaySelector() {
    var dayHeaders = Store.get('dayHeaders') || [];
    var currentDay = Store.get('currentDay');
    var currentMonth = Store.get('currentMonth');
    var monthName = (CONFIG.MONTHS && CONFIG.MONTHS[currentMonth]) || 'Mes';

    var pills = '';
    for (var i = 0; i < dayHeaders.length; i++) {
      if (dayHeaders[i] == null) continue;
      var isActive = currentDay === i;
      pills += '<button data-day-index="' + i + '" class="' +
        _cx([
          'w-10 h-10 rounded-full text-sm font-semibold flex items-center justify-center',
          'transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-400/50',
          isActive
            ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110'
            : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-200'
        ]) + '">' + dayHeaders[i] + '</button>';
    }

    return '' +
      '<div class="relative rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 shadow-xl">' +
        '<div class="flex flex-col sm:flex-row sm:items-center gap-4">' +
          '<label class="text-sm font-medium text-gray-300 whitespace-nowrap">' +
            '📅 Seleccionar Día <span class="text-gray-500">(' + _escHtml(monthName) + ')</span>:' +
          '</label>' +
          '<div class="flex flex-wrap gap-2">' +
            pills +
          '</div>' +
        '</div>' +
      '</div>';
  }

  /** Quick‑actions bar */
  function _buildQuickActions() {
    var currentDay = Store.get('currentDay');
    if (currentDay == null) return '';

    return '' +
      '<div class="flex flex-wrap items-center gap-3 px-1">' +
        '<span class="text-xs text-gray-500 uppercase tracking-wider font-semibold">Acciones rápidas</span>' +
        '<button id="qa-mark-ag" class="' +
          'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ' +
          'bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-green-500/25 hover:scale-105' +
        '">Marcar Todos AG</button>' +
        '<button id="qa-mark-am" class="' +
          'px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ' +
          'bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25 hover:scale-105' +
        '">Marcar Todos AM</button>' +
      '</div>';
  }

  /** Student attendance grid */
  function _buildStudentGrid() {
    var currentDay = Store.get('currentDay');
    if (currentDay == null) {
      return '' +
        '<div class="flex flex-col items-center justify-center py-20 text-gray-500">' +
          '<span class="text-5xl mb-4">📋</span>' +
          '<p class="text-lg font-medium">Selecciona un día para registrar asistencia</p>' +
          '<p class="text-sm text-gray-600 mt-1">Haz clic en un número de día arriba</p>' +
        '</div>';
    }

    var students = Store.get('students') || [];
    var dayAttendance = Store.getDayAttendance(currentDay) || [];
    var codes = CONFIG.ATTENDANCE_CODE_ORDER || [];

    // Header
    var header = '' +
      '<thead>' +
        '<tr class="text-xs uppercase tracking-wider text-gray-400 border-b border-white/10">' +
          '<th class="py-3 px-3 text-left w-10">#</th>' +
          '<th class="py-3 px-3 text-left w-20">ID</th>' +
          '<th class="py-3 px-3 text-left">Alumno</th>' +
          '<th class="py-3 px-3 text-center w-24">Jornada</th>' +
          '<th class="py-3 px-4 text-center">Asistencia</th>' +
        '</tr>' +
      '</thead>';

    // Rows
    var rows = '';
    for (var s = 0; s < students.length; s++) {
      var st = students[s];
      var currentCode = dayAttendance[s] || 'AG';
      var jBadge = _jornadaBadge(st.jornada);
      var isEven = s % 2 === 0;

      // Build pill buttons
      var pills = '';
      for (var c = 0; c < codes.length; c++) {
        var code = codes[c];
        var cfg = _codeConfig(code);
        var isActive = currentCode === code;
        var activeCls = _activeCodeClasses(code);

        pills += '<button data-student="' + s + '" data-code="' + code + '" class="' +
          _cx([
            'attendance-pill px-2.5 py-1 rounded-lg text-xs font-bold',
            'transition-all duration-150 focus:outline-none',
            isActive
              ? activeCls.bg + ' ' + activeCls.text + ' ' + activeCls.shadow + ' shadow-md scale-105 ring-2 ' + activeCls.ring
              : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-300'
          ]) + '" title="' + _escHtml(cfg.label || code) + '">' +
          _escHtml(cfg.short || code) + '</button>';
      }

      rows += '' +
        '<tr class="' + _cx([
          'group transition-colors duration-150',
          isEven ? 'bg-white/[0.02]' : '',
          'hover:bg-white/[0.06]'
        ]) + '" data-student-row="' + s + '">' +
          '<td class="py-3 px-3 text-sm text-gray-500 font-mono">' + (s + 1) + '</td>' +
          '<td class="py-3 px-3 text-sm text-gray-400 font-mono">' + _escHtml(st.id) + '</td>' +
          '<td class="py-3 px-3 text-sm text-gray-200 font-medium">' +
            _escHtml((st.nombre || '') + ' ' + (st.apellido || '')) +
          '</td>' +
          '<td class="py-3 px-3 text-center">' +
            '<span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ' +
              jBadge.bg + ' ' + jBadge.text + ' ' + jBadge.border + '">' +
              _escHtml(st.jornada || '—') +
            '</span>' +
          '</td>' +
          '<td class="py-3 px-4">' +
            '<div class="flex items-center justify-center gap-1.5">' + pills + '</div>' +
          '</td>' +
        '</tr>';
    }

    return '' +
      '<div class="relative rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden">' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full text-left" id="attendance-table">' +
            header +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>';
  }

  /** Save bar */
  function _buildSaveBar() {
    var currentDay = Store.get('currentDay');
    if (currentDay == null) return '';

    var dayHeaders = Store.get('dayHeaders') || [];
    var dayLabel = dayHeaders[currentDay] || currentDay;
    var saving = Store.get('saving');

    return '' +
      '<div class="flex items-center justify-end gap-4 pt-2">' +
        '<button id="btn-save-attendance" ' +
          (saving ? 'disabled ' : '') +
          'class="' + _cx([
            'relative inline-flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-semibold',
            'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50',
            saving
              ? 'bg-blue-500/30 text-blue-300/60 cursor-not-allowed'
              : 'bg-blue-500 text-white hover:bg-blue-600 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.02] active:scale-[0.98]'
          ]) + '">' +
          (saving
            ? '<svg class="animate-spin h-4 w-4 text-blue-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">' +
                '<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>' +
                '<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>' +
              '</svg>'
            : '<span>💾</span>') +
          '<span>Guardar Asistencia del Día ' + _escHtml(String(dayLabel)) + '</span>' +
        '</button>' +
      '</div>';
  }

  /* -------------------------------------------------------------------
     Re‑render helpers (partial updates where possible)
     ------------------------------------------------------------------- */

  function _fullRender() {
    var root = document.getElementById('view-content');
    if (!root) return;
    root.innerHTML = _buildRoot();
    _attachEvents();
  }

  function _rerenderGrid() {
    // Rebuild just the student grid + quick actions + save bar
    var formRoot = document.getElementById('form-root');
    if (!formRoot) { _fullRender(); return; }
    // Rebuild entire form root to keep it simple and avoid stale references
    var root = document.getElementById('view-content');
    if (!root) return;
    root.innerHTML = _buildRoot();
    _attachEvents();
  }

  /* -------------------------------------------------------------------
     Event handling (delegation)
     ------------------------------------------------------------------- */

  function _attachEvents() {
    // Tear down previous controller
    if (_abortController) _abortController.abort();
    _abortController = new AbortController();
    var signal = _abortController.signal;

    var root = document.getElementById('view-content');
    if (!root) return;

    // Day selector
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-day-index]');
      if (!btn) return;
      var dayIndex = parseInt(btn.getAttribute('data-day-index'), 10);
      if (isNaN(dayIndex)) return;
      Store.setState({ currentDay: dayIndex });
      _rerenderGrid();
    }, { signal: signal });

    // Attendance pills (delegated)
    root.addEventListener('click', function (e) {
      var pill = e.target.closest('.attendance-pill');
      if (!pill) return;
      var studentIndex = parseInt(pill.getAttribute('data-student'), 10);
      var code = pill.getAttribute('data-code');
      var currentDay = Store.get('currentDay');
      if (currentDay == null || isNaN(studentIndex) || !code) return;

      // Track pending change
      Store.setPendingChange(currentDay, studentIndex, code);

      // Update pills visually (in the same row)
      var row = pill.closest('tr');
      if (row) {
        var allPills = row.querySelectorAll('.attendance-pill');
        for (var i = 0; i < allPills.length; i++) {
          var p = allPills[i];
          var pCode = p.getAttribute('data-code');
          var isNowActive = pCode === code;
          var activeCls = _activeCodeClasses(pCode);
          // Reset all classes
          p.className = _cx([
            'attendance-pill px-2.5 py-1 rounded-lg text-xs font-bold',
            'transition-all duration-150 focus:outline-none',
            isNowActive
              ? activeCls.bg + ' ' + activeCls.text + ' ' + activeCls.shadow + ' shadow-md scale-105 ring-2 ' + activeCls.ring
              : 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-gray-300'
          ]);
        }
      }
    }, { signal: signal });

    // Quick Actions — Mark All AG
    var qaAg = document.getElementById('qa-mark-ag');
    if (qaAg) {
      qaAg.addEventListener('click', function () { _markAll('AG'); }, { signal: signal });
    }

    // Quick Actions — Mark All AM
    var qaAm = document.getElementById('qa-mark-am');
    if (qaAm) {
      qaAm.addEventListener('click', function () { _markAll('AM'); }, { signal: signal });
    }

    // Save
    var saveBtn = document.getElementById('btn-save-attendance');
    if (saveBtn) {
      saveBtn.addEventListener('click', _handleSave, { signal: signal });
    }
  }

  /** Mark all students with a given code for the current day */
  function _markAll(code) {
    var currentDay = Store.get('currentDay');
    if (currentDay == null) return;

    var students = Store.get('students') || [];
    for (var i = 0; i < students.length; i++) {
      Store.setPendingChange(currentDay, i, code);
    }

    _rerenderGrid();
  }

  /** Handle save button click */
  function _handleSave() {
    var currentDay = Store.get('currentDay');
    if (currentDay == null) return;

    var students = Store.get('students') || [];
    var dayAttendance = Store.getDayAttendance(currentDay) || [];
    var pendingChanges = Store.get('pendingChanges') || {};
    var currentMonth = Store.get('currentMonth');

    // Merge existing + pending
    var STUDENT_ROW_START = 5; // Row offset in the spreadsheet
    var records = [];
    for (var i = 0; i < students.length; i++) {
      var pending = pendingChanges[currentDay] && pendingChanges[currentDay][i];
      var value = pending || dayAttendance[i] || 'AG';
      records.push({
        row: STUDENT_ROW_START + i,
        value: value
      });
    }

    Store.setState({ saving: true, error: null, successMessage: null });
    _rerenderGrid();

    API.saveAttendance(currentMonth, currentDay, records)
      .then(function (success) {
        if (success) {
          Store.setState({
            saving: false,
            successMessage: 'Asistencia guardada correctamente',
            error: null
          });
        } else {
          Store.setState({
            saving: false,
            error: 'No se pudo guardar la asistencia. Intenta de nuevo.',
            successMessage: null
          });
        }
        _rerenderGrid();
      })
      .catch(function (err) {
        Store.setState({
          saving: false,
          error: 'Error de red: ' + (err.message || 'desconocido'),
          successMessage: null
        });
        _rerenderGrid();
      });
  }

  /* -------------------------------------------------------------------
     Store subscriptions
     ------------------------------------------------------------------- */

  function _initSubscriptions() {
    // Toast on success/error changes
    _subscriptions.push(
      Store.subscribe(['successMessage'], function () {
        var msg = Store.get('successMessage');
        if (msg) _showToast(msg, 'success');
      })
    );

    _subscriptions.push(
      Store.subscribe(['error'], function () {
        var msg = Store.get('error');
        if (msg) _showToast(msg, 'error');
      })
    );
  }

  function _teardownSubscriptions() {
    for (var i = 0; i < _subscriptions.length; i++) {
      if (typeof _subscriptions[i] === 'function') {
        _subscriptions[i](); // unsubscribe
      }
    }
    _subscriptions = [];
  }

  /* -------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------- */

  function render() {
    _fullRender();
    _initSubscriptions();
  }

  function destroy() {
    // Abort DOM listeners
    if (_abortController) {
      _abortController.abort();
      _abortController = null;
    }
    // Teardown store subscriptions
    _teardownSubscriptions();
    // Remove toast if visible
    _hideToast();
    // Clear view
    var root = document.getElementById('view-content');
    if (root) root.innerHTML = '';
  }

  /* -------------------------------------------------------------------
     Expose
     ------------------------------------------------------------------- */
  return {
    render: render,
    destroy: destroy
  };

})();
