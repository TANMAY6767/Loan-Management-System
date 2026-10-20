import {
  Activity,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Phone,
  Wallet,
  X,
} from 'lucide-react';
import { cash, dateTime, statusName } from '../utils/format.js';

function ActivityIcon({ type }) {
  if (type === 'Call') return <Phone size={15} />;
  if (type === 'Payment') return <Wallet size={15} />;
  if (type === 'Promise to pay') return <CalendarClock size={15} />;
  if (type === 'Allocation') return <BriefcaseBusiness size={15} />;
  return <CircleDollarSign size={15} />;
}

function Metric({ icon: Icon, label, value, foot }) {
  return (
    <div className="caller-detail-metric">
      <span><Icon size={16} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{foot}</em>
    </div>
  );
}

export default function CallerDetailsModal({ caller, details, loading, onClose, onOpenAccount }) {
  if (!caller) return null;
  const metrics = details?.metrics;
  const accounts = details?.accounts || [];
  const activity = details?.activity || [];

  return (
    <div className="caller-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="caller-detail-modal" role="dialog" aria-modal="true" aria-label={`${caller.name} caller details`}>
        <header className="caller-detail-header">
          <div className="caller-detail-identity">
            <span className="workload-avatar">{caller.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
            <div><small>CALLER PERFORMANCE</small><h2>{caller.name}</h2><span>{caller.office?.name || 'Office not set'}{caller.manager?.name ? ` · Reports to ${caller.manager.name}` : ''}</span></div>
          </div>
          <button className="icon-button" aria-label="Close caller details" onClick={onClose}><X size={18} /></button>
        </header>

        {loading ? <div className="caller-detail-loading">Loading caller portfolio and activity…</div> : details && <>
          <div className="caller-detail-metrics">
            <Metric icon={BriefcaseBusiness} label="Assigned accounts" value={metrics.assignedAccounts.toLocaleString('en-IN')} foot="Currently assigned" />
            <Metric icon={CircleDollarSign} label="Portfolio outstanding" value={cash(metrics.assignedOutstanding)} foot="Assigned accounts" />
            <Metric icon={Wallet} label="Recovered on portfolio" value={cash(metrics.recovered)} foot={`${metrics.recoveryPercent == null ? 'N/A' : `${Math.round(metrics.recoveryPercent)}%`} of assigned amount`} />
            <Metric icon={CheckCircle2} label="Remaining balance" value={cash(metrics.remaining)} foot="Unresolved accounts only" />
            <Metric icon={ArrowUpRight} label="Recovery posted by caller" value={cash(metrics.recoveryByCaller)} foot="Payments recorded by this caller" />
          </div>

          <div className="caller-detail-columns">
            <section className="caller-detail-section caller-assigned-section">
              <div className="caller-detail-section-heading"><div><h3>Assigned accounts</h3><p>{accounts.length.toLocaleString('en-IN')} accounts in this caller’s queue</p></div></div>
              {accounts.length ? <div className="caller-account-list">
                {accounts.map((account) => (
                  <button className="caller-account-row" key={account.loanNo} onClick={() => onOpenAccount(account.loanNo)}>
                    <span className="caller-account-copy"><strong>{account.customerName}</strong><small>{account.loanNo} · {account.office.name} · {account.product}</small></span>
                    <span className="caller-account-status">{statusName(account.status)}</span>
                    <span className="caller-account-money"><strong>{cash(account.outstanding)}</strong><small>{cash(account.paid)} recovered</small></span>
                    <ArrowUpRight size={15} />
                  </button>
                ))}
              </div> : <div className="caller-detail-empty">No accounts are currently assigned to this caller. Recovery rate: N/A.</div>}
            </section>

            <section className="caller-detail-section caller-activity-section">
              <div className="caller-detail-section-heading"><div><h3>Caller activity</h3><p>{activity.length.toLocaleString('en-IN')} recorded actions</p></div></div>
              {activity.length ? <div className="caller-activity-list">
                {activity.map((item) => (
                  <article className="caller-activity-row" key={item.id}>
                    <span className={`caller-activity-icon activity-${item.type.toLowerCase().replaceAll(' ', '-')}`}><ActivityIcon type={item.type} /></span>
                    <div className="caller-activity-copy"><strong>{item.title}</strong><span>{item.customerName} · {item.accountId}</span>{item.description && <small>{item.description}</small>}</div>
                    <button className="caller-activity-open" aria-label={`Open ${item.accountId}`} onClick={() => onOpenAccount(item.accountId)}><ArrowUpRight size={14} /></button>
                    <time>{dateTime(item.createdAt)}</time>
                  </article>
                ))}
              </div> : <div className="caller-detail-empty">No caller activity has been recorded in your workspace scope.</div>}
            </section>
          </div>
        </>}
      </section>
    </div>
  );
}
