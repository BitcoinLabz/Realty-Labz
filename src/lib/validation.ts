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

export const transactionSchema = z
  .object({
    type: z.enum(["INCOME", "EXPENSE"]),
    scope: z.enum(["BUSINESS", "PERSONAL"]).default("BUSINESS"),
    category: z.enum(["HOME_OFFICE", "PHONE", "OTHER"]).optional(),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    description: z.string().trim().max(200).optional(),
    date: z.string().min(1, "Date is required"),
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

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.email("Enter a valid email address").optional(),
  phone: z.string().trim().max(30).optional(),
  notes: z.string().trim().max(1000).optional(),
});

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
  side: z.enum(["BUYER", "SELLER", "DUAL"]),
  status: z.enum(["ACTIVE", "UNDER_CONTRACT", "PENDING", "CLOSED", "FELL_THROUGH"]),
  propertyAddress: z.string().trim().min(1, "Property address is required").max(300),
  mlsNumber: z.string().trim().max(50).optional(),
  listPrice: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  salePrice: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  commissionRate: z.coerce.number().min(0).max(100, "Enter a percent, e.g. 3").optional(),
  commissionAmount: z.coerce.number().nonnegative("Must be 0 or more").optional(),
  closingDate: z.string().optional(),
  notes: z.string().trim().max(2000).optional(),
  clientId: z.string().optional(),
});

export const dealDeadlineSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(200),
  dueDate: z.string().min(1, "Due date is required"),
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
  notes: z.string().trim().max(1000).optional(),
});

export const assetSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(100),
    type: z.enum(["STOCKS", "RETIREMENT", "REAL_ESTATE", "CRYPTO", "SAVINGS", "OTHER"]),
    currentValue: z.coerce.number().nonnegative("Must be 0 or more").optional(),
    notes: z.string().trim().max(1000).optional(),
    walletNetwork: z.enum(["BITCOIN", "STACKS"]).optional(),
    walletAddress: z.string().trim().min(1, "Wallet address is required").max(120).optional(),
  })
  .refine(
    (data) => (data.type === "CRYPTO" && data.walletNetwork ? true : data.currentValue !== undefined),
    {
      message: "Enter a current value, or link a wallet to track it automatically",
      path: ["currentValue"],
    },
  )
  .refine((data) => !data.walletNetwork || !!data.walletAddress, {
    message: "Wallet address is required",
    path: ["walletAddress"],
  });
