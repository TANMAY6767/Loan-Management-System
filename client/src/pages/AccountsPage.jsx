
import { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Search,
  Users,
  X,
} from 'lucide-react';

import { cash, date, statusName, statuses } from '../utils/format.js';
import { allocateAccounts } from '../services/accountService.js';

const PAGE_SIZE = 25;

const ACCOUNT_TITLES = {
  Queue: {
    title: 'My work queue',
    description: 'Your assigned accounts, with follow-ups ready to work.',
  },
  Allocation: {
    title: 'Allocate accounts',
    description: 'Select accounts to assign or reassign to a caller on your team.',
  },
  Accounts: {
    title: 'Accounts',
    description: 'Search, review and work through your recovery portfolio.',
  },
};

const OFFICE_OPTIONS = [
  'Jogeshwari',
  'Dadar',
  'Bangalore',
];

function PageHeading({ view, canManage, onAllocate }) {
  const { title, description } = ACCOUNT_TITLES[view] || ACCOUNT_TITLES.Accounts;

  return (
    <div className="page-heading list-heading">
      <div>
        <div className="eyebrow">RECOVERY DESK</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {canManage && view === 'Accounts' && (
        <button className="secondary-button" onClick={onAllocate}>
          <Users size={16} />
          Allocate accounts
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function AccountSearch({ query, setQuery }) {
  return (
    <div className="searchbox">
      <Search size={17} />

      <input
        placeholder="Search name, phone or loan number"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {query && (
        <button
          className="clear-search"
          onClick={() => setQuery('')}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

function StatusFilter({ status, setStatus }) {
  return (
    <label className="select-wrap">
      <Filter size={15} />

      <select
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        {statuses.map((item) => (
          <option key={item} value={item}>
            {item === 'All' ? 'All statuses' : statusName(item)}
          </option>
        ))}
      </select>

      <ChevronDown size={14} />
    </label>
  );
}

function OfficeFilter({ office, setOffice }) {
  return (
    <label className="select-wrap">
      <select
        value={office}
        onChange={(event) => setOffice(event.target.value)}
      >
        <option>All offices</option>

        {OFFICE_OPTIONS.map((officeName) => (
          <option key={officeName} value={officeName}>
            {officeName}
          </option>
        ))}
      </select>

      <ChevronDown size={14} />
    </label>
  );
}

function AccountToolbar({
  query,
  setQuery,
  status,
  setStatus,
  office,
  setOffice,
  user,
}) {
  const canFilterOffice = ['head', 'coo', 'manager'].includes(user.role);

  return (
    <div className="table-toolbar">
      <AccountSearch query={query} setQuery={setQuery} />

      <div className="toolbar-filters">
        <StatusFilter status={status} setStatus={setStatus} />

        {canFilterOffice && (
          <OfficeFilter office={office} setOffice={setOffice} />
        )}

      </div>
    </div>
  );
}

function SelectionNotice({ selectedCount }) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="selection-note">
      <Check size={15} />
      {selectedCount} account{selectedCount !== 1 ? 's' : ''} selected.
      Selection is kept while you move between pages.
    </div>
  );
}

function SelectAllCheckbox({ accounts, selected, setSelected }) {
  const allSelected =
    accounts.length > 0 &&
    accounts.every((account) => selected.includes(account.loanNo));

  function handleChange(event) {
    const checked = event.target.checked;
    const pageLoanNumbers = new Set(
      accounts.map((account) => account.loanNo)
    );

    setSelected((current) => {
      if (checked) {
        return [...new Set([...current, ...pageLoanNumbers])];
      }

      return current.filter((loanNo) => !pageLoanNumbers.has(loanNo));
    });
  }

  return (
    <input
      type="checkbox"
      checked={allSelected}
      onChange={handleChange}
    />
  );
}

function CustomerCell({ account }) {
  const initials = account.customerName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  const avatarColor = (account.customerName.charCodeAt(0) || 0) % 5;

  return (
    <div className="customer-cell">
      <div className={`small-avatar avatar-${avatarColor}`}>
        {initials}
      </div>

      <div>
        <strong>{account.customerName}</strong>
        <span>{account.mobile}</span>
      </div>
    </div>
  );
}

function AccountStatus({ status }) {
  return (
    <span className={`status-pill status-${status.toLowerCase()}`}>
      {statusName(status)}
    </span>
  );
}

function AccountOwner({ assignedTo }) {
  return (
    <span className="owner-cell">
      {assignedTo?.name || (
        <span className="unassigned">Unassigned</span>
      )}
    </span>
  );
}

function AccountFollowUp({ promises }) {
  const nextPromise = promises?.[0];

  if (!nextPromise) {
    return <span className="muted-dash">—</span>;
  }

  return (
    <span className="followup-date">
      <Clock3 size={13} />
      {date(nextPromise.dueDate)}
    </span>
  );
}

function AccountRow({
  account,
  canManage,
  selected,
  onToggle,
  onOpen,
}) {
  function handleRowClick() {
    onOpen(account.loanNo);
  }

  function handleCheckboxClick(event) {
    event.stopPropagation();
  }

  return (
    <tr onClick={handleRowClick} className="account-row">
      {canManage && (
        <td onClick={handleCheckboxClick}>
          <input
            type="checkbox"
            checked={selected.includes(account.loanNo)}
            onChange={() => onToggle(account.loanNo)}
          />
        </td>
      )}

      <td>
        <CustomerCell account={account} />
      </td>

      <td>
        <span className="loan-id">{account.loanNo}</span>
      </td>

      <td>
        <span className="office-name">{account.office.name}</span>
      </td>

      <td>
        <strong className="amount-cell">
          {cash(account.outstanding)}
        </strong>
      </td>

      <td>
        <AccountStatus status={account.status} />
      </td>

      <td>
        <AccountOwner assignedTo={account.assignedTo} />
      </td>

      <td>
        <AccountFollowUp promises={account.promises} />
      </td>

      <td>
        <button
          className="row-open"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(account.loanNo);
          }}
        >
          <ChevronRight size={17} />
        </button>
      </td>
    </tr>
  );
}

function AccountTableBody({
  accounts,
  loading,
  canManage,
  selected,
  onToggle,
  onOpen,
}) {
  const columnCount = canManage ? 9 : 8;

  if (loading) {
    return (
      <tbody>
        <tr>
          <td colSpan={columnCount} className="table-message">
            Loading accounts…
          </td>
        </tr>
      </tbody>
    );
  }

  if (accounts.length === 0) {
    return (
      <tbody>
        <tr>
          <td colSpan={columnCount} className="table-message">
            <div className="empty-icon">
              <Search size={20} />
            </div>

            <strong>No accounts found</strong>
            <span>Try changing your search or filters.</span>
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody>
      {accounts.map((account) => (
        <AccountRow
          key={account.loanNo}
          account={account}
          canManage={canManage}
          selected={selected}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      ))}
    </tbody>
  );
}

function AccountTable({
  accounts,
  loading,
  canManage,
  selected,
  setSelected,
  onToggle,
  onOpen,
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {canManage && (
              <th className="check-col">
                <SelectAllCheckbox
                  accounts={accounts}
                  selected={selected}
                  setSelected={setSelected}
                />
              </th>
            )}

            <th>Customer</th>
            <th>Loan number</th>
            <th>Office</th>
            <th>Outstanding</th>
            <th>Status</th>
            <th>Owner</th>
            <th>Follow-up</th>
            <th></th>
          </tr>
        </thead>

        <AccountTableBody
          accounts={accounts}
          loading={loading}
          canManage={canManage}
          selected={selected}
          onToggle={onToggle}
          onOpen={onOpen}
        />
      </table>
    </div>
  );
}

function PaginationFooter({
  total,
  page,
  setPage,
  maxPage,
}) {
  const firstItem = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="table-footer">
      <span>
        Showing <strong>{firstItem}–{lastItem}</strong> of{' '}
        <strong>{total.toLocaleString('en-IN')}</strong> accounts
      </span>

      <div className="pagination">
        <button
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>

        <span>
          Page {page} of {maxPage}
        </span>

        <button
          disabled={page >= maxPage}
          onClick={() => setPage(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function AllocationTip() {
  return (
    <div className="allocation-tip">
      <div className="tip-mark">
        <Users size={17} />
      </div>

      <span>
        <strong>Allocation history is kept automatically.</strong>{' '}
        Reassigning an account updates its owner while retaining the
        previous assignment in the account timeline.
      </span>
    </div>
  );
}

export default function AccountsPage({
  view,
  user,
  accounts,
  loading,
  query,
  setQuery,
  status,
  setStatus,
  office,
  setOffice,
  page,
  setPage,
  selected,
  setSelected,
  onOpen,
  onAllocate,
  canManage,
}) {
  const { rows, total } = accounts;
  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSelection(loanNo) {
    setSelected((current) =>
      current.includes(loanNo)
        ? current.filter((item) => item !== loanNo)
        : [...current, loanNo]
    );
  }

  return (
    <>
      <PageHeading
        view={view}
        canManage={canManage}
        onAllocate={onAllocate}
      />

      <section className="panel account-panel">
        <AccountToolbar
          query={query}
          setQuery={setQuery}
          status={status}
          setStatus={setStatus}
          office={office}
          setOffice={setOffice}
          user={user}
        />

        {view === 'Allocation' && (
          <SelectionNotice selectedCount={selected.length} />
        )}

        <AccountTable
          accounts={rows}
          loading={loading}
          canManage={canManage}
          selected={selected}
          setSelected={setSelected}
          onToggle={toggleSelection}
          onOpen={onOpen}
        />

        <PaginationFooter
          total={total}
          page={page}
          setPage={setPage}
          maxPage={maxPage}
        />
      </section>

      {view === 'Allocation' && <AllocationTip />}
    </>
  );
}

export function AllocationBar({
  selected,
  team,
  callerId,
  setCallerId,
  notify,
  onDone,
}) {
  const [busy, setBusy] = useState(false);

  const callers = team.filter((member) => member.role === 'caller');

  async function handleAllocate() {
    if (!selected.length || !callerId || busy) {
      return;
    }

    setBusy(true);

    try {
      const result = await allocateAccounts(selected, callerId);

      notify(
        `${result.allocated} account${result.allocated === 1 ? '' : 's'} assigned to ${result.caller}.`
      );

      onDone();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="allocation-bar">
      <div className="allocation-selected">
        <span className="selected-count">{selected.length}</span>

        <span>
          <strong>{selected.length} selected</strong>
          <small>accounts to assign</small>
        </span>
      </div>

      <div className="allocation-controls">
        <label className="select-wrap caller-select">
          <Users size={15} />

          <select
            value={callerId}
            onChange={(event) => setCallerId(event.target.value)}
          >
            <option value="">Choose a caller</option>

            {callers.map((caller) => (
              <option key={caller.id} value={caller.id}>
                {caller.name} · {caller.office.name} · {caller._count?.accounts || 0} assigned
              </option>
            ))}
          </select>

          <ChevronDown size={14} />
        </label>

        <button
          className="primary-button"
          disabled={!selected.length || !callerId || busy}
          onClick={handleAllocate}
        >
          {busy ? 'Assigning…' : 'Assign accounts'}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
