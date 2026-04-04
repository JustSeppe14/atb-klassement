# ATB Klassement — Webapplicatie

Een webapplicatie om het ATB-klassement te beheren, uitslagen te uploaden en resultaten per e-mail te versturen.

## Stap 1 — Supabase opzetten (gratis)
1. Ga naar supabase.com en maak een gratis account
2. Maak een nieuw project aan
3. Ga naar SQL Editor, kopieer supabase-schema.sql en klik Run
4. Ga naar Settings → API en kopieer de URL en keys

## Stap 2 — Gmail instellen
1. Zorg voor 2-stapsverificatie op Gmail
2. Ga naar myaccount.google.com/apppasswords
3. Maak een App Password aan

## Stap 3 — Netlify deployen
1. Ga naar netlify.com, maak een account
2. Add new site → Import from GitHub → selecteer deze repo
3. Ga naar Site settings → Environment variables en voeg toe:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - EMAIL_ACCOUNT
   - EMAIL_PASSWORD
   - SMTP_HOST=smtp.gmail.com
   - SMTP_PORT=587

## Lokaal draaien
npm install && cp .env.local.example .env.local && npm run dev
