// A light "does this look like an email" check for forms that don't use the
// Zod schemas (2026-11-28). The portal sign-in once had this regex written
// without its backslashes -- [^s@] instead of [^\s@] -- which rejected every
// address containing the letter "s". Kept here, with tests, so it can't
// quietly break again.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPlausibleEmail(value: string): boolean {
  return EMAIL_SHAPE.test(value);
}
