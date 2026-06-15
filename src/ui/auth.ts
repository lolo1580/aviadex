export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch("/api/v1/auth/me", {
    credentials: "include",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Unable to load current session.");
  }

  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const response = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string | { message?: string } }
      | null;
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : payload?.error?.message;
    throw new Error(message ?? "Login failed.");
  }

  const payload = (await response.json()) as { user: AuthUser };
  return payload.user;
}

export async function logout() {
  await fetch("/api/v1/auth/logout", {
    method: "POST",
    credentials: "include",
  });
}
