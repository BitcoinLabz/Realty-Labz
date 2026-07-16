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
    category: z.enum(["HOME_OFFICE", "PHONE", "OTHER"]).optional(),
    amount: z.coerce.number().positive("Amount must be greater than 0"),
    description: z.string().trim().max(200).optional(),
    date: z.string().min(1, "Date is required"),
  })
  .refine((data) => data.type !== "EXPENSE" || !!data.category, {
    message: "Category is required for expenses",
    path: ["category"],
  });

export const mileageLogSchema = z.object({
  date: z.string().min(1, "Date is required"),
  miles: z.coerce.number().positive("Miles must be greater than 0"),
  isBusiness: z.enum(["true", "false"]).transform((v) => v === "true"),
  note: z.string().trim().max(200).optional(),
});
