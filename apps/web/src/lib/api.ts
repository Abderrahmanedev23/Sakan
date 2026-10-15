import type {
  AdminEntry,
  AdminPayment,
  AdminSession,
  AdminStats,
  AdminUserDetail,
  AdminUserSummary,
  AuditLogEntry,
  AuthResponse,
  CheckoutResponse,
  CreateSessionInput,
  DrawEntriesList,
  LoginInput,
  MyParticipations,
  Paginated,
  PaymentInfo,
  PaymentStatus,
  PublicSession,
  RegisterInput,
  SessionStatus,
  UpdateSessionInput,
  UserProfile,
  VerificationStatus,
} from '@sakan/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/** An error response from the API, with per-field messages for invalid input. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, headers, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: 'no-store',
      ...rest,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(typeof rest.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(0, 'The server is not reachable. Try again in a moment.');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      errors?: { path: string; message: string }[];
    };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    const fieldErrors = Object.fromEntries((body.errors ?? []).map((e) => [e.path, e.message]));
    throw new ApiError(res.status, message ?? `Request failed (${res.status})`, fieldErrors);
  }
  if (res.status === 204) return undefined as T;
  if (res.headers.get('content-type')?.includes('application/json')) return res.json() as Promise<T>;
  return res.blob() as Promise<T>;
}

const post = <T>(path: string, body: unknown, token?: string | null, headers?: Record<string, string>) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), token, headers });

/** Builds a query string, leaving out empty values. */
function qs(query: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
  const text = params.toString();
  return text ? `?${text}` : '';
}

export const api = {
  listSessions: (status: 'active' | 'completed' | 'all' = 'all') => request<PublicSession[]>(`/sessions${qs({ status })}`),
  session: (id: string) => request<PublicSession>(`/sessions/${id}`),
  drawEntries: (id: string) => request<DrawEntriesList>(`/sessions/${id}/draw/entries`),

  /** idempotencyKey: one random value per "buy" tap, reused if the request is retried. */
  checkout: (token: string, sessionId: string, idempotencyKey: string) =>
    post<CheckoutResponse>(`/sessions/${sessionId}/checkout`, {}, token, { 'Idempotency-Key': idempotencyKey }),
  payment: (token: string, reference: string) => request<PaymentInfo>(`/payments/${reference}`, { token }),
  completeStubPayment: (token: string, reference: string, succeeded: boolean) =>
    post<PaymentInfo>(`/payments/${reference}/stub-complete`, { succeeded }, token),
  participations: (token: string) => request<MyParticipations>('/me/participations', { token }),

  register: (input: RegisterInput) => post<AuthResponse>('/auth/register', input),
  login: (input: LoginInput) => post<AuthResponse>('/auth/login', input),
  logout: (token: string) => post<void>('/auth/logout', {}, token),
  me: (token: string) => request<UserProfile>('/me', { token }),
  /** form holds the CIN fields plus `front` and `back` image files. */
  submitIdentity: (token: string, form: FormData) =>
    request<UserProfile>('/me/identity', { method: 'PUT', body: form, token }),

  admin: {
    listUsers: (
      token: string,
      query: { verificationStatus?: VerificationStatus; q?: string; cursor?: string } = {},
    ) => {
      const params = new URLSearchParams(
        Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])),
      );
      return request<Paginated<AdminUserSummary>>(`/admin/users?${params}`, { token });
    },
    user: (token: string, id: string) => request<AdminUserDetail>(`/admin/users/${id}`, { token }),
    approve: (token: string, id: string) => post<AdminUserDetail>(`/admin/users/${id}/verification/approve`, {}, token),
    reject: (token: string, id: string, reason: string) =>
      post<AdminUserDetail>(`/admin/users/${id}/verification/reject`, { reason }, token),
    suspend: (token: string, id: string, reason: string) =>
      post<AdminUserDetail>(`/admin/users/${id}/suspend`, { reason }, token),
    reactivate: (token: string, id: string) => post<AdminUserDetail>(`/admin/users/${id}/reactivate`, {}, token),
    /** CIN images need the bearer token, so they are fetched as blobs rather than linked. */
    document: (token: string, documentId: string) =>
      request<Blob>(`/admin/identity-documents/${documentId}/file`, { token }),

    stats: (token: string) => request<AdminStats>('/admin/stats', { token }),
    sessions: (token: string, status?: SessionStatus) => request<AdminSession[]>(`/admin/sessions${qs({ status })}`, { token }),
    session: (token: string, id: string) => request<AdminSession>(`/admin/sessions/${id}`, { token }),
    createSession: (token: string, input: CreateSessionInput) => post<AdminSession>('/admin/sessions', input, token),
    updateSession: (token: string, id: string, input: UpdateSessionInput) =>
      request<AdminSession>(`/admin/sessions/${id}`, { method: 'PATCH', body: JSON.stringify(input), token }),
    sessionAction: (token: string, id: string, action: 'open' | 'pause' | 'resume' | 'close' | 'draw/retry') =>
      post<AdminSession>(`/admin/sessions/${id}/${action}`, {}, token),
    cancelSession: (token: string, id: string, reason: string) =>
      post<AdminSession>(`/admin/sessions/${id}/cancel`, { reason }, token),
    sessionEntries: (token: string, id: string, query: { q?: string; cursor?: string } = {}) =>
      request<Paginated<AdminEntry>>(`/admin/sessions/${id}/entries${qs(query)}`, { token }),
    payments: (token: string, query: { status?: PaymentStatus; sessionId?: string; q?: string; cursor?: string } = {}) =>
      request<Paginated<AdminPayment>>(`/admin/payments${qs(query)}`, { token }),
    refundPayment: (token: string, id: string, reason: string) =>
      post<AdminPayment>(`/admin/payments/${id}/refund`, { reason }, token),
    auditLogs: (token: string, query: { entityType?: string; entityId?: string; action?: string; cursor?: string } = {}) =>
      request<Paginated<AuditLogEntry>>(`/admin/audit-logs${qs(query)}`, { token }),
  },
};
