/**
 * app.js — Entry point and router for the Attendance Dashboard SPA.
 * Handles navigation, month selection, view switching, and global UI.
 */

const App = (() => {

  // ===== DOM references (populated on init) =====
  let $viewContent = null;
  let $monthSelect = null;
  let $navLinks = null;
  let $sidebar = null;
  let $sidebarOverlay = null;
  let $menuToggle = null;
  let $loadingOverlay = null;
  let $toastContainer = null;
  let $viewTitle = null;

  /**
   * Initialize the application.
   */
  async function init() {
    // Cache DOM elements
    $viewContent = document.getElementById('view-content');
    $monthSelect = document.getElementById('month-select');
    $sidebar = document.getElementById('sidebar');
    $sidebarOverlay = document.getElementById('sidebar-overlay');
    $menuToggle = document.getElementById('menu-toggle');
    $loadingOverlay = document.getElementById('loading-overlay');
    $toastContainer = document.getElementById('toast-container');
    $viewTitle = document.getElementById('view-title');

    // Populate month select
    _populateMonthSelect();

    // Set up navigation
    _setupNavigation();

    // Set up month selector
    _setupMonthSelector();

    // Set up mobile menu
    _setupMobileMenu();

    // Subscribe to Store changes for global UI
    _setupStoreSubscriptions();

    // Load initial data
    await _loadData(Store.get('currentMonth'));

    // Render initial view
    _navigateTo(Store.get('currentView'));
  }

  /**
   * Populate the month dropdown.
   */
  function _populateMonthSelect() {
    if (!$monthSelect) return;
    $monthSelect.innerHTML = '';
    const currentMonth = Store.get('currentMonth');
    for (const month of CONFIG.MONTHS) {
      const opt = document.createElement('option');
      opt.value = month;
      opt.textContent = month;
      if (month === currentMonth) opt.selected = true;
      $monthSelect.appendChild(opt);
    }
  }

  /**
   * Set up navigation click handlers.
   */
  function _setupNavigation() {
    const links = document.querySelectorAll('[data-view]');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const view = link.dataset.view;
        if (link.classList.contains('disabled')) return;
        _navigateTo(view);
        // Close mobile sidebar
        _closeMobileSidebar();
      });
    });
  }

  /**
   * Set up month selector change handler.
   */
  function _setupMonthSelector() {
    if (!$monthSelect) return;
    $monthSelect.addEventListener('change', async (e) => {
      const month = e.target.value;
      Store.setState({ currentMonth: month, currentDay: null });
      await _loadData(month);
      _renderCurrentView();
    });
  }

  /**
   * Set up mobile menu toggle.
   */
  function _setupMobileMenu() {
    if ($menuToggle) {
      $menuToggle.addEventListener('click', () => {
        $sidebar?.classList.toggle('mobile-open');
        $sidebarOverlay?.classList.toggle('visible');
      });
    }
    if ($sidebarOverlay) {
      $sidebarOverlay.addEventListener('click', _closeMobileSidebar);
    }
  }

  function _closeMobileSidebar() {
    $sidebar?.classList.remove('mobile-open');
    $sidebarOverlay?.classList.remove('visible');
  }

  /**
   * Set up global Store subscriptions.
   */
  function _setupStoreSubscriptions() {
    // Loading overlay
    Store.subscribe('loading', (loading) => {
      if ($loadingOverlay) {
        if (loading) {
          $loadingOverlay.classList.add('visible');
        } else {
          $loadingOverlay.classList.remove('visible');
        }
      }
    });

    // Toast notifications
    Store.subscribe('successMessage', (msg) => {
      if (msg) _showToast(msg, 'success');
    });

    Store.subscribe('error', (msg) => {
      if (msg) _showToast(msg, 'error');
    });
  }

  /**
   * Load data for the selected month.
   */
  async function _loadData(month) {
    await API.fetchWithDemoFallback(month);
  }

  /**
   * Navigate to a view.
   */
  function _navigateTo(view) {
    // Destroy current view
    if (Store.get('currentView') === CONFIG.VIEWS.DASHBOARD) {
      if (typeof DashboardModule !== 'undefined') DashboardModule.destroy();
    } else if (Store.get('currentView') === CONFIG.VIEWS.FORM) {
      if (typeof FormModule !== 'undefined') FormModule.destroy();
    }

    Store.setState({ currentView: view });

    // Update nav active states
    document.querySelectorAll('[data-view]').forEach(link => {
      link.classList.toggle('active', link.dataset.view === view);
    });

    // Update view title
    _updateViewTitle(view);

    // Render the view
    _renderCurrentView();
  }

  /**
   * Update the view title in the topbar.
   */
  function _updateViewTitle(view) {
    if (!$viewTitle) return;
    const titles = {
      [CONFIG.VIEWS.DASHBOARD]: 'Dashboard General',
      [CONFIG.VIEWS.FORM]: 'Registro de Asistencia',
      [CONFIG.VIEWS.REPORTS]: 'Reportes Históricos',
      [CONFIG.VIEWS.STUDENTS]: 'Gestión de Alumnos',
    };
    $viewTitle.textContent = titles[view] || 'Dashboard';
  }

  /**
   * Render the current view.
   */
  function _renderCurrentView() {
    const view = Store.get('currentView');

    if (!Store.get('dataLoaded') && !Store.get('loading')) {
      if ($viewContent) {
        $viewContent.innerHTML = `
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p class="text-lg font-semibold mb-2">No se pudieron cargar los datos</p>
            <p class="text-sm">Verifica la conexión con Google Sheets e intenta de nuevo.</p>
          </div>
        `;
      }
      return;
    }

    switch (view) {
      case CONFIG.VIEWS.DASHBOARD:
        if (typeof DashboardModule !== 'undefined') DashboardModule.render();
        break;
      case CONFIG.VIEWS.FORM:
        if (typeof FormModule !== 'undefined') FormModule.render();
        break;
      default:
        if ($viewContent) {
          $viewContent.innerHTML = `
            <div class="empty-state">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.42 15.17l-5.58-3.16a1.5 1.5 0 010-2.62l5.58-3.16a1.5 1.5 0 011.58 0l5.58 3.16a1.5 1.5 0 010 2.62l-5.58 3.16a1.5 1.5 0 01-1.58 0z" />
              </svg>
              <p class="text-lg font-semibold mb-2">Próximamente</p>
              <p class="text-sm">Esta sección estará disponible en una futura actualización.</p>
            </div>
          `;
        }
        break;
    }
  }

  /**
   * Show a toast notification.
   */
  function _showToast(message, type = 'success') {
    if (!$toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    $toastContainer.appendChild(toast);

    // Auto-remove after 4s
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ===== Public API =====
  return { init };
})();

// ===== Bootstrap on DOM ready =====
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
