import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be at most 24 characters")
  .regex(/^[A-Za-z0-9_.-]+$/, "Username may only contain letters, numbers, _ . -");

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(200, "Password is too long");

export const credentialsSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  acceptedTerms: z
    .boolean()
    .refine((v) => v === true, { message: "You must accept the Terms & Conditions" }),
});

export const roomNameSchema = z.object({
  name: z.string().trim().min(1, "Name required").max(60, "Name too long"),
});

export const inviteCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(4, "Invite code too short")
    .max(16, "Invite code too long")
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid invite code"),
});

export const messageContentSchema = z
  .string()
  .max(4000, "Message too long (max 4000 characters)")
  .optional()
  .default("");

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(40),
});

export const idParamSchema = z
  .string()
  .regex(/^\d+$/, "Invalid id")
  .transform((s) => Number(s))
  .pipe(z.number().int().positive().max(2 ** 31 - 1));

export const filenameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9.]+$/, "Invalid filename");

export function formatZodError(err: z.ZodError): string {
  return err.issues.map((i) => i.message).join("; ") || "Invalid input";
}

export function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({ error: formatZodError(result.error) });
    }
    (req as Request & { validated: z.infer<T> }).validated = result.data;
    next();
  };
}
