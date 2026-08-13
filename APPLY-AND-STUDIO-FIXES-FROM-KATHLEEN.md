# Claude Code — Corrective Pass: ungate /apply + finish the studio form
*Kathleen · July 25, 2026 · releve-platform · found in live test on releveconnect.com*

## Priority 1 — /apply is locked behind the sign-in wall. Ungate it. (Critical)

**Bug:** Navigating to `/apply` redirects to `/login?next=%2Fapply`. The homepage
"Apply to the Professional Roster" button links to `/apply` correctly, but the
`/apply` page requires authentication, so a professional lands on
"Sign in — email me an 8-digit code" instead of an application. Combined with the
sign-in codes not delivering, professionals are **completely locked out of the
Professional Roster application.** Nobody can apply.

**Fix:** The Professional Roster application must be a **public form, reachable
without signing in** — architecturally identical to the studio form at `/studios`,
which is already public ("No account is created and nothing is charged"). A
professional fills out the application FIRST; they do not sign in first.

- Remove the auth gate / `next=/apply` redirect from `/apply`.
- `/apply` renders the application form directly to any visitor.
- No account is created on submit; submission notifies the team, same pattern as
  the studio "Request information" flow.
- Do NOT change `/join` — families staying studio-gated behind an invite/code is
  correct. Only `/apply` was wrongly gated.

**Definition of done:** Visiting `/apply` (or clicking "Apply to the Professional
Roster") shows the professional application immediately, with no sign-in step.

## Priority 2 — Studio form fixes (releveconnect.com/studios)

Current state verified live — these are still wrong:

1. **"Roughly how many students?" — make REQUIRED.** Remove "(optional)" from the
   label. The dropdown default "Prefer not to say" must not be an accepted submit
   value — the studio must pick a real band (Under 50 · 50–99 · 100–199 · 200+)
   before the form submits. Location + student scale both feed Swing/Flex matching;
   this is not optional data.

2. **"Anything you'd like us to know?" — make REQUIRED.** Remove "(optional)".
   A founding studio should tell us something; do not accept an empty submit.

3. **Remove "Kathleen" from all copy.** Two places on `/studios`:
   - Intro: "…Kathleen will reach out to walk you through it." →
     "…**the Relevé Connect team** will reach out to walk you through it."
   - Footer microcopy: "…Kathleen onboards founding studios personally." →
     "…**the Relevé Connect team** reviews and onboards founding studios personally."

4. **City / State — enforce as truly REQUIRED** (not just helper text). The label
   already says "Required — your city and state are how we match you with nearby
   teachers and subs," but confirm the form actually blocks submit when City or
   State is empty, stored structured + geocode-ready. No location, no submit.
   (This mirrors the approved Studio Profile spec: location is mandatory on BOTH
   the entry/"Request Information" form and the full profile.)

5. **Submit button label — Kathleen's decision.** Currently the black button reads
   "Request information." Spec allows this (the studio surface is a
   request-information form). Leave as "Request information" unless Kathleen says
   otherwise — flagging only because she questioned it in review.

## Do NOT touch
- The homepage three-path block, copy, and CTA links are correct
  (Apply→/apply, Become a Founding Studio→/studios, Join Through Your Studio→/join).
- `/join` staying studio-gated is correct.
- The professional application content itself — just make it publicly reachable.

*— together we rise · nous nous levons · relevé —*
