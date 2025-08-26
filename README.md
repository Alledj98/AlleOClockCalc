# AlleOClockCalc — V4 COMPLETE
- Tester SMTP (Ctrl+Click su “Invia PDF via email”)
- Toast non invasivi (niente alert)
- Tema chiaro/scuro (toggle 🌓)
- Functions con Secret Manager + .env (post-2026 safe)
- Traduzioni IT/EN/FR/DE/ES

## Setup
```bash
firebase login
firebase use alleoclockcalc

firebase deploy --only firestore:rules
firebase deploy --only storage

cd functions
npm install
cd ..

# Segreti (solo la prima volta)
firebase functions:secrets:set MAIL_USER   # alleoclockcalc@gmail.com
firebase functions:secrets:set MAIL_PASS   # password per app SENZA SPAZI

# Deploy functions e hosting
firebase deploy --only functions
firebase deploy --only hosting
```
