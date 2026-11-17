export function interpretMeStatus(status: number): 'authenticated' | 'unauthenticated' | 'unavailable' {
  if (status === 200) return 'authenticated';
  if (status === 401) return 'unauthenticated';
  return 'unavailable';
}
