
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
  getAccount,
  logCall,
  recordPayment,
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
    settled: false,
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

  return [...callItems, ...promiseItems, ...allocationItems].sort(
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
  const remainingBalance = Math.max(
    0,
    Number(account.outstanding) - totalPaid
  );

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
        <strong>{cash(remainingBalance)}</strong>
      </div>
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
              min="1"
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

function PaymentForm({ payment, setPayment, busy, onSubmit }) {
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
              min="1"
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

        <label className="check-label">
          <input
            type="checkbox"
            checked={payment.settled}
            onChange={(event) =>
              updatePayment('settled', event.target.checked)
            }
          />

          Mark as settled when fully paid
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
}) {
  return (
    <>
      <LoanDetails account={account} />

      <CallForm
        call={call}
        setCall={setCall}
        busy={busy}
        onSubmit={onSubmit}
      />

      <PromiseForm
        promise={promise}
        setPromise={setPromise}
        busy={busy}
        onSubmit={onSubmit}
      />

      <PaymentForm
        payment={payment}
        setPayment={setPayment}
        busy={busy}
        onSubmit={onSubmit}
      />
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

      notify(successMessage);
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
            call={call}
            setCall={setCall}
            promise={promise}
            setPromise={setPromise}
            payment={payment}
            setPayment={setPayment}
            busy={busy}
            onSubmit={handleAction}
          />
        </div>
      </aside>
    </div>
  );
}
