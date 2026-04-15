let _password: string | null = null;

export function setPendingPassword(password: string): void {
  _password = password;
}

export function getPendingPassword(): string | null {
  return _password;
}

export function clearPendingPassword(): void {
  _password = null;
}
