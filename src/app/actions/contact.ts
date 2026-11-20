"use server";

import { contactMessageSchema } from "@/lib/validation";
import { sendContactFormEmail } from "@/lib/email";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
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

  const ip = await getClientIp();
  if (await isRateLimited(`contact:${ip}`, { max: 5, windowMinutes: 60 })) {
    return { error: "Too many messages — please wait a while and try again." };
  }

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

  if (await isRateLimited(`contact-email:${parsed.data.email}`, { max: 5, windowMinutes: 60 })) {
    return { error: "Too many messages — please wait a while and try again." };
  }

  try {
    await sendContactFormEmail(parsed.data);
  } catch {
    return { error: "Something went wrong sending your message — please try again in a moment." };
  }

  return {};
}
