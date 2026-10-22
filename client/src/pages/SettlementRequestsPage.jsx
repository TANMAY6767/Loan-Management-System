import { useMemo, useState } from 'react';
import { Check, Clock3, Search, X } from 'lucide-react';
import { reviewSettlementOffer } from '../services/accountService.js';

const cash = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(value || 0));

const dateTime = (value) => new Date(value).toLocaleString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default function SettlementRequestsPage({ requests, loading, notify, onChanged, onOpenAccount, user }) {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState('');
  const filteredRequests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return requests;
    return requests.filter((item) => [
      item.account.loanNo, item.account.customerName, item.requestedBy.name,
      item.requestedBy.office?.name, item.account.office?.name,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [requests, query]);

  async function decide(item, decision) {
    setBusyId(item.id);
    try {
      await reviewSettlementOffer(item.accountId, item.id, decision);
      notify(`${item.type === 'Settlement' ? 'Settlement' : 'Closure'} request ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      onChanged();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="settlement-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">REVIEW WORKFLOW</div>
          <h1>Closure and settlement requests</h1>
          <p>{user.role === 'manager' ? 'Review caller requests for your branch before Head of Collections.' : 'Final approval queue for manager reviewed requests.'}</p>
        </div>
        <div className="settlement-open-count"><Clock3 size={16} /> {requests.length} awaiting review</div>
      </div>

      <div className="panel settlement-queue-panel">
        <div className="settlement-queue-toolbar">
          <div><strong>Pending review</strong><span>Requests are ordered from oldest to newest.</span></div>
          <label className="settlement-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search account, customer or caller" /></label>
        </div>

        {loading ? <div className="settlement-empty">Loading settlement requests…</div> : filteredRequests.length ? (
          <div className="settlement-requests-list">
            {filteredRequests.map((item) => (
              <article className="settlement-request-card" key={item.id}>
                <div className="settlement-request-main">
                  <button className="settlement-account-link" onClick={() => onOpenAccount(item.account.loanNo)}>
                    <strong>{item.account.customerName}</strong><span>{item.account.loanNo}</span>
                  </button>
                  <div className="settlement-request-facts">
                    <div><small>{item.type === 'Settlement' ? 'Proposed settlement' : 'Proposed closure'}</small><strong>{cash(item.amount)}</strong></div>
                    <div><small>Outstanding</small><strong>{cash(item.account.outstanding)}</strong></div>
                    <div><small>Requested by</small><strong>{item.requestedBy.name}</strong><span>{item.requestedBy.office?.name || 'Office not set'}</span></div>
                    <div><small>Assigned caller</small><strong>{item.account.assignedTo?.name || 'Unassigned'}</strong><span>{item.account.assignedTo?.office?.name || item.account.office?.name}</span></div>
                  </div>
                  <div className="settlement-request-time">Requested {dateTime(item.createdAt)} · awaiting {item.stage === 'Manager' ? 'manager review' : 'Head of Collections'} · account office {item.account.office?.name}</div>
                </div>
                <div className="settlement-request-actions">
                  {item.requestedById === user.id ? <span className="settlement-self-review">Another reviewer must decide</span> : <>
                    <button className="secondary-button" disabled={busyId === item.id} onClick={() => decide(item, 'reject')}><X size={15} /> Reject</button>
                    <button className="primary-button" disabled={busyId === item.id} onClick={() => decide(item, 'approve')}><Check size={15} /> Approve</button>
                  </>}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="settlement-empty"><strong>{query ? 'No matching requests' : 'You’re all caught up'}</strong><span>{query ? 'Try another account, customer or caller name.' : 'New caller settlement requests will appear here.'}</span></div>
        )}
      </div>
    </div>
  );
}
