/* ==========================================================================
   Dashboard Module — KPI Cards, Charts & Alert Table
   Attendance Dashboard SPA
   ========================================================================== */

// eslint-disable-next-line no-unused-vars
var DashboardModule = (function () {
  'use strict';

  // ── Chart instance references (for cleanup) ──────────────────────────
  var _charts = {
    dailyBar: null,
    absenceDoughnut: null,
  };

  // ── Store subscription id ─────────────────────────────────────────────
  var _unsubscribe = null;

  // =====================================================================
  //  Helpers
  // =====================================================================

  /**
   * Return a Tailwind-friendly color token based on percentage thresholds.
   * @param {number} pct 0-100
   * @returns {{ring: string, text: string, stroke: string}}
   */
  function _pctColors(pct) {
    if (pct >= 80) return { ring: 'stroke-emerald-400', text: 'text-emerald-400', stroke: '#34d399' };
    if (pct >= 60) return { ring: 'stroke-amber-400',   text: 'text-amber-400',   stroke: '#fbbf24' };
    return              { ring: 'stroke-rose-500',    text: 'text-rose-500',    stroke: '#f43f5e' };
  }

  /**
   * Build an SVG progress ring.
   * @param {number} pct 0-100
   * @param {number} size pixel diameter
   * @returns {string} SVG markup
   */
  function _progressRingSVG(pct, size) {
    var radius = (size - 8) / 2;
    var circ   = 2 * Math.PI * radius;
    var offset = circ - (pct / 100) * circ;
    var colors = _pctColors(pct);

    return (
      '<svg width="' + size + '" height="' + size + '" class="transform -rotate-90">' +
        '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + radius + '" ' +
          'stroke="rgba(255,255,255,0.1)" stroke-width="6" fill="none"/>' +
        '<circle cx="' + (size / 2) + '" cy="' + (size / 2) + '" r="' + radius + '" ' +
          'stroke="' + colors.stroke + '" stroke-width="6" fill="none" ' +
          'stroke-linecap="round" stroke-dasharray="' + circ + '" ' +
          'stroke-dashoffset="' + offset + '" ' +
          'class="transition-all duration-700 ease-out"/>' +
      '</svg>'
    );
  }

  /**
   * Format a number with locale thousands separators.
   */
  function _fmt(n) {
    return Number(n).toLocaleString('es-CO');
  }

  // =====================================================================
  //  KPI Cards
  // =====================================================================

  function _renderKPICards() {
    var pct     = Store.getAverageAttendancePct();
    var colors  = _pctColors(pct);
    var students = Store.get('students') || [];
    var totals   = Store.getSummaryTotals();

    var cards = [
      {
        icon: '📊',
        value: pct.toFixed(1) + '%',
        label: '% Asistencia Promedio',
        ring: true,
        pct: pct,
      },
      {
        icon: '👥',
        value: _fmt(students.length),
        label: 'Alumnos Activos',
      },
      {
        icon: '🥣',
        value: _fmt(totals.desayunos),
        label: 'Total Desayunos',
      },
      {
        icon: '🍽️',
        value: _fmt(totals.almuerzos),
        label: 'Total Almuerzos',
      },
      {
        icon: '🍪',
        value: _fmt(totals.algos),
        label: 'Total Onces',
      },
    ];

    var html = '<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5 mb-8">';

    cards.forEach(function (card, i) {
      var delay = i * 80;
      html +=
        '<div class="kpi-card bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ' +
        'flex flex-col items-center justify-center text-center transition-all duration-300 ' +
        'hover:bg-white/10 hover:border-white/20 hover:shadow-lg hover:shadow-white/5 ' +
        'opacity-0 animate-fade-up" style="animation-delay:' + delay + 'ms">';

      if (card.ring) {
        html +=
          '<div class="relative flex items-center justify-center mb-3">' +
            _progressRingSVG(card.pct, 96) +
            '<span class="absolute text-2xl font-bold ' + colors.text + '">' + card.value + '</span>' +
          '</div>';
      } else {
        html +=
          '<span class="text-3xl mb-2">' + card.icon + '</span>' +
          '<span class="text-3xl font-extrabold text-white mb-1">' + card.value + '</span>';
      }

      html +=
          '<span class="text-xs uppercase tracking-wider text-white/50">' + card.label + '</span>' +
        '</div>';
    });

    html += '</div>';
    return html;
  }

  // =====================================================================
  //  Tab System (Resumen Mensual / Acumulados por Periodo)
  // =====================================================================

  var _activeTab = 'mensual';   // 'mensual' or 'acumulados'
  var _activePeriod = 'Q1';     // Default quarter

  /**
   * Render the tab navigation bar.
   */
  function _renderTabs() {
    var tabs = [
      { id: 'mensual',    icon: '📊', label: 'Resumen Mensual' },
      { id: 'acumulados', icon: '📆', label: 'Acumulados por Periodo' },
    ];

    var html = '<div class="flex gap-2 mb-6 opacity-0 animate-fade-up" style="animation-delay:100ms">';

    tabs.forEach(function (tab) {
      var isActive = tab.id === _activeTab;
      var cls = 'dash-tab flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold ' +
        'transition-all duration-200 cursor-pointer border ';
      cls += isActive
        ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-white border-blue-500/40 shadow-lg shadow-blue-500/10'
        : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white/80';

      html += '<button data-tab="' + tab.id + '" class="' + cls + '">' +
        '<span>' + tab.icon + '</span> ' + tab.label +
      '</button>';
    });

    html += '</div>';
    return html;
  }

  // ── Tab 2: Acumulados por Periodo ─────────────────────────────────────

  /**
   * Render the full 'Acumulados por Periodo' tab content.
   */
  function _renderAcumuladosTab() {
    var periods = [
      { id: 'Q1',        label: 'Q1',         sub: 'Ene - Mar' },
      { id: 'Q2',        label: 'Q2',         sub: 'Abr - Jun' },
      { id: 'Q3',        label: 'Q3',         sub: 'Jul - Sep' },
      { id: 'Q4',        label: 'Q4',         sub: 'Oct - Dic' },
      { id: 'Total Año', label: 'Total Año',  sub: new Date().getFullYear().toString() },
    ];

    var html =
      '<div id="tab-acumulados">' +
        // Period selector buttons
        '<div class="mb-6 opacity-0 animate-fade-up" style="animation-delay:150ms">' +
          '<p class="text-xs uppercase tracking-wider text-white/40 mb-3">Selecciona el periodo</p>' +
          '<div id="period-buttons" class="flex flex-wrap gap-3">';

    periods.forEach(function (p) {
      var isActive = p.id === _activePeriod;
      var cls = 'period-btn group flex flex-col items-center justify-center px-5 py-3 rounded-xl ' +
        'text-sm font-semibold transition-all duration-200 cursor-pointer border min-w-[80px] ';
      cls += isActive
        ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-transparent shadow-lg shadow-blue-500/25 scale-105'
        : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20';

      html += '<button data-period="' + p.id + '" class="' + cls + '">' +
        '<span class="text-base font-bold">' + p.label + '</span>' +
        '<span class="text-[10px] mt-0.5 opacity-70">' + p.sub + '</span>' +
      '</button>';
    });

    html +=
          '</div>' +
        '</div>' +

        // Period label
        '<div id="period-label" class="text-xs text-white/40 mb-4 opacity-0 animate-fade-up" style="animation-delay:200ms">' +
          '<span class="inline-block w-3 h-3 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin mr-2" ' +
            'id="period-loading" style="display:none"></span>' +
          '<span id="period-label-text">Selecciona un periodo...</span>' +
        '</div>' +

        // 3 Accumulation KPI cards
        '<div class="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6 opacity-0 animate-fade-up" style="animation-delay:250ms">' +
          _renderAccCard('desayunos', '🥣', 'Desayunos', '--', 'from-amber-500/20 to-orange-500/20', 'border-amber-500/30') +
          _renderAccCard('almuerzos', '🍽️', 'Almuerzos', '--', 'from-emerald-500/20 to-teal-500/20', 'border-emerald-500/30') +
          _renderAccCard('onces', '🍪', 'Onces / Algos', '--', 'from-violet-500/20 to-purple-500/20', 'border-violet-500/30') +
        '</div>' +

        // Breakdown table (filled dynamically)
        '<div id="period-breakdown" class="opacity-0 animate-fade-up" style="animation-delay:300ms"></div>' +

      '</div>';

    return html;
  }

  /**
   * Render a styled accumulation card with gradient bg.
   */
  function _renderAccCard(id, icon, label, value, gradFrom, borderColor) {
    gradFrom = gradFrom || 'from-white/5 to-white/5';
    borderColor = borderColor || 'border-white/10';
    return (
      '<div class="bg-gradient-to-br ' + gradFrom + ' backdrop-blur-xl border ' + borderColor + ' rounded-2xl p-6 ' +
      'flex items-center gap-4 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg">' +
        '<span class="text-3xl">' + icon + '</span>' +
        '<div class="flex-1 min-w-0">' +
          '<p class="text-xs uppercase tracking-wider text-white/50 mb-1">' + label + '</p>' +
          '<p class="text-3xl font-extrabold text-white" id="acc-' + id + '">' + value + '</p>' +
        '</div>' +
        '<div class="w-5 h-5 border-2 border-white/10 border-t-blue-400 rounded-full animate-spin" ' +
          'id="acc-' + id + '-spinner" style="display:none"></div>' +
      '</div>'
    );
  }

  /**
   * Initialize tab navigation and period button events.
   */
  function _initTabEvents() {
    // Tab switching
    var tabBtns = document.querySelectorAll('[data-tab]');
    tabBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var tabId = btn.dataset.tab;
        if (tabId === _activeTab) return;
        _activeTab = tabId;
        // Re-render the whole dashboard
        render();
      });
    });

    // Period buttons (only on acumulados tab)
    var periodContainer = document.getElementById('period-buttons');
    if (!periodContainer) return;

    periodContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-period]');
      if (!btn) return;

      var period = btn.dataset.period;
      if (period === _activePeriod) return;

      _activePeriod = period;

      // Update active button styles
      periodContainer.querySelectorAll('[data-period]').forEach(function (b) {
        var isActive = b.dataset.period === period;
        var cls = 'period-btn group flex flex-col items-center justify-center px-5 py-3 rounded-xl ' +
          'text-sm font-semibold transition-all duration-200 cursor-pointer border min-w-[80px] ';
        b.className = cls + (isActive
          ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-transparent shadow-lg shadow-blue-500/25 scale-105'
          : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20');
      });

      _fetchPeriodData(period);
    });

    // Auto-load initial period
    _fetchPeriodData(_activePeriod);
  }

  /**
   * Fetch accumulated data for all 3 categories for the given period.
   */
  async function _fetchPeriodData(period) {
    var categories = [
      { key: 'desayunos', name: 'Desayunos' },
      { key: 'almuerzos', name: 'Almuerzos' },
      { key: 'onces',     name: 'Algos' },
    ];

    // Show loading
    var labelEl   = document.getElementById('period-label-text');
    var loadingEl = document.getElementById('period-loading');
    var breakdownEl = document.getElementById('period-breakdown');
    if (loadingEl) loadingEl.style.display = 'inline-block';
    if (labelEl) labelEl.textContent = ' Consultando ' + period + '...';

    categories.forEach(function (cat) {
      var valEl  = document.getElementById('acc-' + cat.key);
      var spinEl = document.getElementById('acc-' + cat.key + '-spinner');
      if (valEl)  valEl.textContent = '...';
      if (spinEl) spinEl.style.display = 'block';
    });

    var isDemoMode = CONFIG.APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE';
    var allBreakdowns = [];

    for (var i = 0; i < categories.length; i++) {
      var cat    = categories[i];
      var valEl  = document.getElementById('acc-' + cat.key);
      var spinEl = document.getElementById('acc-' + cat.key + '-spinner');

      try {
        var result;
        if (isDemoMode) {
          var mult = (period === 'Q1' || period === 'Q2' || period === 'Q3' || period === 'Q4') ? 3 : 12;
          result = {
            found: true,
            total: Math.floor(Math.random() * 200 + 100) * mult,
            periodLabel: period + ' (Demo)',
            breakdown: [{ month: 'Demo', subtotal: Math.floor(Math.random() * 300) }]
          };
        } else {
          result = await API.fetchCategoryByPeriod(cat.name, period);
        }

        if (valEl) {
          valEl.textContent = (result && result.found)
            ? Number(result.total).toLocaleString('es-CO')
            : '0';
        }

        if (i === 0 && labelEl && result) {
          labelEl.textContent = ' ' + (result.periodLabel || period);
        }

        if (result && result.breakdown) {
          allBreakdowns.push({ category: cat.name, breakdown: result.breakdown, total: result.total });
        }
      } catch (err) {
        if (valEl) valEl.textContent = 'Error';
      }

      if (spinEl) spinEl.style.display = 'none';
    }

    if (loadingEl) loadingEl.style.display = 'none';

    // Render breakdown table
    if (breakdownEl && allBreakdowns.length > 0) {
      breakdownEl.innerHTML = _renderBreakdownTable(allBreakdowns);
    }
  }

  /**
   * Render a breakdown table showing per-month subtotals for each category.
   */
  function _renderBreakdownTable(data) {
    if (!data || data.length === 0) return '';

    // Get month names from the first category's breakdown
    var months = data[0].breakdown.map(function (b) { return b.month; });

    var html =
      '<div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mt-2">' +
        '<h4 class="text-sm font-semibold uppercase tracking-wider text-white/70 mb-4">' +
          '📋 Desglose por Mes' +
        '</h4>' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full text-sm">' +
            '<thead><tr class="border-b border-white/10">' +
              '<th class="px-4 py-2 text-left text-white/50 font-medium">Categoría</th>';

    months.forEach(function (m) {
      html += '<th class="px-4 py-2 text-right text-white/50 font-medium">' + m + '</th>';
    });
    html += '<th class="px-4 py-2 text-right text-white font-bold">Total</th></tr></thead><tbody>';

    data.forEach(function (row, idx) {
      var rowBg = idx % 2 === 0 ? '' : 'bg-white/[0.02]';
      html += '<tr class="' + rowBg + ' border-b border-white/5">';
      html += '<td class="px-4 py-3 text-white font-medium">' + row.category + '</td>';

      row.breakdown.forEach(function (b) {
        var val = Number(b.subtotal || 0);
        var color = b.error ? 'text-white/20' : 'text-white/70';
        html += '<td class="px-4 py-3 text-right ' + color + '">' +
          (b.error ? '—' : val.toLocaleString('es-CO')) + '</td>';
      });

      html += '<td class="px-4 py-3 text-right text-white font-bold">' +
        Number(row.total || 0).toLocaleString('es-CO') + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div></div>';
    return html;
  }

  // =====================================================================
  //  Charts
  // =====================================================================

  /** Destroy existing chart instances safely. */
  function _destroyCharts() {
    if (_charts.dailyBar)       { _charts.dailyBar.destroy();       _charts.dailyBar = null; }
    if (_charts.absenceDoughnut) { _charts.absenceDoughnut.destroy(); _charts.absenceDoughnut = null; }
  }

  /**
   * Render chart container cards (canvas elements are created here; Chart.js
   * instances are created in _initCharts after the DOM is ready).
   */
  function _renderChartContainers() {
    return (
      '<div class="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-8">' +
        // -- Chart A: Daily Bar --
        '<div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ' +
        'opacity-0 animate-fade-up" style="animation-delay:400ms">' +
          '<h3 class="text-sm font-semibold uppercase tracking-wider text-white/70 mb-4">' +
            '📅 Asistencia Diaria por Jornada' +
          '</h3>' +
          '<div style="position:relative;height:320px">' +
            '<canvas id="chart-daily-bar"></canvas>' +
          '</div>' +
        '</div>' +
        // -- Chart B: Absence Doughnut --
        '<div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ' +
        'opacity-0 animate-fade-up" style="animation-delay:480ms">' +
          '<h3 class="text-sm font-semibold uppercase tracking-wider text-white/70 mb-4">' +
            '🍩 Distribución de Inasistencias' +
          '</h3>' +
          '<div style="position:relative;height:320px">' +
            '<canvas id="chart-absence-doughnut"></canvas>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  /** Initialize Chart.js instances (call AFTER DOM injection). */
  function _initCharts() {
    _initDailyBarChart();
    _initAbsenceDoughnutChart();
  }

  // -- Chart A: Daily Attendance by Jornada (Grouped Bar) ----------------

  function _initDailyBarChart() {
    var ctx = document.getElementById('chart-daily-bar');
    if (!ctx) return;

    var data = Store.getDailyJornadaCounts();
    // Filter out null/undefined days
    var labels    = [];
    var manana    = [];
    var tarde     = [];

    (data.days || []).forEach(function (d, i) {
      if (d == null) return;
      labels.push('Día ' + d);
      manana.push(data.manana[i] || 0);
      tarde.push(data.tarde[i] || 0);
    });

    _charts.dailyBar = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Mañana',
            data: manana,
            backgroundColor: _createGradient(ctx, '#3b82f6', '#6366f1'),
            borderRadius: 6,
            borderSkipped: false,
          },
          {
            label: 'Tarde',
            data: tarde,
            backgroundColor: _createGradient(ctx, '#14b8a6', '#06b6d4'),
            borderRadius: 6,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: 'rgba(255,255,255,0.7)', font: { size: 12 } },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.9)',
            titleColor: '#fff',
            bodyColor: 'rgba(255,255,255,0.8)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
          },
        },
        scales: {
          x: {
            ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 } },
            grid:  { color: 'rgba(255,255,255,0.05)' },
          },
          y: {
            beginAtZero: true,
            ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 11 }, precision: 0 },
            grid:  { color: 'rgba(255,255,255,0.05)' },
          },
        },
      },
    });
  }

  /**
   * Helper — create a vertical linear gradient for a canvas-backed chart.
   */
  function _createGradient(canvasEl, colorTop, colorBottom) {
    var ctx2d = canvasEl.getContext('2d');
    var grad  = ctx2d.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBottom);
    return grad;
  }

  // -- Chart B: Absence Distribution (Doughnut) -------------------------

  function _initAbsenceDoughnutChart() {
    var ctx = document.getElementById('chart-absence-doughnut');
    if (!ctx) return;

    var absenceCodes = CONFIG.ABSENCE_CODES || [];
    var labels = [];
    var values = [];
    var colors = [];
    var totalAbsences = 0;

    absenceCodes.forEach(function (code) {
      var meta  = CONFIG.ATTENDANCE_CODES[code] || {};
      var count = Store.getCodeCount(code);
      labels.push(meta.label || code);
      values.push(count);
      colors.push(meta.color || '#64748b');
      totalAbsences += count;
    });

    // Center text plugin (local)
    var centerTextPlugin = {
      id: 'doughnutCenterText',
      afterDraw: function (chart) {
        var width  = chart.width;
        var height = chart.height;
        var c      = chart.ctx;
        c.save();
        c.font      = 'bold 28px Inter, system-ui, sans-serif';
        c.fillStyle = '#ffffff';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(_fmt(totalAbsences), width / 2, height / 2 - 10);
        c.font      = '12px Inter, system-ui, sans-serif';
        c.fillStyle = 'rgba(255,255,255,0.5)';
        c.fillText('inasistencias', width / 2, height / 2 + 16);
        c.restore();
      },
    };

    _charts.absenceDoughnut = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: 'rgba(0,0,0,0.3)',
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: 'rgba(255,255,255,0.7)',
              font: { size: 11 },
              padding: 14,
              usePointStyle: true,
              pointStyleWidth: 10,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15,23,42,0.9)',
            titleColor: '#fff',
            bodyColor: 'rgba(255,255,255,0.8)',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10,
          },
        },
      },
      plugins: [centerTextPlugin],
    });
  }

  // =====================================================================
  //  Alert Table
  // =====================================================================

  function _renderAlertTable() {
    var alerts = Store.getAlertStudents();

    var html =
      '<div class="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 ' +
      'opacity-0 animate-fade-up" style="animation-delay:560ms">' +
        '<h3 class="text-sm font-semibold uppercase tracking-wider text-white/70 mb-4">' +
          '⚠️ Alumnos con Asistencia &lt; 80%' +
        '</h3>';

    if (!alerts || alerts.length === 0) {
      html +=
        '<div class="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 ' +
        'px-5 py-4 text-emerald-300">' +
          '<span class="text-2xl">✅</span>' +
          '<span>Todos los alumnos tienen buena asistencia</span>' +
        '</div>';
    } else {
      html +=
        '<div class="overflow-x-auto rounded-xl border border-white/10">' +
        '<table class="w-full text-sm text-left">' +
          '<thead>' +
            '<tr class="text-xs uppercase tracking-wider text-white/50 bg-white/5">' +
              '<th class="px-4 py-3">#</th>' +
              '<th class="px-4 py-3">Nombre</th>' +
              '<th class="px-4 py-3">Apellido</th>' +
              '<th class="px-4 py-3">Jornada</th>' +
              '<th class="px-4 py-3 text-right">% Asistencia</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>';

      alerts.forEach(function (row, i) {
        var student = row.student || {};
        var pct     = row.pct != null ? row.pct : 0;
        var pctStr  = pct.toFixed(1) + '%';

        // Badge colour
        var badgeClasses = pct < 60
          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30';

        var rowBg = i % 2 === 0 ? 'bg-white/[0.02]' : '';

        html +=
          '<tr class="' + rowBg + ' hover:bg-white/5 transition-colors">' +
            '<td class="px-4 py-3 text-white/40">' + (i + 1) + '</td>' +
            '<td class="px-4 py-3 text-white">' + _escHtml(student.nombre || '—') + '</td>' +
            '<td class="px-4 py-3 text-white">' + _escHtml(student.apellido || '—') + '</td>' +
            '<td class="px-4 py-3 text-white/70">' + _escHtml(student.jornada || '—') + '</td>' +
            '<td class="px-4 py-3 text-right">' +
              '<span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ' + badgeClasses + '">' +
                pctStr +
              '</span>' +
            '</td>' +
          '</tr>';
      });

      html += '</tbody></table></div>';
    }

    html += '</div>';
    return html;
  }

  /**
   * Minimal HTML-escape to prevent injection in student names.
   */
  function _escHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // =====================================================================
  //  Public API
  // =====================================================================

  /**
   * Render the full dashboard view into #view-content.
   */
  function render() {
    _destroyCharts();

    var container = document.getElementById('view-content');
    if (!container) {
      console.warn('[DashboardModule] #view-content not found');
      return;
    }

    var html = _renderTabs();

    if (_activeTab === 'mensual') {
      // Tab 1: Resumen Mensual — KPIs + Charts + Alerts
      html +=
        _renderKPICards() +
        _renderChartContainers() +
        _renderAlertTable();
    } else {
      // Tab 2: Acumulados por Periodo — Q1/Q2/Q3/Q4/Total Año
      html += _renderAcumuladosTab();
    }

    container.innerHTML = html;

    // Initialize interactive elements after DOM is ready
    requestAnimationFrame(function () {
      _initTabEvents();
      if (_activeTab === 'mensual') {
        _initCharts();
      }
    });

    // Subscribe to data changes (if not already subscribed)
    if (!_unsubscribe) {
      _unsubscribe = Store.subscribe(['dataLoaded'], function () {
        render();
      });
    }
  }

  /**
   * Destroy chart instances and unsubscribe from store.
   */
  function destroy() {
    _destroyCharts();

    if (_unsubscribe) {
      if (typeof _unsubscribe === 'function') {
        _unsubscribe();
      }
      _unsubscribe = null;
    }
  }

  // ── Expose public API ─────────────────────────────────────────────────
  return {
    render:  render,
    destroy: destroy,
  };
})();
