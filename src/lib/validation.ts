import { z } from "zod";

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    email: z.email("Enter a valid email address").trim().toLowerCase(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    accountType: z.enum(["solo", "team"]),
    teamName: z.string().trim().max(100).optional(),
  })
  .refine((data) => data.accountType !== "team" || (data.teamName && data.teamName.length > 0), {
    message: "Team name is required",
    path: ["teamName"],
  });

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// HOME_OFFICE is deliberately excluded here — like MILEAGE, it's no longer
// manually selectable since it became a computed deduction (2026-07-24, see
// getHomeOfficeDeduction in src/lib/finance-data.ts). Historical rows that
// already used HOME_OFFICE keep the Prisma enum value; nothing is migrated.
export const SELECTABLE_TRANSACTION_CATEGORIES = [
  "PHONE",
  "MARKETING_ADVERTISING",
  "MLS_DUES",
  "CONTINUING_EDUCATION",
  "CLIENT_GIFTS",
  "OFFICE_SUPPLIES",
  "SOFTWARE_SUBSCRIPTIONS",
  "INSURANCE",
  "LICENSING_FEES",
  "MEALS_ENTERTAINMENT",
  "PROFESSIONAL_SERVICES",
  "OTHER",
] as const;

export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    scope: z.enum(["BUSINESS", "PERSONAL"]).default("BUSINESS"),
    category: z.enum(SELECTABLE_TRANSACTION_CATEGORIES).optional(),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    description: z.string().trim().max(200).optional(),
    date: z.string().min(1, "Date is required"),
    dealId: z.string().optional(),
  })
  .refine((data) => data.scope !== "BUSINESS" || data.type !== "EXPENSE" || !!data.category, {
    message: "Category is required for business expenses",
    path: ["category"],
  });

export const mileageLogSchema = z.object({
  date: z.string().min(1, "Date is required"),
  miles: z.coerce.number().positive("Miles must be greater than 0"),
  isBusiness: z.enum(["true", "false"]).transform((v) => v === "true"),
  note: z.string().trim().max(200).optional(),
});

export const CLIENT_SOURCES = [
  "REFERRAL",
  "ZILLOW",
  "OPEN_HOUSE",
  "SPHERE",
  "WEBSITE",
  "SOCIAL_MEDIA",
  "OTHER",
] as const;

export const CLIENT_STAGES = ["NEW", "CONTACTED", "NURTURING", "ACTIVE", "CLOSED", "LOST"] as const;

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address").optional(),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
  source: z.enum(CLIENT_SOURCES).optional(),
  stage: z.enum(CLIENT_STAGES).default("NEW"),
});

// emailDeadlineReminders is a plain checkbox, not part of clientSchema --
// read directly from FormData ("true"/absent), same convention as every
// other boolean form field in this app (e.g. keepForRecords in
// form-submissions.ts). A missing checkbox key means unchecked, so it can't
// round-trip through z.coerce.boolean() the way a real boolean value could.

export const createInviteSchema = z.object({
  role: z.enum(["AGENT", "TEAM_LEAD"]),
});

export const joinTeamSchema = z.object({
  inviteId: z.string().min(1, "Missing invite"),
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const dealSchema = z.object({
  side: z.enum(["BUYER", "SELLER", "DUAL", "TENANT", "LANDLORD"]),
  status: z.enum(["ACTIVE", "UNDER_CONTRACT", "PENDING", "CLOSED", "FELL_THROUGH"]),
  // Optional (2026-08-20): a file/deal can exist before a property is found
  // yet -- see the Create a file wizard.
  propertyAddress: z.string().trim().max(300).optional(),
  mlsNumber: z.string().trim().max(50).optional(),
  listPrice: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  salePrice: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  commissionRate: z.coerce.number().min(0).max(100, "Enter a percent, e.g. 3").optional(),
  commissionAmount: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  brokerageSplitPercent: z.coerce.number().min(0).max(100, "Enter a percent, e.g. 30").optional(),
  referralFeeAmount: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  teamSplitAmount: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  otherDeductions: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  closingDate: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  clientId: z.string().optional(),
  referralPartnerId: z.string().optional(),
});

// The guided "Create a file" wizard (/transactions/new) -- a lighter-weight
// variant of dealSchema that also resolves the client (pick an existing one,
// or create a new one inline) in the same submit, rather than requiring a
// separate trip to a client's page first.
export const createFileSchema = z
  .object({
    side: z.enum(["BUYER", "SELLER", "DUAL", "TENANT", "LANDLORD"]),
    propertyAddress: z.string().trim().max(300).optional(),
    mlsNumber: z.string().trim().max(50).optional(),
    clientMode: z.enum(["existing", "new"]),
    clientId: z.string().optional(),
    newClientName: z.string().trim().max(100).optional(),
    newClientEmail: z.email("Enter a valid email address").optional(),
    newClientPhone: z.string().trim().max(30).optional(),
  })
  .refine((data) => data.clientMode !== "existing" || !!data.clientId, {
    message: "Choose a client",
    path: ["clientId"],
  })
  .refine((data) => data.clientMode !== "new" || !!data.newClientName, {
    message: "Enter the new client's name",
    path: ["newClientName"],
  });

export const dealDeadlineSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  dueDate: z.string().min(1, "Due date is required"),
});

