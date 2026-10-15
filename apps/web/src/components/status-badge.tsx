import type { AccountStatus, VerificationStatus } from '@sakan/shared';

const LABELS: Record<VerificationStatus | AccountStatus, string> = {
  UNSUBMITTED: 'Not submitted',
  PENDING: 'Under review',
  APPROVED: 'Verified',
  REJECTED: 'Rejected',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
};

export function StatusBadge({ status }: { status: VerificationStatus | AccountStatus }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{LABELS[status]}</span>;
}
