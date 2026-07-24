"use server";

// The "Become a Founding Studio" interest form (the Studios path in V1).
//
// Studios are onboarded MANUALLY / white-glove by Kathleen — there is NO
// self-serve studio account and NO billing here (V1 brief, explicitly deferred).
// This action does exactly two things: records the submission in studio_interest
// and emails Kathleen so she can reach out. It creates no account, no
// employer_profile, and no session.
//
// The sender is a not-yet-signed-in studio owner, so the write goes through the
// SERVICE ROLE (admin client) — studio_interest is default-deny to every user by
// RLS, and only the server touches it.

import { createAdminClient } from "@/lib/supabase/admin";
import { sendStudioInterestAlert } from "@/lib/notifications";
import { STUDENT_COUNT_BANDS, parseEnum } from "@/lib/studio/profile";

export type StudioInterestState = { ok: boolean; message: string };

/** Human labels for the student-count bands, for the admin email. */
const STUDENT_COUNT_LABELS: Record<string, string> = {
  under_50: "Under 50",
  "50_99": "50–99",
  "100_199": "100–199",
  "200_plus": "200+",
};

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function submitStudioInterest(
  _prev: StudioInterestState,
  formData: FormData,
): Promise<StudioInterestState> {
  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const studioName = str("studio_name");
  const contactName = str("contact_name");
  const email = str("email").toLowerCase();
  const phone = str("phone") || null;
  const city = str("city") || null;
  const stateProvince = str("state_province") || null;
  const studentCountBand = parseEnum(str("student_count_band"), STUDENT_COUNT_BANDS);
  const message = str("message") || null;

  // ---- Validation (kept light — this is an interest form, not an application) --
  if (!studioName) return { ok: false, message: "Please tell us your studio's name." };
  if (!contactName) return { ok: false, message: "Please tell us your name." };
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Please enter a valid email address." };

  const admin = createAdminClient();
  const { error } = await admin.from("studio_interest").insert({
    studio_name: studioName,
    contact_name: contactName,
    email,
    phone,
    city,
    state_province: stateProvince,
    student_count_band: studentCountBand,
    message,
    source: "studios_page",
  });

  if (error) {
    console.error("[studios] interest insert failed:", error.message);
    return {
      ok: false,
      message: "Something went wrong saving that — please try again in a moment.",
    };
  }

  // Notify Kathleen. Best-effort: a mail failure must not fail a saved submission.
  const location = [city, stateProvince].filter(Boolean).join(", ") || null;
  await sendStudioInterestAlert({
    studioName,
    contactName,
    email,
    phone,
    location,
    studentCountLabel: studentCountBand ? STUDENT_COUNT_LABELS[studentCountBand] ?? null : null,
    message,
  });

  return {
    ok: true,
    message: "Thank you — we've got your details. Kathleen will be in touch personally.",
  };
}
