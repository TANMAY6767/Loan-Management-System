
import {
  Activity,
  ArrowRight,
  BriefcaseBusiness,
  ChevronRight,
  Clock3,
  Headphones,
  Phone,
  Wallet,
} from 'lucide-react';

import { cash, dateTime } from '../utils/format.js';

const STATUS_ITEMS = [
  { key: 'New', label: 'New' },
  { key: 'Working', label: 'Working' },
  { key: 'PTP', label: 'PTP' },
  { key: 'Part_paid', label: 'Part-paid' },
];

const METRIC_CONFIG = [
  {
    key: 'selected-collected',
    icon: Wallet,
    title: (dashboard) => dashboard?.selectedPeriod?.type === 'year' ? 'Recovered this year' : 'Recovered this month',
    value: (dashboard) => dashboard ? cash(dashboard.selectedCollected) : '—',
    foot: (dashboard) => dashboard?.selectedPeriod?.type === 'year' ? `Year ${dashboard.selectedPeriod.year}` : `${new Date(2000, (dashboard?.selectedPeriod?.month || 1) - 1).toLocaleString('en-IN', { month: 'long' })} ${dashboard?.selectedPeriod?.year || ''}`,
    color: 'mint',
  },
  {
    key: 'total-recovered',
    icon: Wallet,
    title: 'Total recovered',
    value: (dashboard) => dashboard ? cash(dashboard.totalPaid) : '—',
    foot: 'All payment receipts in view',
    color: 'blue',
  },
  {
    key: 'recovery-rate',
    icon: BriefcaseBusiness,
    title: 'Portfolio recovered',
    value: (dashboard) => dashboard ? `${Math.round(dashboard.recoveryPercent || 0)}%` : '—',
    foot: (dashboard) => `${cash(dashboard?.totalPaid)} of ${cash(dashboard?.totalOutstanding)} original amount`,
    color: 'purple',
  },
  {
    key: 'outstanding',
    icon: Wallet,
    title: 'Remaining balance',
    value: (dashboard) => dashboard ? cash(dashboard.remainingBalance) : '—',
    foot: 'Excludes closed and settled accounts',
    color: 'blue',
  },
  {
    key: 'today-collected',
    icon: Wallet,
    title: 'Recovered today',
    value: (dashboard) => dashboard ? cash(dashboard.todayCollected) : '—',
    foot: 'Payments recorded today',
    color: 'mint',
  },
  {
    key: 'promises',
    icon: Clock3,
    title: 'Promises to follow up',
    value: (dashboard) => dashboard?.pendingPromises ?? '—',
    foot: 'Pending payment promises',
    color: 'amber',
  },
  {
    key: 'settlements',
    icon: Clock3,
    title: 'Settlement approvals',
    value: (dashboard) => dashboard?.pendingSettlementRequests ?? '—',
    foot: 'Requests awaiting your review',
    color: 'amber',
  },
];

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Date(2000, index).toLocaleString('en-IN', { month: 'long' }),
}));

function RecoveryFilters({ dashboardFilter, onChange }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: Math.max(6, currentYear - 2018 + 1) }, (_, index) => currentYear - index);
  return (
    <div className="recovery-filters" aria-label="Recovery period filters">
      <span>Recovery period</span>
      <label><span className="sr-only">Period</span><select value={dashboardFilter.period} onChange={(event) => onChange({ ...dashboardFilter, period: event.target.value })}>
        <option value="month">Month</option><option value="year">Year</option>
      </select></label>
      {dashboardFilter.period === 'month' && <label><span className="sr-only">Month</span><select value={dashboardFilter.month} onChange={(event) => onChange({ ...dashboardFilter, month: Number(event.target.value) })}>
        {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
      </select></label>}
      <label><span className="sr-only">Year</span><select value={dashboardFilter.year} onChange={(event) => onChange({ ...dashboardFilter, year: Number(event.target.value) })}>
        {years.map((year) => <option key={year} value={year}>{year}</option>)}
      </select></label>
    </div>
  );
}

function getGreeting() {
  return new Date().getHours() < 12 ? 'morning' : 'afternoon';
}

