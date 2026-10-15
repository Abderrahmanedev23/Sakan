import type {
  AdminUserDetail,
  AdminUserSummary,
  AuthResponse,
  LoginInput,
  Paginated,
  PublicSession,
  RegisterInput,
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

const post = <T>(path: string, body: unknown, token?: string | null) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}), token });

export const api = {
  listSessions: () => request<PublicSession[]>('/sessions'),

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
  },
};
