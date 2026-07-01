# Setting up Supabase (plain-English, click-by-click)

Supabase is the service that will hold all of Relevé's data — every profile,
application, and membership — plus handle logins and file uploads. You own the
account; all the data stays exportable (Guardrail #4). There's a **free tier**
that's plenty for the founding cohort; you won't pay anything to start.

You do this part (it's tied to your email and billing). It takes about 10 minutes.
When you're done, hand me the three keys from Step 6 and I'll connect the app.

---

## Step 1 — Create the account
1. Go to **https://supabase.com** and click **Start your project**.
2. Sign up (you can use "Continue with GitHub" or your email).

## Step 2 — Create a project
1. Click **New project**.
2. **Name:** `releve-connect`
3. **Database password:** click **Generate a password**, then **copy it and save
   it somewhere safe** (a password manager). You'll rarely need it, but you can't
   see it again later.
4. **Region:** pick the one closest to you (e.g. *East US* for New Jersey).
5. Click **Create new project** and wait ~2 minutes while it sets up.

## Step 3 — Open the SQL editor
1. In the left sidebar, click **SQL Editor**.
2. This is where we'll create the tables from our blueprint.

## Step 4 — Create the tables
1. Open the file `schema.sql` from this project on your computer.
2. Copy **all** of its contents.
3. Paste it into the Supabase SQL editor and click **Run**.
4. You should see a success message. (If it complains, don't worry — send me the
   error text and I'll fix it.)

## Step 5 — Add the category lists
1. Still in the SQL editor, open a **new query**.
2. Open the file `supabase/seed.sql`, copy all of it, paste, and click **Run**.
3. This fills in the styles, levels, focus areas, roles, and badges.

## Step 6 — Get the three keys I need
1. In the left sidebar, click **Settings** (gear icon) → **API**.
2. Copy these three values and paste them into your `.env.local` file
   (make that file by copying `.env.example` — see that file's instructions):
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY`
     ⚠️ The service_role key is like a master key. Only ever put it in
     `.env.local` (never share it, never commit it).

---

## That's it
Once `.env.local` has those three values, tell me — I'll connect the app to your
database and we'll load the first real profile. If anything looks confusing on a
screen, take a screenshot or copy the message and send it to me; I'll walk you
through it.
