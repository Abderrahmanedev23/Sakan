import type {
  AccountStatus,
  IdentityDocumentSide,
  UserRole,
  VerificationStatus,
} from './enums.js';

/** Metadata of a CIN scan. The file itself is only reachable by admins. */
export interface IdentityDocumentInfo {
  id: string;
  side: IdentityDocumentSide;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
}

/** The signed-in user's own account, as returned by GET /api/v1/me. */
export interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  role: UserRole;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  firstName: string | null;
  lastName: string | null;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  cinNumber: string | null;
  /** YYYY-MM-DD */
  cinExpiresAt: string | null;
  identitySubmittedAt: string | null;
  verifiedAt: string | null;
  /** Reason given by the admin when verificationStatus is REJECTED. */
  rejectionReason: string | null;
  /** Current CIN scans (front and back). */
  documents: IdentityDocumentInfo[];
  createdAt: string;
}

/** Returned by register and login. Send the token as `Authorization: Bearer <token>`. */
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: UserProfile;
}

export interface Paginated<T> {
  items: T[];
  /** Pass as `cursor` to fetch the next page; null on the last page. */
  nextCursor: string | null;
}

/** One row of the admin user list. */
export interface AdminUserSummary {
  id: string;
  email: string;
  role: UserRole;
  accountStatus: AccountStatus;
  verificationStatus: VerificationStatus;
  firstName: string | null;
  lastName: string | null;
  cinNumber: string | null;
  identitySubmittedAt: string | null;
  createdAt: string;
}

export interface VerificationReviewInfo {
  id: string;
  decision: VerificationStatus;
  reason: string | null;
  reviewerEmail: string;
  createdAt: string;
}

export interface AuditLogInfo {
  id: string;
  action: string;
  actorEmail: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

/** Everything an admin needs to review one user, from GET /api/v1/admin/users/:id. */
export interface AdminUserDetail {
  user: UserProfile;
  reviews: VerificationReviewInfo[];
  auditLogs: AuditLogInfo[];
}

/** Error body for 400 responses caused by invalid input. */
export interface ValidationErrorBody {
  statusCode: 400;
  message: string;
  errors: { path: string; message: string }[];
}