function getTodayLabel() {
  return new Date()
    .toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    .toUpperCase();
}

function PageHeading({ user, onNavigate }) {
  const destination =
    user.role === 'caller' ? 'Queue' : 'Accounts';

  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{getTodayLabel()}</div>

        <h1>
          Good {getGreeting()}, {user.name.split(' ')[0]}{' '}
          <span className="wave">✦</span>
        </h1>

        <p>
          Here’s the recovery picture across your workspace.
        </p>
      </div>

      <button
        className="secondary-button"
        onClick={() => onNavigate(destination)}
      >
        <BriefcaseBusiness size={16} />
        View accounts
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

function MetricCard({ icon: Icon, title, value, foot, color }) {
  return (
    <section className="metric-card">
      <div className="metric-top">
        <div className={`metric-icon ${color}`}>
          <Icon size={18} />
        </div>
      </div>

      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>

      <div className="metric-foot">
        <span className="metric-foot-dot" />
        {foot}
      </div>
    </section>
  );
}

function MetricsGrid({ dashboard, user }) {
  return (
    <div className="metric-grid">
      {METRIC_CONFIG.map((metric) => {
        const title =
          typeof metric.title === 'function'
          ? metric.title(dashboard, user)
            : metric.title;

        const value = metric.value(dashboard);

        const foot =
          typeof metric.foot === 'function'
            ? metric.foot(dashboard, user)
            : metric.foot;

        return (
          <MetricCard
            key={metric.key}
            icon={metric.icon}
            title={title}
            value={value}
            foot={foot}
            color={metric.color}
          />
        );
      })}
    </div>
  );
}

function StatusLegend({ dashboard }) {
  const statuses = dashboard?.statuses;

  const closedAndSettled = statuses
    ? (statuses.Closed || 0) + (statuses.Settled || 0)
    : null;

  const items = [
    ...STATUS_ITEMS.map(({ key, label }) => ({
      key,
      label,
      count: statuses?.[key],
    })),
    {
      key: 'Closed',
      label: 'Closed / settled',
      count: closedAndSettled,
    },
  ];

  return (
    <div className="status-legend">
      {items.map(({ key, label, count }) => (
        <div key={label}>
          <span className={`legend-dot ${key.toLowerCase()}`} />
          <span>{label}</span>

          <strong>
            {count == null
              ? '—'
              : count.toLocaleString('en-IN')}
          </strong>
        </div>
      ))}
    </div>
  );
}

function PortfolioSnapshot({ dashboard }) {
  const totalAccounts = dashboard?.totalAccounts || 0;
  const assignedAccounts = dashboard?.assigned || 0;

  const assignmentRate = totalAccounts
    ? (assignedAccounts / totalAccounts) * 100
    : 0;

  const assignmentPercent = Math.round(assignmentRate);

  return (
    <section className="panel portfolio-panel">
      <div className="panel-heading">
        <div>
          <h3>Portfolio snapshot</h3>
          <p>Account status across your workspace</p>
        </div>

        <span className="select-wrap compact office-label">
          All offices
        </span>
      </div>

      <div className="status-summary">
        <div
          className="donut"
          style={{ '--progress': `${assignmentRate}%` }}
        >
          <div>
            <strong>
              {dashboard ? `${assignmentPercent}%` : '—'}
            </strong>
            <small>assigned</small>
          </div>
        </div>

        <StatusLegend dashboard={dashboard} />
      </div>

      <div className="panel-foot">
        <span>
          <span className="tiny-dot" />
          Assignment coverage
        </span>

        <strong>{assignmentPercent}%</strong>
      </div>

      <div className="progress-line">
        <span style={{ width: `${assignmentRate}%` }} />
      </div>
    </section>
  );
}

function ActivityRow({ item, onOpen }) {
  return (
    <div className="activity-row">
      <div className="activity-icon">
        <Phone size={15} />
      </div>

      <div className="activity-copy">
        <strong>{item.account.customerName}</strong>
        <span>
          {item.disposition} · {item.user.name}
        </span>
      </div>

      <div className="activity-time">
        {dateTime(item.createdAt)}
      </div>

      <button
        className="row-open"
        onClick={() => onOpen(item.account.loanNo)}
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function EmptyActivity() {
  return (
    <div className="empty-activity">
      <div className="empty-icon">
        <Activity size={20} />
      </div>

      <strong>No activity yet</strong>
      <span>
        Call notes will appear here after your team gets started.
      </span>
    </div>
  );
}

function ActivityPanel({ dashboard, user, onNavigate, onOpen }) {
  const recentActivity = dashboard?.recent || [];

  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <h3>Recent activity</h3>
          <p>Latest call notes from your team</p>
        </div>

        <button
          className="text-button"
          onClick={() => onNavigate(user.role === 'caller' ? 'Queue' : 'Accounts')}
        >
          All accounts
          <ArrowRight size={14} />
        </button>
      </div>

      <div className="activity-list">
        {recentActivity.length > 0 ? (
          recentActivity.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              onOpen={onOpen}
            />
          ))
        ) : (
          <EmptyActivity />
        )}
      </div>
    </section>
  );
}