export const referralPartnerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address").optional(),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const openHouseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  notes: z.string().trim().max(500).optional(),
});

// Public, unauthenticated -- filled out by a visitor on /open-house/[id].
export const openHouseVisitorSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address").optional(),
  phone: z.string().trim().max(30).optional(),
  interested: z.enum(["true", "false"]).optional(),
  feedback: z.string().trim().max(1000).optional(),
});

export const loanSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  type: z.enum(["MORTGAGE", "AUTO", "OTHER"]),
  purchasePrice: z.coerce.number().positive("Must be greater than 0"),
  downPayment: z.coerce.number().nonnegative("Must be 0 or more").optional().default(0),
  interestRate: z.coerce.number().nonnegative("Must be 0 or more").max(100, "Enter a percent, e.g. 6.5"),
  termMonths: z.coerce.number().int().positive("Must be greater than 0"),
  startDate: z.string().min(1, "Start date is required"),
  annualPropertyTax: z.coerce.number().nonnegative("Must be 0 or more").optional().default(0),
  annualInsurance: z.coerce.number().nonnegative("Must be 0 or more").optional().default(0),
  appreciationRate: z.coerce.number().min(-100).max(100, "Enter a percent, e.g. 3.5").optional().default(3.5),
  currentHomeValue: z.coerce.number().positive("Must be greater than 0").optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const loanExtraPaymentSchema = z.object({
  date: z.string().min(1, "Date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  notes: z.string().trim().max(200).optional(),
});

export const assetSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    type: z.enum(["STOCKS", "RETIREMENT", "REAL_ESTATE", "CRYPTO", "SAVINGS", "OTHER"]),
    currentValue: z.coerce.number().nonnegative("Must be 0 or more").optional(),
    notes: z.string().trim().max(1000).optional(),
    walletNetwork: z.enum(["BITCOIN", "STACKS"]).optional(),
    walletAddress: z.string().trim().min(1, "Wallet address is required").max(120).optional(),
    stockTicker: z
      .string()
      .trim()
      .min(1, "Ticker is required")
      .max(10, "Ticker symbols are 10 characters or fewer")
      .optional(),
    shareCount: z.coerce.number().positive("Must be greater than 0").optional(),
  })
  .refine(
    (data) => {
      if (data.type === "CRYPTO" && data.walletNetwork) return true;
      if (data.type === "STOCKS" && data.stockTicker) return true;
      return data.currentValue !== undefined;
    },
    {
      message: "Enter a current value, or link a wallet/ticker to track it automatically",
      path: ["currentValue"],
    },
  )
  .refine((data) => !data.walletNetwork || !!data.walletAddress, {
    message: "Wallet address is required",
    path: ["walletAddress"],
  })
  .refine((data) => !data.stockTicker || !!data.shareCount, {
    message: "Number of shares is required",
    path: ["shareCount"],
  });

export const budgetSchema = z.object({
  scope: z.enum(["BUSINESS", "PERSONAL"]),
  // Empty string means "overall" for that scope -- no single category.
  category: z.enum(SELECTABLE_TRANSACTION_CATEGORIES).optional(),
  monthlyLimit: z.coerce.number().positive("Must be greater than 0"),
});

export const financialGoalSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  targetAmount: z.coerce.number().positive("Must be greater than 0"),
  currentAmount: z.coerce.number().nonnegative("Must be 0 or more").optional().default(0),
  targetDate: z.string().optional(),
  linkedAssetId: z.string().optional(),
});

export const recurringTransactionSchema = z.object({
  scope: z.enum(["BUSINESS", "PERSONAL"]),
  type: z.enum(["INCOME", "EXPENSE"]),
  category: z.enum(SELECTABLE_TRANSACTION_CATEGORIES).optional(),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  description: z.string().trim().max(200).optional(),
  frequency: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
  nextDueDate: z.string().min(1, "Next due date is required"),
  // Business-use split, EXPENSE templates only -- see the schema comment on
  // RecurringTransactionTemplate.businessUsePercent. Ignored server-side for
  // INCOME regardless of what's submitted.
  businessUsePercent: z.coerce.number().min(0).max(100, "Enter a percent, e.g. 60").optional(),
});

export const homeOfficeSettingsSchema = z.object({
  homeOfficeSqFt: z.coerce.number().int().nonnegative("Must be 0 or more").max(10000).optional(),
});

export const taxSettingsSchema = z.object({
  estimatedIncomeTaxRatePercent: z.coerce
    .number()
    .min(0)
    .max(100, "Enter a percent, e.g. 15")
    .optional(),
});

// Public, unauthenticated -- the Support page's contact form. A separate
// visually-hidden honeypot field (checked directly in
// submitContactFormAction, not part of this schema) catches basic spam bots.
export const contactMessageSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  message: z.string().trim().min(1, "Message is required").max(2000),
});

export const formSignerSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(100),
  email: z.email("Enter a valid email").trim().toLowerCase(),
});

export const csvImportRowSchema = z.object({
  date: z.string().min(1),
  description: z.string().optional(),
  amount: z.coerce.number().positive(),
  type: z.enum(["INCOME", "EXPENSE"]),
  scope: z.enum(["BUSINESS", "PERSONAL"]),
  category: z.enum(SELECTABLE_TRANSACTION_CATEGORIES).optional(),
});
