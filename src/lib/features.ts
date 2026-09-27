// Switches for whole features that are built but deliberately not offered.

// Sending forms out for e-signature (template designer, "Send a form to
// sign"). Turned off 2026-09-27 by founder decision -- "perfect what we have
// now" before offering it. Nothing is deleted: flip this back to true and the
// Forms section and send widgets return. While off:
// - /forms/* redirects to /transactions and Forms is gone from the nav.
// - No new envelope can be started from a client or transaction page.
// - Envelopes already out keep working (/sign/[id] is untouched), and their
//   history still shows on the client and transaction they belong to.
export const E_SIGNATURE_ENABLED = false;
