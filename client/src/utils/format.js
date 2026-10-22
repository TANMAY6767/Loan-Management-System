
const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const ROLE_LABELS = {
  head: 'Head of Collections',
  coo: 'Chief Operating Officer',
  manager: 'Manager',
  caller: 'Caller',
  customer_service: 'Customer service',
};

export const statuses = [
  'All',
  'New',
  'Working',
  'PTP',
  'Part_paid',
  'Closed',
  'Settled',
];

export const cash = (value) =>
  currencyFormatter.format(Number(value || 0));

export const date = (value) =>
  value ? dateFormatter.format(new Date(value)) : '?';

export const dateTime = (value) =>
  value ? dateTimeFormatter.format(new Date(value)) : '?';

export const statusName = (status) =>
  status === 'Part_paid' ? 'Part Payment' : status;

export const displayRole = (role) =>
  ROLE_LABELS[role] || role;
