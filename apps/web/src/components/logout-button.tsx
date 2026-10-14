'use client';

function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

export function LogoutButton() {
  async function onClick() {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      headers: { 'x-csrf-token': readCookie('beacon_csrf') ?? '' },
    });
    window.location.assign('/login');
  }

  return (
    <button className="button button--ghost" type="button" onClick={() => void onClick()}>
      Sign out
    </button>
  );
}
