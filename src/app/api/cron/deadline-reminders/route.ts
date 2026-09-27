import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deadlineInclude, sendRemindersFor } from "@/lib/deadline-reminder-send";
import {
  EARLY_REMINDER_DAYS,
  daysUntilDue,
  describeDaysUntil,
  reminderStageFor,
  todayInReminderZone,
} from "@/lib/deadline-reminder-schedule";

// The daily automatic deadline reminder pass, run by Vercel Cron (vercel.json)
// once a morning. Founder decision 2026-09-27, replacing manual-only sends:
// a client hears about a deadline 3 days out and again the day before, and
// the agent is copied on both. The "Send reminder" button still works on top.
//
// Side benefit, and part of why it runs daily rather than only when there's
// something due: this query touches the database every day, which keeps the
// free Supabase project from pausing after a week of quiet (it did, Sept
// 2026, and took sign-in down with it).
//
// Vercel sends `Authorization: Bearer $CRON_SECRET` when that env var is set.
// Without it configured this refuses to run at all, rather than leaving an
// open endpoint anyone could hit to spray reminder emails.

// Deals where a deadline still matters. A closed or dead deal's leftover
// unchecked deadlines shouldn't email anyone.
const LIVE_STATUSES = ["ACTIVE", "UNDER_CONTRACT", "PENDING"] as const;

// Resend's free tier allows a couple of requests a second; space sends out
// rather than tripping it on a busy morning.
const SEND_SPACING_MS = 600;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const today = todayInReminderZone(new Date());
  const windowEnd = new Date(today.getTime() + (EARLY_REMINDER_DAYS + 1) * 24 * 60 * 60 * 1000);

  const deadlines = await prisma.dealDeadline.findMany({
    where: {
      completedAt: null,
      autoReminderFinalSentAt: null,
      dueDate: { gte: today, lt: windowEnd },
      deal: { status: { in: [...LIVE_STATUSES] } },
    },
    include: deadlineInclude,
  });

  let sent = 0;
  let failed = 0;

  for (const deadline of deadlines) {
    const daysUntil = daysUntilDue(deadline.dueDate, today);
    const stage = reminderStageFor({
      daysUntil,
      earlySentAt: deadline.autoReminderEarlySentAt,
      finalSentAt: deadline.autoReminderFinalSentAt,
    });
    if (!stage) continue;

    const field = stage === "early" ? "autoReminderEarlySentAt" : "autoReminderFinalSentAt";

    // Claim before sending: the stamp only lands if it's still null, so two
    // overlapping runs (a Vercel retry, say) can't both email the same stage.
    const claimed = await prisma.dealDeadline.updateMany({
      where: { id: deadline.id, [field]: null },
      data: { [field]: new Date() },
    });
    if (claimed.count !== 1) continue;

    const result = await sendRemindersFor(deadline, { when: describeDaysUntil(daysUntil) });
    if (result.sent) {
      sent++;
    } else {
      failed++;
      // Release the claim so tomorrow's run tries again, instead of the
      // reminder being silently lost to one bad send.
      await prisma.dealDeadline.updateMany({
        where: { id: deadline.id },
        data: { [field]: null },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, SEND_SPACING_MS));
  }

  return NextResponse.json({ checked: deadlines.length, sent, failed });
}
