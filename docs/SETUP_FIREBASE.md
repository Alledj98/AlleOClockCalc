# Configurazione Firebase

Il percorso aggiornato è `../CODY_DEPLOY_E_COLLAUDO.md`. Usare esclusivamente il progetto alleoclockcalc per il deploy e demo-alleoclockcalc per i test.

Il frontend contiene la configurazione pubblica Firebase. Non è una chiave privata di service account. La protezione dei dati dipende da Auth, Firestore Rules, Storage Rules e controlli backend.

Installazione locale Node 22 e Java 21+: `npm ci`, `npm --prefix functions ci`, `npm run assets`, `npm test`, `npm run test:emulators`.

Le email usano MAIL_USER e MAIL_PASS in Secret Manager, con le variabili non segrete documentate in EMAIL_SMTP.md. Non esportare i valori e non mettere file .env reali nel pacchetto.

Il deploy va eseguito per componenti e con verifica dei dati e regole preesistenti. Il collaudo online deve essere completato prima dell'uso ordinario.
