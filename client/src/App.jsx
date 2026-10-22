
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BriefcaseBusiness,
  Bell,
  CalendarDays,
  Check,
  CircleAlert,
  CloudUpload,
  Crown,
  FileCheck2,
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
import SettlementRequestsPage from './pages/SettlementRequestsPage.jsx';
import AccountDrawer from './components/AccountDrawer.jsx';
import CallerDetailsModal from './components/CallerDetailsModal.jsx';

import { displayRole } from './utils/format.js';
import { setUnauthorizedHandler } from './services/apiClient.js';
import { getAccounts } from './services/accountService.js';
import { logout } from './services/authService.js';
import { getCallerDetails, getDashboard, getNotifications, getSettlementRequests, getTeam, markNotificationRead } from './services/workspaceService.js';

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
  const [notifications, setNotifications] = useState({ items: [], unreadCount: 0 });
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [settlementRequests, setSettlementRequests] = useState([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [selectedCallerId, setSelectedCallerId] = useState('');
  const [callerDetails, setCallerDetails] = useState(null);
  const [callerDetailsLoading, setCallerDetailsLoading] = useState(false);

  const [accountFilters, setAccountFilters] = useState({});

  const [selected, setSelected] = useState([]);
  const [callerId, setCallerId] = useState('');

  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardFilter, setDashboardFilter] = useState(() => {
    const now = new Date();
    return { period: 'month', month: now.getMonth() + 1, year: now.getFullYear() };
  });
  const [team, setTeam] = useState([]);
  const [accounts, setAccounts] = useState({
    rows: [],
    total: 0,
    page: 1,
  });

  const canManage = ['head', 'coo', 'manager'].includes(user?.role);
  const canReviewClosures = ['manager', 'head'].includes(user?.role);
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
    setSelectedCallerId('');
    setCallerDetails(null);
    setNotificationOpen(false);
    setNotifications({ items: [], unreadCount: 0 });
  }, []);

  const signedIn = useCallback((data) => {
    setToken(data.token);
    setUser(data.user);
    setSelectedCallerId('');
    setCallerDetails(null);
    setNotifications({ items: [], unreadCount: 0 });
    setNotificationOpen(false);
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
            ...(canReviewClosures ? [{
              name: 'Settlement requests',
              icon: FileCheck2,
            }] : []),
            {
              name: 'Import data',
              icon: CloudUpload,
            },
          ]
        : []),
    ],
    [user?.role, canManage, canReviewClosures]
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

    getDashboard(dashboardFilter)
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

    return () => {
      ignore = true;
    };
  }, [token, user, refresh, notify, dashboardFilter]);

  useEffect(() => {
    if (!token || !user) return undefined;
    let ignore = false;
    getTeam()
      .then((data) => {
        if (ignore) return;
        setTeam(data);
        setCallerId((current) => current || data.find((member) => member.role === 'caller')?.id || '');
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, [token, user, refresh]);

  const loadNotifications = useCallback(() => {
    getNotifications().then(setNotifications).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || !user) return undefined;
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(timer);
  }, [token, user?.id, loadNotifications]);

  useEffect(() => {
    if (!token || view !== 'Settlement requests') return undefined;
    let ignore = false;
    setSettlementLoading(true);
    getSettlementRequests()
      .then((data) => { if (!ignore) setSettlementRequests(data.items || []); })
      .catch((error) => { if (!ignore) notify(error.message, 'error'); })
      .finally(() => { if (!ignore) setSettlementLoading(false); });
    return () => { ignore = true; };
  }, [token, view, refresh, notify]);

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
    loadNotifications();
  }

  async function showCallerDetails(callerId) {
    setSelectedCallerId(callerId);
    setCallerDetails(null);
    setCallerDetailsLoading(true);
    try {
      setCallerDetails(await getCallerDetails(callerId));
    } catch (error) {
      notify(error.message, 'error');
      setSelectedCallerId('');
    } finally {
      setCallerDetailsLoading(false);
    }
  }

  function openAccountFromCaller(loanNo) {
    setSelectedCallerId('');
    setActiveAccount(loanNo);
  }

  async function openNotification(item) {
    setNotificationOpen(false);
    try {
      await markNotificationRead(item.id);
      setNotifications((current) => ({
        ...current,
        items: current.items.map((notification) => notification.id === item.id
          ? { ...notification, readAt: notification.readAt || new Date().toISOString() }
          : notification),
        unreadCount: Math.max(0, current.unreadCount - (item.readAt ? 0 : 1)),
      }));
    } catch { /* A refresh on the next poll will reconcile notification state. */ }
    setActiveAccount(item.accountId);
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
          <div className="brand-mark" aria-hidden="true">
            <Crown size={23} strokeWidth={2.1} />
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

        <div className="workspace-label">COLLECTIONS OPERATIONS</div>

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
              {name === 'Settlement requests' && dashboard?.pendingSettlementRequests > 0 && (
                <span className="nav-count">{dashboard.pendingSettlementRequests}</span>
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
{user?.role === 'caller' && (
            <div className="notification-wrap">
              <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationOpen} onClick={() => { setNotificationOpen((open) => !open); loadNotifications(); }}>
                <Bell size={18} />
                {notifications.unreadCount > 0 && <span className="notification-count">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>}
              </button>
              {notificationOpen && <div className="notification-panel">
                <div className="notification-panel-heading"><strong>Settlement Notifications</strong><span>{notifications.unreadCount} unread</span></div>
                {notifications.items.length ? notifications.items.map((item) => (
                  <button key={item.id} className={`notification-item ${item.readAt ? '' : 'unread'}`} onClick={() => openNotification(item)}>
                    <span className="notification-dot" />
                    <span><strong>{item.title}</strong><small>{item.message}</small><em>{new Date(item.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</em></span>
                  </button>
                )) : <div className="notification-empty">No notifications yet.</div>}
              </div>}
            </div>)}

          </div>
        </header>

        <div className="page-content mx-auto w-full max-w-[1390px] px-10 pb-[105px] pt-[34px] max-[1100px]:px-[25px] max-[760px]:px-[15px] max-[760px]:pb-[95px] max-[760px]:pt-[25px]">
          {view === 'Overview' && (
            <OverviewPage
              dashboard={dashboard}
              dashboardFilter={dashboardFilter}
              onDashboardFilterChange={setDashboardFilter}
              team={team}
              user={user}
              onNavigate={setView}
              onOpen={setActiveAccount}
              onCallerClick={showCallerDetails}
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

          {view === 'Settlement requests' && canReviewClosures && (
            <SettlementRequestsPage
              requests={settlementRequests}
              loading={settlementLoading}
              notify={notify}
              onChanged={refreshData}
              onOpenAccount={setActiveAccount}
              user={user}
            />
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
          user={user}
          onClose={() => setActiveAccount(null)}
          notify={notify}
          onChanged={handleAccountChanged}
        />
      )}

      {selectedCallerId && (
        <CallerDetailsModal
          caller={callerDetails?.caller || team.find((member) => member.id === selectedCallerId)}
          details={callerDetails}
          loading={callerDetailsLoading}
          onClose={() => setSelectedCallerId('')}
          onOpenAccount={openAccountFromCaller}
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
