/**
 * api.js — Communication layer with the Google Apps Script Web App.
 * All fetch calls go through here with loading states and error handling.
 */

const API = (() => {

  /**
   * Make a GET request to the Apps Script Web App.
   */
  async function _get(params) {
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow', // Apps Script redirects on deploy
    });

    if (!response.ok) {
      throw new Error(`Error de red: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'Error desconocido del servidor');
    }

    return data;
  }

  /**
   * Make a POST request to the Apps Script Web App.
   */
  async function _post(payload) {
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for CORS
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Error de red: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.status === 'error') {
      throw new Error(data.message || 'Error al guardar');
    }

    return data;
  }

  /**
   * Fetch all data for a given month in a single call.
   * Updates the Store with the fetched data.
   * @param {string} month — Month name (e.g. "Enero")
   */
  async function fetchFullData(month) {
    Store.setState({ loading: true, error: null, dataLoaded: false });

    try {
      const data = await _get({ action: 'getFullData', month });

      // Parse and structure the data
      const students = (data.students || []).map(row => ({
        id: row[CONFIG.STUDENT_COLUMNS.ID] || '',
        edad: row[CONFIG.STUDENT_COLUMNS.EDAD] || '',
        genero: row[CONFIG.STUDENT_COLUMNS.GENERO] || '',
        grupo: row[CONFIG.STUDENT_COLUMNS.GRUPO] || '',
        nombre: row[CONFIG.STUDENT_COLUMNS.NOMBRE] || '',
        apellido: row[CONFIG.STUDENT_COLUMNS.APELLIDO] || '',
        jornada: row[CONFIG.STUDENT_COLUMNS.JORNADA] || '',
        pctAsistencia: row[CONFIG.STUDENT_COLUMNS.PCT_ASISTENCIA] || 0,
        _raw: row,
      }));

      // Filter out empty rows (no name)
      const activeStudents = students.filter(s => s.nombre && s.nombre.toString().trim() !== '');

      Store.setState({
        students: activeStudents,
        attendance: data.attendance || [],
        dayHeaders: (data.dayHeaders || []).map(d => d === '' || d === null ? null : Number(d)),
        evalDays: Number(data.evalDays) || 0,
        summaryRows: data.summaryRows || [],
        loading: false,
        dataLoaded: true,
        pendingChanges: {},
      });

      return true;
    } catch (err) {
      console.error('fetchFullData error:', err);
      Store.setState({
        loading: false,
        error: `No se pudo cargar los datos: ${err.message}`,
        dataLoaded: false,
      });
      Store.clearMessages(8000);
      return false;
    }
  }

  /**
   * Save attendance for a specific day.
   * @param {string} month — Month name
   * @param {number} dayIndex — 0-based index into the day columns (0 = column L)
   * @param {Array<{row: number, value: string}>} records — [{row: 5, value: 'AG'}, ...]
   */
  async function saveAttendance(month, dayIndex, records) {
    Store.setState({ saving: true, error: null, successMessage: null });

    try {
      const result = await _post({
        action: 'saveAttendance',
        month: month,
        dayIndex: dayIndex,
        records: records,
      });

      // Apply pending changes to local state for immediate UI update
      Store.applyPendingChanges(dayIndex);

      Store.setState({
        saving: false,
        successMessage: `✅ Asistencia del día ${Store.get('dayHeaders')[dayIndex] || dayIndex + 1} guardada correctamente.`,
      });
      Store.clearMessages(5000);

      return true;
    } catch (err) {
      console.error('saveAttendance error:', err);
      Store.setState({
        saving: false,
        error: `Error al guardar: ${err.message}`,
      });
      Store.clearMessages(8000);
      return false;
    }
  }

  /**
   * Load data with demo/mock fallback for development without Apps Script.
   */
  async function fetchWithDemoFallback(month) {
    if (CONFIG.APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') {
      console.warn('⚠️ Apps Script URL not configured. Loading demo data.');
      _loadDemoData(month);
      return true;
    }
    return fetchFullData(month);
  }

  /**
   * Generate demo data for development/testing.
   */
  function _loadDemoData(month) {
    const monthIndex = CONFIG.MONTHS.indexOf(month);
    const daysInMonth = new Date(2026, monthIndex + 1, 0).getDate();
    const evalDays = Math.min(daysInMonth, 22); // Simulate ~22 school days

    const firstNames = ['Sofía', 'Valentina', 'Isabella', 'Camila', 'Mariana', 'Luciana', 'Gabriela', 'Daniela',
      'Samuel', 'Sebastián', 'Matías', 'Nicolás', 'Alejandro', 'Santiago', 'Diego', 'Andrés',
      'Emma', 'Victoria', 'Natalia', 'Carolina', 'Pablo', 'Felipe', 'Tomás', 'Lucas',
      'Ana', 'María', 'Laura', 'Catalina', 'Juliana', 'Valeria', 'Miguel', 'Esteban',
      'Sara', 'Paula', 'Elena', 'Andrea'];

    const lastNames = ['García', 'Rodríguez', 'Martínez', 'López', 'Hernández', 'González', 'Pérez', 'Sánchez',
      'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Cruz', 'Morales',
      'Reyes', 'Gutiérrez', 'Ortiz', 'Ramos', 'Vargas', 'Castillo', 'Jiménez', 'Romero',
      'Mendoza', 'Ruiz', 'Álvarez', 'Medina', 'Castro', 'Herrera', 'Vega', 'Navarro',
      'Salazar', 'Delgado', 'Peña', 'Aguilar'];

    const codes = CONFIG.ATTENDANCE_CODE_ORDER;
    const numStudents = 30;
    const students = [];
    const attendance = [];
    const jornadas = ['Mañana', 'Tarde'];

    for (let i = 0; i < numStudents; i++) {
      const jornada = jornadas[i % 2];
      students.push({
        id: (i + 1).toString(),
        edad: (5 + Math.floor(Math.random() * 8)).toString(),
        genero: i < 18 ? 'F' : 'M',
        grupo: ['A', 'B'][i % 2],
        nombre: firstNames[i % firstNames.length],
        apellido: lastNames[i % lastNames.length],
        jornada: jornada,
        pctAsistencia: 0,
        _raw: [],
      });

      // Generate attendance row
      const row = [];
      for (let d = 0; d < 30; d++) {
        if (d < daysInMonth) {
          // ~85% attendance rate
          const rand = Math.random();
          if (rand < 0.85) row.push('AG');
          else if (rand < 0.90) row.push('AM');
          else if (rand < 0.93) row.push('PU');
          else if (rand < 0.96) row.push('EFM');
          else if (rand < 0.98) row.push('HEC');
          else row.push('SPD');
        } else {
          row.push('');
        }
      }
      attendance.push(row);
    }

    // Day headers
    const dayHeaders = [];
    for (let d = 1; d <= 30; d++) {
      dayHeaders.push(d <= daysInMonth ? d : null);
    }

    // Summary rows (simulate: niñosManana, niñosTarde, desayunos, almuerzos, algos)
    const summaryRows = [];
    for (let r = 0; r < 5; r++) {
      const sRow = [];
      for (let d = 0; d < 30; d++) {
        if (d < daysInMonth) {
          sRow.push(Math.floor(Math.random() * 15) + 5);
        } else {
          sRow.push(0);
        }
      }
      summaryRows.push(sRow);
    }

    Store.setState({
      students,
      attendance,
      dayHeaders,
      evalDays,
      summaryRows,
      loading: false,
      dataLoaded: true,
      pendingChanges: {},
    });
  }

  /**
   * Fetch the accumulated total for a category row (e.g. "Desayunos").
   * Uses the new getCategoryTotal backend endpoint for robust server-side
   * summation that handles #VALUE!, #REF!, empty cells safely.
   *
   * @param {string} month — Month name (e.g. "Enero")
   * @param {string} category — Category name to search (e.g. "Desayunos")
   * @returns {Object|null} { found, category, total, cellsProcessed, cellsSkipped } or null on error
   */
  async function fetchCategoryTotal(month, category) {
    try {
      const data = await _get({
        action: 'getCategoryTotal',
        month: month,
        category: category,
      });
      return data.data || null;
    } catch (err) {
      console.error(`fetchCategoryTotal("${category}") error:`, err);
      return null;
    }
  }

  /**
   * Fetch accumulated total for a category across a time period.
   * The backend calculates which months to read automatically.
   *
   * @param {string} category — Category name (e.g. "Desayunos")
   * @param {string} period — "Mes", "Trimestre", "Semestre", or "Año"
   * @returns {Object|null} {
   *   found, category, period, periodLabel, today, total,
   *   breakdown: [{month, subtotal, cellsProcessed, cellsSkipped}],
   *   monthsProcessed, monthsNotFound
   * }
   *
   * @example
   *   const r = await API.fetchCategoryByPeriod('Desayunos', 'Trimestre');
   *   // r.total = 1024
   *   // r.periodLabel = "Mayo 2026 - Julio 2026"
   *   // r.breakdown = [
   *   //   { month: "Mayo",  subtotal: 380, cellsProcessed: 22, cellsSkipped: 0 },
   *   //   { month: "Junio", subtotal: 360, cellsProcessed: 20, cellsSkipped: 1 },
   *   //   { month: "Julio", subtotal: 284, cellsProcessed: 18, cellsSkipped: 2 },
   *   // ]
   */
  async function fetchCategoryByPeriod(category, period) {
    try {
      const data = await _get({
        action: 'getCategoryByPeriod',
        category: category,
        period: period,
      });
      return data.data || null;
    } catch (err) {
      console.error(`fetchCategoryByPeriod("${category}", "${period}") error:`, err);
      return null;
    }
  }

  return {
    fetchFullData,
    saveAttendance,
    fetchWithDemoFallback,
    fetchCategoryTotal,
    fetchCategoryByPeriod,
  };
})();
