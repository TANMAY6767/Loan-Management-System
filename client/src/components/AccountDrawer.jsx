
import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Banknote,
  Clock3,
  Phone,
  X,
} from 'lucide-react';

import { cash, date, dateTime, statusName } from '../utils/format.js';
import {
  createPromise,
  createSettlementOffer,
  getAccount,
  logCall,
  recordPayment,
  reviewSettlementOffer,
} from '../services/accountService.js';

const ACCOUNT_ACTIONS = {
  calls: logCall,
  promises: createPromise,
  payments: recordPayment,
};

const CALL_DISPOSITIONS = [
  'No answer',
  'Busy',
  'Connected',
  'Wrong number',
  'Call back requested',
  'Refused to pay',
  'Promise to pay',
  'Dispute raised',
];

const DRAWER_TABS = ['Overview', 'Activity', 'Payments'];

function getInitialCall() {
  return {
    disposition: 'No answer',
    remarks: '',
    followUpAt: '',
  };
}

function getInitialPromise() {
  return {
    amount: '',
    dueDate: '',
  };
}

function getInitialPayment() {
  return {
    amount: '',
    reference: '',
    paidAt: new Date().toISOString().slice(0, 10),
  };
}

function getAccountInitials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
}

function getActivityItems(account) {
  const callItems = account.calls.map((item) => ({
    kind: 'call',
    at: item.createdAt,
    title: item.disposition,
    body: item.remarks,
    by: item.user.name,
  }));

  const promiseItems = account.promises.map((item) => ({
    kind: 'promise',
    at: item.createdAt,
    title: `Promise · ${cash(item.amount)}`,
    body: `${item.status} · due ${date(item.dueDate)}`,
    by: item.user.name,
  }));

  const allocationItems = account.allocations.map((item) => ({
    kind: 'allocation',
    at: item.allocatedAt,
    title: `Assigned to ${item.user.name}`,
    body: item.fromUserId
      ? `Reassigned from ${item.fromUser?.name || item.fromUserId}`
      : 'First assignment',
    by: item.allocator?.name || 'Allocation',
  }));

  const settlementItems = (account.settlements || []).map((item) => ({
    kind: 'promise',
    at: item.reviewedAt || item.createdAt,
    title: `Settlement ${item.status.toLowerCase()} · ${cash(item.amount)}`,
    body: item.reviewedBy ? `Reviewed by ${item.reviewedBy.name}` : 'Awaiting management review',
    by: item.reviewedBy?.name || item.requestedBy.name,
  }));

  return [...callItems, ...promiseItems, ...allocationItems, ...settlementItems].sort(
    (a, b) => new Date(b.at) - new Date(a.at)
  );
}

function getPaymentItems(payments) {
  return payments.map((item) => ({
    kind: 'payment',
    at: item.paidAt,
    title: `Payment received · ${cash(item.amount)}`,
    body: item.reference || item.notes || 'Payment recorded',
    by: item.user.name,
  }));
}

function DrawerLoading({ onClose }) {
  return (
    <div
      className="drawer-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="drawer"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-loading">Loading account…</div>
      </div>
    </div>
  );
}

function DrawerHeader({ loanNo, onClose }) {
  return (
    <div className="drawer-head">
      <div>
        <div className="eyebrow">ACCOUNT DETAILS</div>
        <span className="drawer-loan">{loanNo}</span>
      </div>

      <button
        className="icon-button"
        onClick={onClose}
        aria-label="Close account details"
      >
        <X size={19} />
      </button>
    </div>
  );
}

function CustomerSummary({ account }) {
  return (
    <div className="drawer-person">
      <div className="person-avatar">
        {getAccountInitials(account.customerName)}
      </div>

      <div>
        <h2>{account.customerName}</h2>

        <span>
          <Phone size={13} />
          {account.mobile}
        </span>
      </div>

      <span
        className={`status-pill status-${account.status.toLowerCase()}`}
      >
        {statusName(account.status)}
      </span>
    </div>
  );
}

