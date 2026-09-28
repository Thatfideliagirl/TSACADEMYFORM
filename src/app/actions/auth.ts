"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCode } from "@/lib/codes";

export type FormState = { error?: string } | undefined;

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const sha = (s: string) => createHash("sha256").update(s).digest();

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = text(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "That email and password do not match. First time here? Use Activate your account." };
  }
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

// The very first admin has no invite, so the setup email and code come from private settings.
async function isFirstAdminSetup(db: ReturnType<typeof createAdminClient>, email: string, code: string) {
  const wantEmail = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const wantCode = process.env.ADMIN_SETUP_CODE?.trim();
  if (!wantEmail || !wantCode || email !== wantEmail) return false;
  if (!timingSafeEqual(sha(code), sha(wantCode))) return false;
  const { count } = await db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin");
  return (count ?? 0) === 0;
}

// First time sign in: email and invite code, then the person chooses a password.
export async function activate(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = text(formData, "full_name");
  const email = text(formData, "email").toLowerCase();
  const code = text(formData, "code");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!fullName) return { error: "Enter your full name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Enter the email your admin added." };
  if (!code) return { error: "Enter the invite code your admin gave you." };
  if (password.length < 8) return { error: "Choose a password with at least 8 characters." };
  if (password !== confirm) return { error: "The two passwords are not the same." };

  const db = createAdminClient();

  // Limit guessing: 8 tries per email every 10 minutes.
  const key = `activate:${email}`;
  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await db.from("verify_attempts").select("id", { count: "exact", head: true })
    .eq("device_key", key).gte("created_at", since);
  if ((count ?? 0) >= 8) return { error: "Too many tries. Wait 10 minutes, then try again." };
  await db.from("verify_attempts").insert({ device_key: key });

  const wrong = { error: "That email and code do not match. Check them, or ask your admin for a new code." };

  const { data: invite } = await db.from("invites").select("*").eq("email", email).is("used_at", null).maybeSingle();
  let role: "admin" | "moderator";
  let assign: string[] = [];
  if (invite && checkCode(code, invite.code_hash)) {
    role = invite.role;
    assign = invite.cohort_course_ids ?? [];
  } else if (await isFirstAdminSetup(db, email, code)) {
    role = "admin";
  } else {
    return wrong;
  }

  const { data: existing } = await db.from("profiles").select("id").eq("email", email).maybeSingle();
  let userId: string;
  if (existing) {
    // Someone who was locked out and got a new code: set their new password.
    userId = existing.id;
    const { error } = await db.auth.admin.updateUserById(userId, { password });
    if (error) return { error: "Could not set your password. Try a different one." };
    await db.from("profiles").update({ full_name: fullName }).eq("id", userId);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) return { error: "Could not create your account. Try a different password, or ask your admin." };
    userId = data.user.id;
    const { error: profileError } = await db.from("profiles").insert({ id: userId, full_name: fullName, email, role });
    if (profileError) {
      await db.auth.admin.deleteUser(userId);
      return { error: "Setup did not finish. Please try again." };
    }
  }

  if (assign.length) {
    await db.from("cohort_course_moderators").upsert(
      assign.map((id) => ({ cohort_course_id: id, user_id: userId })),
      { onConflict: "cohort_course_id,user_id", ignoreDuplicates: true },
    );
  }
  if (invite) await db.from("invites").update({ used_at: new Date().toISOString() }).eq("id", invite.id);

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  redirect(signInError ? "/" : "/dashboard");
}