function CallerWorkload({ team, user, onCallerClick }) {
  if (!['head', 'coo', 'manager'].includes(user.role)) return null;
  const callers = team.filter((member) => member.role === 'caller');
  const totalAssigned = callers.reduce((sum, member) => sum + (member._count?.accounts || 0), 0);
  return (
    <section className="panel workload-panel">
      <div className="panel-heading">
        <div>
          <h3>Caller workload</h3>
          <p>Click a caller to review their assigned portfolio, recovery and activity</p>
        </div>
        <strong>{totalAssigned.toLocaleString('en-IN')} assigned</strong>
      </div>
      {callers.length ? (
        <div className="workload-list">
          {callers.map((caller) => (
            <button className="workload-row" key={caller.id} onClick={() => onCallerClick(caller.id)}>
              <span className="workload-avatar">{caller.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
              <span className="workload-name"><strong>{caller.name}</strong><small>{caller.office?.name || 'Office not set'}</small></span>
              <strong className="workload-count">{(caller._count?.accounts || 0).toLocaleString('en-IN')}<small> accounts</small></strong>
              <span className="caller-recovery-ring" style={{ '--progress': `${Math.min(100, Math.max(0, caller.recoveryPercent || 0))}%` }}>
                <span><strong>{caller.recoveryPercent == null ? 'N/A' : `${Math.round(caller.recoveryPercent)}%`}</strong><small>{caller.recoveryPercent == null ? 'no accounts' : 'recovered'}</small></span>
              </span>
              <ChevronRight className="caller-detail-arrow" size={17} />
            </button>
          ))}
        </div>
      ) : <div className="workload-empty">No callers in this team yet.</div>}
    </section>
  );
}

function WelcomeStrip({ user, onNavigate }) {
  const destination =
    user.role === 'caller' ? 'Queue' : 'Accounts';

  return (
    <div className="welcome-strip">
      <div className="welcome-icon">
        <Headphones size={19} />
      </div>

      <div>
        <strong>Your recovery queue is ready</strong>
        <span>
          Open an account to log a call, add a promise, or record a payment.
        </span>
      </div>

      <button onClick={() => onNavigate(destination)}>
        Go to queue
        <ArrowRight size={15} />
      </button>
    </div>
  );
}

export default function OverviewPage({
  dashboard,
  dashboardFilter,
  onDashboardFilterChange,
  team,
  user,
  onNavigate,
  onOpen,
  onCallerClick,
}) {
  return (
    <>
      <PageHeading user={user} onNavigate={onNavigate} />

      <RecoveryFilters dashboardFilter={dashboardFilter} onChange={onDashboardFilterChange} />
      <MetricsGrid dashboard={dashboard} user={user} />

      <div className="overview-grid">
        <PortfolioSnapshot dashboard={dashboard} />

        <ActivityPanel
          dashboard={dashboard}
          user={user}
          onNavigate={onNavigate}
          onOpen={onOpen}
        />
      </div>

      <CallerWorkload team={team} user={user} onCallerClick={onCallerClick} />

      <WelcomeStrip user={user} onNavigate={onNavigate} />
    </>
  );
}
