# Wine Club Manager (Pro)

Full management app for the Miles Mossop Family Wine Club.
Next.js 15 + Supabase + Vercel. Connects to Payfast, Mailchimp and WooCommerce.

WHAT IT DOES
- Admin dashboard: every subscription with details, delivery address and start date.
- New subscribers arrive automatically from Payfast (the webhook).
- Each new member automatically gets a welcome email (via Mailchimp) and a unique
  discount code created in WooCommerce.
- Members log in (no password - a link is emailed) to change their delivery address
  and to pause or cancel their subscription.

===================================================================
SETUP - do the sections in this order. Take it slowly; it's mostly copy and paste.
===================================================================

You'll collect a set of "keys" from four services and paste them into Vercel at the
end. Keep a blank note open and paste each key into it as you go.

-------------------------------------------------------------------
1) SUPABASE  (the database + the member logins)
-------------------------------------------------------------------
1. Go to supabase.com, sign in, New project. Name it "wine-club", set a database
   password (save it), pick the closest region, Create.
2. Left menu > SQL Editor > New query. Open supabase-schema.sql from this folder,
   copy everything, paste, Run. That builds the tables.
3. Left menu > Authentication > Providers, make sure "Email" is on. Under Email,
   turn ON "Enable email OTP" / magic link (it's usually on by default).
4. Left menu > Project Settings (gear) > API. Copy these three, into your note:
   - Project URL
   - anon public key
   - service_role key   (secret - keep it safe)

-------------------------------------------------------------------
2) MAILCHIMP  (welcome emails)
-------------------------------------------------------------------
1. In Mailchimp: Account & billing > Extras > API keys > Create A Key. Copy it.
   (It ends in something like -us21. That ending matters, keep the whole key.)
2. Find your Audience ID: Audience > All contacts > Settings > Audience name and
   defaults. Copy the "Audience ID". Add both to your note.
3. Set up the welcome email itself (one time):
   Automations > Create > Customer Journey. Starting point: "Contact joins audience"
   (or "tag is added" = Wine Club). Add an Email step, paste in your thank-you email,
   turn the journey On. The app adds each new member to the audience; Mailchimp sends
   this email.

-------------------------------------------------------------------
3) WOOCOMMERCE  (the member discount codes)
-------------------------------------------------------------------
1. In WordPress: WooCommerce > Settings > Advanced > REST API > Add key.
2. Description "Wine Club app", User = an admin, Permissions = Read/Write, Generate.
3. Copy the Consumer key (ck_...) and Consumer secret (cs_...) into your note NOW -
   the secret is shown only once.
4. Note your store web address, e.g. https://milesmossopwines.com

-------------------------------------------------------------------
4) PAYFAST  (you already have this)
-------------------------------------------------------------------
You need: Merchant ID, Merchant Key, and your Passphrase (Settings in Payfast).
Add them to your note. Keep the passphrase EXACTLY as it is in Payfast.

-------------------------------------------------------------------
5) PUT IT ON GITHUB, THEN VERCEL
-------------------------------------------------------------------
1. Unzip this folder. Create a new PRIVATE repo on github.com, use the
   "uploading an existing file" link, and drag in everything INSIDE the folder.
2. On vercel.com: Add New > Project > import that repo. Leave framework as Next.js.
3. Before deploying, open Environment Variables and add these. For each: pick
   "Config" for the public/non-secret ones and "Secret" for the rest, and tick all
   three environments (Production, Preview, Development).

   Secret:
     SUPABASE_SERVICE_ROLE_KEY   = your service_role key
     PAYFAST_MERCHANT_KEY        = your merchant key
     PAYFAST_PASSPHRASE          = your passphrase
     MAILCHIMP_API_KEY           = your Mailchimp key
     WOO_CONSUMER_KEY            = ck_...
     WOO_CONSUMER_SECRET         = cs_...
   Config:
     NEXT_PUBLIC_SUPABASE_URL      = your Project URL
     NEXT_PUBLIC_SUPABASE_ANON_KEY = your anon public key
     ADMIN_EMAILS                  = matspelser@outlook.com   (emails allowed into admin)
     PAYFAST_MERCHANT_ID           = 10814083
     PAYFAST_SANDBOX               = true   (switch to false when live)
     MAILCHIMP_AUDIENCE_ID         = your audience id
     WOO_STORE_URL                 = https://milesmossopwines.com
     DISCOUNT_PERCENT              = 10

4. Deploy. You get a URL like https://wine-club.vercel.app

-------------------------------------------------------------------
6) CONNECT PAYFAST TO THE APP
-------------------------------------------------------------------
In Payfast > Settings > Integration, set the ITN / Notify URL to:
    https://YOUR-APP.vercel.app/api/payfast/notify
Turn ITN on. Keep PAYFAST_SANDBOX = true and run one sandbox subscription first.
Watch the member appear in the admin dashboard, and check Mailchimp + WooCommerce.
Once it all works, set PAYFAST_SANDBOX to false and redeploy.

-------------------------------------------------------------------
HOW TO USE IT
-------------------------------------------------------------------
- Admin: go to your app URL, sign in with an email listed in ADMIN_EMAILS. You land
  on the Subscriptions dashboard.
- Member: a member goes to the same URL, enters the email they joined with, clicks
  the link in their inbox, and lands on their own account page.

IMPORTANT NOTES (read these)
- Delivery address: Payfast does not reliably hand the app a delivery address, so
  members set theirs on their account page. The welcome email should ask them to log
  in and add it. The admin list shows "not provided" until they do.
- Pause / cancel: the app asks Payfast to do it automatically. Payfast's subscription
  API is the one part that couldn't be tested here, so if a pause or cancel doesn't go
  through automatically, it's logged as a "request needing manual action" on the
  dashboard and you action it in Payfast. Test this in sandbox before launch.
- The service_role key, Payfast passphrase, Mailchimp and Woo secrets are powerful.
  They live only in Vercel's Secret variables, never in the code.
