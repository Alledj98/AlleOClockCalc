# Verifica preparatoria GitHub — AlleOClockCalc

Data: 13 novembre 2026.

## Origine
- Export ricevuto: `AlleOClockCalc_Fase2_GitHub_Export.zip` (68 file).
- Manifest interno validato: **67/67** SHA-256 e dimensioni corrispondenti alla copia ricevuta (il manifest esclude se stesso).
- L'export dichiara corrispondenza con Firebase Hosting `827984c074c0d501`, Cloud Functions e regole. Questa verifica del deploy proviene dal report di Cody; durante la revisione non abbiamo effettuato un accesso di attestazione indipendente alla produzione.
- GitHub `Alledj98/AlleOClockCalc`: ultimo commit in `main` al 26 agosto 2025, README “V4 COMPLETE”.

## Controlli locali
- Archivi ZIP validi, nessun path traversal, CRC ok.
- 18 file JavaScript sintatticamente validi con `node --check`.
- `npm test`: 11 test superati, 1 **non eseguibile in questo ambiente** perché manca la dipendenza `exceljs`; nessun `npm ci` eseguito durante la revisione.
- Report Cody: 13 test locali e 14 test emulatori superati in fase di collaudo; risultati non riprodotti qui. Alcuni test online rimangono aperti.
- Scansione testuale iniziale di percorsi riservati e formati noti di segreti: nessuna chiave privata o segreto operativo individuato; questo non sostituisce un audit approfondito.

## Differenze e precauzioni
- Il repository esistente contiene il vecchio frontend/backend: lo ZIP aggiunge documenti, test, lockfile e funzionalità Fase 2.
- I vecchi workflow `.github/workflows/firebase-hosting-merge.yml` e `firebase-hosting-pull-request.yml` tentano deploy Firebase automatici e invocano `npm run build` non presente nel package root. **Esclusi da questa copia candidata**. Verificare la loro rimozione dal repo remoto prima di un merge su `main`.
- Nessun `.env`, backup o dato personale reale incluso nella copia candidata. La configurazione Firebase client pubblica è mantenuta per conservare il sorgente come distribuito: non isola l'ambiente locale dalla produzione.
- I file `maintenance.*` sono materiali operativi: non applicarli come configurazione definitiva delle regole.
- I file `EXPORT_MANIFEST.json`, `EXPORT_SECURITY.json`, `EXPORT_VERIFICATION.json`, `EXPORT_INFO.md` rimangono nell'archivio originale, non nella copia ricomposta, perché descrivono l'export iniziale e non questo nuovo ZIP.
- Prima di pubblicare una release taggata: `npm ci` con toolchain corretta, `npm test`, `npm run test:emulators`, esame dipendenze, verifica differenze col commit remoto e controllo dei workflow.

Non è stato eseguito alcun deploy, commit, push né modifica a database o servizi Cloud.