function BalanceSummary({ account }) {
  const totalPaid = Number(account.paid || 0);
  const approvedOffer = account.settlements?.find((offer) => offer.status === 'Approved');
  const remainingBalance = Math.max(
    0,
    Number(account.outstanding) - totalPaid
  );
  const amountRemaining = ['Closed', 'Settled'].includes(account.status)
    ? 0
    : remainingBalance;

  return (
    <div className="balance-card">
      <div>
        <span>Outstanding</span>
        <strong>{cash(account.outstanding)}</strong>
      </div>

      <div>
        <span>Total paid</span>
        <strong className="paid-green">{cash(totalPaid)}</strong>
      </div>

      <div className="balance-rule" />

      <div className="balance-remaining">
        <span>Remaining balance</span>
        <strong>{cash(amountRemaining)}</strong>
      </div>

      {approvedOffer && (
        <>
          <div className="balance-rule" />
          <div className="approved-agreement-row">
            <span>Approved {approvedOffer.type === 'Settlement' ? 'settlement' : 'closure'} amount</span>
            <strong>{cash(approvedOffer.amount)}</strong>
          </div>
          <div className="balance-remaining approved-agreement-row">
            <span>Remaining {approvedOffer.type === 'Settlement' ? 'settlement' : 'closure'} amount</span>
            <strong>{cash(['Closed', 'Settled'].includes(account.status)
              ? 0
              : Math.max(0, Number(approvedOffer.amount) - totalPaid))}</strong>
          </div>
          <p className="approved-agreement-note">
            After this amount is recovered, the account status changes to {approvedOffer.type === 'Settlement' ? 'Settled' : 'Closed'}.
          </p>
        </>
      )}
    </div>
  );
}

