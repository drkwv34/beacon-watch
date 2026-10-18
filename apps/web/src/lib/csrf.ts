export function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const found = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return found ? decodeURIComponent(found.slice(prefix.length)) : undefined;
}

export function csrfHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {
    'x-csrf-token': readCookie('beacon_csrf') ?? '',
  };
  if (json) headers['content-type'] = 'application/json';
  return headers;
}
