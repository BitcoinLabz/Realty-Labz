// Plain, dependency-free label maps for Client.source/stage -- deliberately
// NOT defined inside client-form.tsx (a "use client" file). Importing a
// plain object constant from a "use client" module into a Server Component
// (forms/[id]/page.tsx) silently breaks bracket-notation property access at
// render time (evaluates to undefined despite the object looking correct in
// source) -- the same underlying class of bug this project already hit once
// with CATEGORY_LABELS, just in the opposite import direction. Confirmed
// live: CLIENT_STAGE_LABELS[client.stage] rendered as an empty badge and
// CLIENT_SOURCE_LABELS[client.source] rendered the literal string
// "undefined" in a template literal, both while client-form.tsx's own
// Object.entries(...) over the exact same map worked fine client-side.
export const CLIENT_SOURCE_LABELS: Record<string, string> = {
  REFERRAL: "Referral",
  ZILLOW: "Zillow",
  OPEN_HOUSE: "Open house",
  SPHERE: "Sphere of influence",
  WEBSITE: "Website",
  SOCIAL_MEDIA: "Social media",
  OTHER: "Other",
};

export const CLIENT_STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  NURTURING: "Nurturing",
  ACTIVE: "Active",
  CLOSED: "Closed",
  LOST: "Lost",
};