function DrawerTabs({ activeTab, setActiveTab }) {
  return (
    <div className="drawer-tabs">
      {DRAWER_TABS.map((tab) => (
        <button
          className={activeTab === tab ? 'tab-active' : ''}
          key={tab}
          onClick={() => setActiveTab(tab)}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LoanDetails({ account }) {
  const details = [
    { label: 'Customer phone', value: account.mobile },
    { label: 'Email', value: account.email || '—' },
    {
      label: 'City / State',
      value: `${account.city}, ${account.state}`,
    },
    { label: 'Office', value: account.office.name },
    {
      label: 'Portfolio',
      value: `${account.portfolio} · ${account.sellerBank}`,
    },
    { label: 'Language', value: account.language },
    { label: 'NPA date', value: date(account.npaDate) },
    { label: 'Last payment', value: date(account.lastPaymentDate) },
    {
      label: 'Assigned to',
      value: account.assignedTo?.name || 'Unassigned',
    },
  ];

  return (
    <div className="detail-section">
      <div className="section-title">
        <h3>Loan details</h3>
        <span>{account.product}</span>
      </div>

      <div className="detail-grid">
        {details.map(({ label, value }) => (
          <Detail
            key={label}
            label={label}
            value={value}
          />
        ))}
      </div>
    </div>
  );
}

function CallForm({ call, setCall, busy, onSubmit }) {
  function updateCall(field, value) {
    setCall((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit('calls', call, 'Call note saved.');
  }

  return (
    <div className="action-form">
      <h3>
        <Phone size={15} />
        Log a call
      </h3>

      <p className="fair-contact-note">Keep contact respectful and non-coercive. Company policy permits calls from 8:00 a.m. to 7:00 p.m. unless the customer has agreed otherwise.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Outcome

          <select
            value={call.disposition}
            onChange={(event) =>
              updateCall('disposition', event.target.value)
            }
          >
            {CALL_DISPOSITIONS.map((disposition) => (
              <option key={disposition} value={disposition}>
                {disposition}
              </option>
            ))}
          </select>
        </label>

        <label>
          Remarks

          <input
            value={call.remarks}
            onChange={(event) =>
              updateCall('remarks', event.target.value)
            }
            placeholder="Add a short note"
          />
        </label>

        <div className="form-inline">
          <label>
            Next follow-up

            <input
              type="date"
              value={call.followUpAt}
              onChange={(event) =>
                updateCall('followUpAt', event.target.value)
              }
            />
          </label>

          <button
            className="secondary-button"
            disabled={busy}
          >
            Save call
          </button>
        </div>
      </form>
    </div>
  );
}

function PromiseForm({ promise, setPromise, busy, onSubmit }) {
  function updatePromise(field, value) {
    setPromise((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit('promises', promise, 'Promise to pay recorded.');
  }

  return (
    <div className="action-form">
      <h3>
        <Clock3 size={15} />
        Promise to pay
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="form-inline">
          <label>
            Promise amount

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={promise.amount}
              onChange={(event) =>
                updatePromise('amount', event.target.value)
              }
              placeholder="₹ amount"
              required
            />
          </label>

          <label>
            Promise date

            <input
              type="date"
              value={promise.dueDate}
              onChange={(event) =>
                updatePromise('dueDate', event.target.value)
              }
              required
            />
          </label>
        </div>

        <button
          className="secondary-button"
          disabled={busy}
        >
          Save promise
        </button>
      </form>
    </div>
  );
}

function PaymentForm({ account, payment, setPayment, busy, onSubmit }) {
  function updatePayment(field, value) {
    setPayment((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSubmit('payments', payment, 'Payment recorded.');
  }

  return (
    <div className="action-form">
      <h3>
        <Banknote size={15} />
        Record a payment
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="form-inline">
          <label>
            Amount received

            <input
              type="number"
              min="0.01"
              step="0.01"
              value={payment.amount}
              onChange={(event) =>
                updatePayment('amount', event.target.value)
              }
              placeholder="₹ amount"
              required
            />
          </label>

          <label>
            Payment date

            <input
              type="date"
              value={payment.paidAt}
              onChange={(event) =>
                updatePayment('paidAt', event.target.value)
              }
              required
            />
          </label>
        </div>

        <label>
          Reference / receipt

          <input
            value={payment.reference}
            onChange={(event) =>
              updatePayment('reference', event.target.value)
            }
            placeholder="Optional reference"
          />
        </label>

        <button
          className="primary-button"
          disabled={busy}
        >
          Record payment
          <ArrowRight size={15} />
        </button>
      </form>
    </div>
  );
}

function SettlementWorkflow({ account, user, busy, onRequest, onReview }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('Settlement');
  const offers = account.settlements || [];
  const activeOffer = offers.find((offer) => ['Pending', 'Approved'].includes(offer.status));
  const canRequest = ['head', 'coo', 'manager', 'caller'].includes(user.role);
  const canReview = (user.role === 'manager' && activeOffer?.stage === 'Manager') ||
    (user.role === 'head' && activeOffer?.stage === 'Head');

  function submit(event) {
    event.preventDefault();
    onRequest({ amount, type }, () => setAmount(''));
  }

  return (
    <section className="settlement-workflow">
      <div className="section-title">
        <h3>Closure and settlement approval</h3>
        <span>Head of Collections approval is required</span>
      </div>

      {offers.length > 0 && (
        <div className="settlement-list">
          {offers.map((offer) => (
            <div className="settlement-row" key={offer.id}>
              <div>
                <strong>{offer.type === 'Settlement' ? 'Settlement' : 'Regular closure'} · {cash(offer.amount)}</strong>
                <span>{offer.status}{offer.status === 'Pending' ? ` · awaiting ${offer.stage === 'Manager' ? 'manager' : 'Head of Collections'}` : ''} · requested by {offer.requestedBy.name}</span>
                {offer.reviewedBy && <small>Reviewed by {offer.reviewedBy.name} · {dateTime(offer.reviewedAt)}</small>}
                {offer.managerReviewedBy && <small>Manager review by {offer.managerReviewedBy.name} · {dateTime(offer.managerReviewedAt)}</small>}
              </div>
              {offer.status === 'Pending' && canReview && offer.requestedById !== user.id && (
                <div className="settlement-actions">
                  <button className="secondary-button" disabled={busy} onClick={() => onReview(offer.id, 'reject')}>Reject</button>
                  <button className="primary-button" disabled={busy} onClick={() => onReview(offer.id, 'approve')}>Approve</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!activeOffer && canRequest && !['Closed', 'Settled'].includes(account.status) && (
        <form className="settlement-request-form" onSubmit={submit}>
          <label>
            Request type
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="Settlement">Settlement</option>
              <option value="Closure">Regular closure</option>
            </select>
            Agreed payment amount
            <input type="number" min="0.01" step="0.01" max={account.outstanding} value={amount} onChange={(event) => setAmount(event.target.value)} required placeholder="₹ amount" />
          </label>
          <button className="secondary-button" disabled={busy}>Request approval</button>
        </form>
      )}

      {activeOffer?.status === 'Pending' && (
        <p className="settlement-hint">This request is awaiting {activeOffer.stage === 'Manager' ? 'manager review, then Head of Collections approval' : 'Head of Collections approval'}. Once approved, the account stays Part-paid until the agreed amount is fully recovered.</p>
      )}
    </section>
  );
}

function AccountOverview({
  account,
  call,
  setCall,
  promise,
  setPromise,
  payment,
  setPayment,
  busy,
  onSubmit,
  user,
  onSettlementRequest,
  onSettlementReview,
}) {
  const resolved = ['Closed', 'Settled'].includes(account.status);
  return (
    <>
      <LoanDetails account={account} />
      <SettlementWorkflow account={account} user={user} busy={busy} onRequest={onSettlementRequest} onReview={onSettlementReview} />

      {resolved ? (
        <div className="resolved-notice">
          <strong>Account resolved</strong>
          <span>No further collection actions are available for this account.</span>
        </div>
      ) : (
        <>
          <CallForm call={call} setCall={setCall} busy={busy} onSubmit={onSubmit} />
          <PromiseForm promise={promise} setPromise={setPromise} busy={busy} onSubmit={onSubmit} />
          <PaymentForm account={account} payment={payment} setPayment={setPayment} busy={busy} onSubmit={onSubmit} />
        </>
      )}
    </>
  );
}

function Timeline({ items }) {
  if (items.length === 0) {
    return (
      <div className="drawer-empty">
        <Activity size={20} />
        <strong>No history yet</strong>
        <span>Activity for this account will show here.</span>
      </div>
    );
  }

  return (
    <div className="timeline">
      {items.map((item, index) => (
        <div
          className="timeline-item"
          key={`${item.kind}-${item.at}-${index}`}
        >
          <div className={`timeline-marker ${item.kind}`}>
            <span />
          </div>

          <div className="timeline-copy">
            <div>
              <strong>{item.title}</strong>
              <time>{dateTime(item.at)}</time>
            </div>

            {item.body && <p>{item.body}</p>}

            <span>By {item.by}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AccountTabContent({
  activeTab,
  account,
  call,
  setCall,
  promise,
  setPromise,
  payment,
  setPayment,
  busy,
  onSubmit,
  user,
  onSettlementRequest,
  onSettlementReview,
}) {
  if (activeTab === 'Overview') {
    return (
      <AccountOverview
        account={account}
        call={call}
        setCall={setCall}
        promise={promise}
        setPromise={setPromise}
        payment={payment}
        setPayment={setPayment}
        busy={busy}
        onSubmit={onSubmit}
        user={user}
        onSettlementRequest={onSettlementRequest}
        onSettlementReview={onSettlementReview}
      />
    );
  }

  if (activeTab === 'Activity') {
    return <Timeline items={getActivityItems(account)} />;
  }

  return <Timeline items={getPaymentItems(account.payments)} />;
}

export default function AccountDrawer({
  loanNo,
  user,
  onClose,
  notify,
  onChanged,
}) {
  const [account, setAccount] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [busy, setBusy] = useState(false);

  const [call, setCall] = useState(getInitialCall);
  const [promise, setPromise] = useState(getInitialPromise);
  const [payment, setPayment] = useState(getInitialPayment);

  const reload = useCallback(async () => {
    try {
      const data = await getAccount(loanNo);
      setAccount(data);
    } catch (error) {
      notify(error.message, 'error');
    }
  }, [loanNo, notify]);

  useEffect(() => {
    reload();
  }, [reload]);

  async function handleAction(action, body, successMessage) {
    if (busy) {
      return;
    }

    setBusy(true);

    try {
      await ACCOUNT_ACTIONS[action](loanNo, body);

      if (action === 'calls') setCall(getInitialCall());
      if (action === 'promises') setPromise(getInitialPromise());
      if (action === 'payments') setPayment(getInitialPayment());

      notify(successMessage);
      onChanged();

      await reload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSettlementRequest(offer, reset) {
    if (busy) return;
    setBusy(true);
    try {
      await createSettlementOffer(loanNo, offer);
      reset();
      notify(`${offer.type === 'Settlement' ? 'Settlement' : 'Closure'} request submitted for approval.`);
      onChanged();
      await reload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleSettlementReview(settlementId, decision) {
    if (busy) return;
    setBusy(true);
    try {
      await reviewSettlementOffer(loanNo, settlementId, decision);
      notify(decision === 'approve' ? 'Settlement request approved.' : 'Settlement request rejected.');
      onChanged();
      await reload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return <DrawerLoading onClose={onClose} />;
  }

  return (
    <div
      className="drawer-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside className="drawer">
        <DrawerHeader
          loanNo={account.loanNo}
          onClose={onClose}
        />

        <CustomerSummary account={account} />

        <BalanceSummary account={account} />

        <DrawerTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <div className="drawer-body">
          <AccountTabContent
            activeTab={activeTab}
            account={account}
            user={user}
            call={call}
            setCall={setCall}
            promise={promise}
            setPromise={setPromise}
            payment={payment}
            setPayment={setPayment}
            busy={busy}
            onSubmit={handleAction}
            onSettlementRequest={handleSettlementRequest}
            onSettlementReview={handleSettlementReview}
          />
        </div>
      </aside>
    </div>
  );
}
