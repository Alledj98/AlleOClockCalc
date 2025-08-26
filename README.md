# AlleOClockCalc — V3
Funzioni: ruoli (Lavoratore/Datore) con codice datore, i18n IT/EN/FR/DE/ES, salvataggio storico PDF, export CSV/Excel, guida utente, gestione errori UI.

## Deploy rapido
```bash
firebase login
firebase use alleoclockcalc

firebase deploy --only firestore:rules
firebase deploy --only storage

cd functions
npm install
cd ..
firebase functions:config:set \
  mail.user="alleoclockcalc@gmail.com" \
  mail.pass="APP_PASSWORD" \
  mail.host="smtp.gmail.com" \
  mail.port="465" \
  mail.secure="true" \
  mail.from="AlleOClockCalc <alleoclockcalc@gmail.com>"
firebase deploy --only functions

firebase deploy --only hosting
```

## Dove modificare
- UI/ruoli/codice datore: `public/js/auth.js`, `public/index.html`
- Report + PDF/CSV/Excel + storico: `public/js/report.js`
- Dashboard Datore: `public/employer.html`, `public/js/employer.js`
- i18n: `public/js/i18n.json`
- Regole: `firestore.rules`
