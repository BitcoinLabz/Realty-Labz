// The site's own public address, for links in emails that aren't a reply to
// a signed-in agent's request (the daily reminder job, portal sign-in).
//
// Deliberately NOT derived from the request's Host header on those paths:
// portal sign-in is public, and a forged Host would email a real client a
// genuine sign-in token inside a link to someone else's site.
export const APP_URL =
  process.env.PUBLIC_APP_URL ??
  (process.env.NODE_ENV === "production" ? "https://www.realtylabz.com" : "http://localhost:3000");
