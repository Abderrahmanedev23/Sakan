import type { IdentityDocumentInfo, UserProfile } from '@sakan/shared';
import type { Prisma } from '../generated/prisma/client.js';

/** Prisma include that loads everything toUserProfile needs. */
export const userProfileInclude = {
  identityDocuments: { where: { supersededAt: null }, orderBy: { side: 'asc' } },
  reviewsReceived: { orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserInclude;

type UserWithProfile = Prisma.UserGetPayload<{ include: typeof userProfileInclude }>;

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toDocumentInfo(doc: UserWithProfile['identityDocuments'][number]): IdentityDocumentInfo {
  return {
    id: doc.id,
    side: doc.side,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.uploadedAt.toISOString(),
  };
}

/** The account as its owner (and admins) see it. Never includes the password hash or storage keys. */
export function toUserProfile(user: UserWithProfile): UserProfile {
  const lastReview = user.reviewsReceived[0];
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountStatus: user.accountStatus,
    verificationStatus: user.verificationStatus,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: isoDate(user.dateOfBirth),
    cinNumber: user.cinNumber,
    cinExpiresAt: isoDate(user.cinExpiresAt),
    identitySubmittedAt: user.identitySubmittedAt?.toISOString() ?? null,
    verifiedAt: user.verifiedAt?.toISOString() ?? null,
    rejectionReason:
      user.verificationStatus === 'REJECTED' && lastReview?.decision === 'REJECTED' ? lastReview.reason : null,
    documents: user.identityDocuments.map(toDocumentInfo),
    createdAt: user.createdAt.toISOString(),
  };
}
