
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CircleAlert,
  CloudUpload,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';

import LoginPage from './pages/LoginPage.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import AccountsPage, { AllocationBar } from './pages/AccountsPage.jsx';
import ImportPage from './pages/ImportPage.jsx';
import AccountDrawer from './components/AccountDrawer.jsx';

import { displayRole } from './utils/format.js';
import { setUnauthorizedHandler } from './services/apiClient.js';
import { getAccounts } from './services/accountService.js';
import { logout } from './services/authService.js';
import { getDashboard, getTeam } from './services/workspaceService.js';

const DEFAULT_ACCOUNT_FILTERS = {
  query: '', status: 'All', office: 'All offices', page: 1,
};

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('shaha-user') || 'null');
  } catch {
    return null;
  }
}

function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem('shaha-token') || ''
  );
  const [user, setUser] = useState(getStoredUser);

  const [view, setView] = useState('Overview');
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const [refresh, setRefresh] = useState(0);

  const [activeAccount, setActiveAccount] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);

  const [accountFilters, setAccountFilters] = useState({});

  const [selected, setSelected] = useState([]);
  const [callerId, setCallerId] = useState('');

  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [team, setTeam] = useState([]);
  const [accounts, setAccounts] = useState({
    rows: [],
    total: 0,
    page: 1,
  });

  const canManage = ['head', 'coo', 'manager'].includes(user?.role);
  const roleTheme = ['head', 'coo'].includes(user?.role)
    ? 'head'
    : user?.role === 'manager'
      ? 'manager'
      : 'caller';

  const filterKey = `${user?.id || 'guest'}:${view}`;
  const activeFilters = accountFilters[filterKey] || DEFAULT_ACCOUNT_FILTERS;
  const updateFilter = useCallback((field, value) => {
    setAccountFilters((current) => ({
      ...current,
      [filterKey]: { ...activeFilters, [field]: value, ...(field === 'page' ? {} : { page: 1 }) },
    }));
  }, [filterKey, activeFilters]);

  const notify = useCallback((message, type = 'success') => {
    window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const signOut = useCallback(() => {
    logout();
    setToken('');
    setUser(null);
    setActiveAccount(null);
  }, []);

  const signedIn = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('shaha-user', JSON.stringify(data.user));
    setView('Overview');
  }, []);

  const refreshData = useCallback(() => {
    setRefresh((current) => current + 1);
  }, []);

  const navItems = useMemo(
    () => [
      {
        name: 'Overview',
        icon: LayoutDashboard,
      },
      {
        name: user?.role === 'caller' ? 'Queue' : 'Accounts',
        icon: BriefcaseBusiness,
      },
      ...(canManage
        ? [
            {
              name: 'Allocation',
              icon: Users,
            },
            {
              name: 'Import data',
              icon: CloudUpload,
            },
          ]
        : []),
    ],
    [user?.role, canManage]
  );

  const accountQuery = useMemo(() => {
    if (!['Accounts', 'Queue', 'Allocation'].includes(view)) {
      return '';
    }

    const params = new URLSearchParams({
      page: String(activeFilters.page),
      pageSize: '25',
      q: activeFilters.query,
      status: activeFilters.status,
    });

    if (view === 'Queue') {
      params.set('queue', 'true');
    }

    if (
      activeFilters.office !== 'All offices' &&
      ['head', 'coo', 'manager'].includes(user?.role)
    ) {
      params.set('office', activeFilters.office);
    }

    return params.toString();
  }, [
    view,
    activeFilters,
    user?.role,
    canManage,
  ]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      setToken('');
      setUser(null);
      setActiveAccount(null);
    });

    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    let ignore = false;

    getDashboard()
      .then((data) => {
        if (!ignore) {
          setDashboard(data);
        }
      })
      .catch((error) => {
        if (!ignore) {
          notify(error.message, 'error');
        }
      });

    getTeam()
      .then((data) => {
        if (ignore) {
          return;
        }

        setTeam(data);

        setCallerId((current) => {
          if (current) {
            return current;
          }

          return data.find((member) => member.role === 'caller')?.id || '';
        });
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, [token, user, refresh, notify]);

  useEffect(() => {
    if (!token || !accountQuery) {
      return;
    }

    let ignore = false;

    setLoading(true);

    getAccounts(accountQuery)
      .then((data) => {
        if (!ignore) {
          setAccounts(data);
        }
      })
      .catch((error) => {
        if (!ignore) {
          notify(error.message, 'error');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [token, accountQuery, refresh, notify]);

  useEffect(() => setSelected([]), [
    view,
    user?.id,
    activeFilters.query,
    activeFilters.status,
    activeFilters.office,
  ]);

  function navigateTo(nextView) {
    setView(nextView);
    setMobileNav(false);
  }

  function handleImportComplete(message, type = 'success') {
    notify(message, type);

    if (type === 'success') {
      refreshData();
      setView('Accounts');
    }
  }

  function handleAllocationComplete() {
    refreshData();
    setSelected([]);
  }

  function handleAccountChanged() {
    refreshData();
  }

  if (!token || !user) {
    return <LoginPage onLogin={signedIn} />;
  }

  return (
    <div
      className={`app-shell theme-${roleTheme} min-h-screen bg-shaha-canvas text-shaha-ink`}
    >
      <aside
        className={`sidebar fixed inset-y-0 left-0 z-20 flex w-[244px] flex-col border-r border-[#e8ebe7] bg-white px-[17px] pb-4 pt-[25px] ${
          mobileNav ? 'sidebar-open' : ''
        }`}
      >
        <div className="brand">
          <div className="brand-mark">
            S<span>.</span>
          </div>

          <div>
            <strong>SHAHA</strong>
            <small>FINLEASE</small>
          </div>

          <button
            className="icon-button mobile-close"
            onClick={() => setMobileNav(false)}
          >
            <X size={18} />
          </button>
        </div>

        <div className="workspace-label">RECOVERY WORKSPACE</div>

        <nav className="nav-list">
          {navItems.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${view === name ? 'active' : ''}`}
              onClick={() => navigateTo(name)}
            >
              <Icon size={18} strokeWidth={1.8} />

              <span>{name}</span>

              {name === 'Queue' && dashboard?.pendingPromises > 0 && (
                <span className="nav-count">
                  {dashboard.pendingPromises}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="office-chip">
            <span className="online-dot" />
            <span>{user.office}</span>
          </div>

          <div className="profile-row">
            <div className="avatar">
              {user.name
                .split(' ')
                .map((part) => part[0])
                .slice(0, 2)
                .join('')}
            </div>

            <div className="profile-copy">
              <strong>{user.name}</strong>
              <small>{displayRole(user.role)}</small>
            </div>

            <button
              className="icon-button logout"
              title="Sign out"
              onClick={signOut}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {mobileNav && (
        <div
          className="nav-scrim"
          onClick={() => setMobileNav(false)}
        />
      )}

      <main className="main-area ml-[244px] min-h-screen max-[760px]:ml-0">
        <header className="topbar sticky top-0 z-10 flex h-16 items-center justify-between border-b border-[#e9ece8] bg-white/80 px-10 backdrop-blur-xl max-[1100px]:px-[25px] max-[760px]:h-14 max-[760px]:px-[15px]">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={20} />
          </button>

          <div className="crumb">
            Workspace <span>/</span> <strong>{view}</strong>
          </div>

          <div className="top-actions">
            <div className="today">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </div>

          </div>
        </header>

        <div className="page-content mx-auto w-full max-w-[1390px] px-10 pb-[105px] pt-[34px] max-[1100px]:px-[25px] max-[760px]:px-[15px] max-[760px]:pb-[95px] max-[760px]:pt-[25px]">
          {view === 'Overview' && (
            <OverviewPage
              dashboard={dashboard}
              team={team}
              user={user}
              onNavigate={setView}
              onOpen={setActiveAccount}
            />
          )}

          {['Accounts', 'Queue', 'Allocation'].includes(view) && (
            <AccountsPage
              view={view}
              user={user}
              accounts={accounts}
              loading={loading}
              query={activeFilters.query}
              setQuery={(value) => updateFilter('query', value)}
              status={activeFilters.status}
              setStatus={(value) => updateFilter('status', value)}
              office={activeFilters.office}
              setOffice={(value) => updateFilter('office', value)}
              page={activeFilters.page}
              setPage={(value) => updateFilter('page', value)}
              selected={selected}
              setSelected={setSelected}
              onOpen={setActiveAccount}
              onAllocate={() => setView('Allocation')}
              canManage={canManage}
            />
          )}

          {view === 'Import data' && (
            <ImportPage onDone={handleImportComplete} />
          )}
        </div>
      </main>

      {view === 'Allocation' && canManage && (
        <AllocationBar
          selected={selected}
          team={team}
          callerId={callerId}
          setCallerId={setCallerId}
          notify={notify}
          onDone={handleAllocationComplete}
        />
      )}

      {activeAccount && (
        <AccountDrawer
          loanNo={activeAccount}
          onClose={() => setActiveAccount(null)}
          notify={notify}
          onChanged={handleAccountChanged}
        />
      )}

      {toast && (
        <div
          className={`toast toast-${toast.type} flex items-center gap-2`}
          role={toast.type === 'error' ? 'alert' : 'status'}
        >
          {toast.type === 'error'
            ? <CircleAlert size={16} />
            : <Check size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

export default App;
