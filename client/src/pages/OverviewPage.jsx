
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
    key: 'collected',
    icon: Wallet,
    title: 'Collected this month',
    value: (dashboard) => dashboard ? cash(dashboard.monthCollected) : '—',
    foot: (dashboard) => `${cash(dashboard?.totalPaid)} total received to date`,
    color: 'mint',
  },
  {
    key: 'accounts',
    icon: BriefcaseBusiness,
    title: (user) =>
      user.role === 'caller' ? 'My accounts' : 'Accounts in view',
    value: (dashboard) =>
      dashboard?.totalAccounts?.toLocaleString('en-IN') || '—',
    foot: (dashboard) =>
      `${dashboard?.assigned?.toLocaleString('en-IN') || 0} currently assigned`,
    color: 'mint',
  },
  {
    key: 'outstanding',
    icon: Wallet,
    title: 'Remaining balance',
    value: (dashboard) =>
      dashboard ? cash(dashboard.remainingBalance) : '—',
    foot: (dashboard) => `${cash(dashboard?.totalOutstanding)} original portfolio`,
    color: 'blue',
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
    key: 'callers',
    icon: Headphones,
    title: 'Active callers',
    value: (dashboard) => dashboard?.callers ?? '—',
    foot: (dashboard, user) =>
      user.role === 'caller'
        ? 'Your caller profile'
        : 'Across your team scope',
    color: 'purple',
  },
];

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
            ? metric.title(user)
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

function CallerWorkload({ team, user }) {
  if (!['head', 'coo', 'manager'].includes(user.role)) return null;
  const callers = team.filter((member) => member.role === 'caller');
  const totalAssigned = callers.reduce((sum, member) => sum + (member._count?.accounts || 0), 0);
  return (
    <section className="panel workload-panel">
      <div className="panel-heading">
        <div>
          <h3>Caller workload</h3>
          <p>Accounts currently assigned to each caller</p>
        </div>
        <strong>{totalAssigned.toLocaleString('en-IN')} assigned</strong>
      </div>
      {callers.length ? (
        <div className="workload-list">
          {callers.map((caller) => (
            <div className="workload-row" key={caller.id}>
              <span className="workload-avatar">{caller.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
              <span className="workload-name"><strong>{caller.name}</strong><small>{caller.office?.name || 'Office not set'}</small></span>
              <strong className="workload-count">{(caller._count?.accounts || 0).toLocaleString('en-IN')}<small> accounts</small></strong>
            </div>
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
  team,
  user,
  onNavigate,
  onOpen,
}) {
  return (
    <>
      <PageHeading user={user} onNavigate={onNavigate} />

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

      <CallerWorkload team={team} user={user} />

      <WelcomeStrip user={user} onNavigate={onNavigate} />
    </>
  );
}
