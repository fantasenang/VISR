import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createOwnerUser, isOwnerConfigured } from "@/lib/admin/auth";
import { clearAdminAuthAttempts, consumeAdminAuthAttempt } from "@/lib/admin/rate-limit";

const ACTIVATION_CODE_SHA256 = "872443304bb0a053da60ab7def60fc5bdd9143c4597761a9d3fa3645b23ab742";

const activationSchema = z
  .object({
    setupCode: z.string().trim().min(12).max(128),
    password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
    confirmPassword: z.string().min(1).max(128),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "PASSWORD_MISMATCH",
  });

function isValidActivationCode(value: string) {
  const candidate = Buffer.from(createHash("sha256").update(value.trim()).digest("hex"));
  const expected = Buffer.from(ACTIVATION_CODE_SHA256);
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function redirectToControl(request: Request, error?: string) {
  const target = new URL("/visr-control", request.url);
  if (error) target.searchParams.set("setup_error", error);
  const response = NextResponse.redirect(target, 303);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Robots-Tag", "noindex");
  return response;
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== requestUrl.origin) return redirectToControl(request, "invalid_request");

  const limit = consumeAdminAuthAttempt(request, "setup");
  if (!limit.allowed) return redirectToControl(request, "rate_limited");

  const formData = await request.formData().catch(() => null);
  if (!formData) return redirectToControl(request, "invalid_request");
  const parsed = activationSchema.safeParse({
    setupCode: formData.get("setupCode"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    const mismatch = parsed.error.issues.some((issue) => issue.message === "PASSWORD_MISMATCH");
    return redirectToControl(request, mismatch ? "password_mismatch" : "invalid_password");
  }
  if (!isValidActivationCode(parsed.data.setupCode)) return redirectToControl(request, "invalid_setup_code");

  try {
    if (await isOwnerConfigured()) return redirectToControl(request);
    await createOwnerUser(parsed.data.password);
    clearAdminAuthAttempts(request, "setup");
    const response = NextResponse.redirect(new URL("/visr-control/login?new_owner=1", request.url), 303);
    response.headers.set("Cache-Control", "no-store, max-age=0");
    response.headers.set("X-Robots-Tag", "noindex");
    return response;
  } catch (error) {
    console.error(JSON.stringify({
      event: "ADMIN_NATIVE_SETUP_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR",
      timestamp: new Date().toISOString(),
    }));
    return redirectToControl(request, "activation_failed");
  }
}
