"use server";

import { contactMessageSchema } from "@/lib/validation";
import { sendContactFormEmail } from "@/lib/email";
import type { FormState } from "@/app/actions/auth";

// Public, unauthenticated -- the Support page's contact form.
export async function submitContactFormAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // Honeypot: a visually-hidden field real visitors never fill in. A bot
  // that fills every field in the form trips this — fail silently (no
  // signal back to the bot that it was caught) rather than erroring.
  if (formData.get("company")) return {};

  const parsed = contactMessageSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] = issue.message;
    }
    return { fieldErrors };
  }

  try {
    await sendContactFormEmail(parsed.data);
  } catch {
    return { error: "Something went wrong sending your message — please try again in a moment." };
  }

  return {};
}
