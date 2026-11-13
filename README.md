# AlleOClockCalc

**Applicazione Web per organizzare turni, registrare ore lavorate e stimare retribuzioni.**

[Apri l'app](https://alleoclockcalc.web.app/) · [Portfolio](https://www.alle-tech.it/)

## Perché nasce

AlleOClockCalc nasce da un'esigenza concreta di una persona a me vicina: tenere traccia dei turni e controllare con facilità il conteggio delle ore e dei compensi. Il progetto è cresciuto includendo strumenti per lavoratori e datori di lavoro.

## Funzionalità principali

- Calendario giornaliero e mensile, turni notturni, giorni liberi e calcolo delle ore.
- Stima dei compensi sulla base della paga oraria impostata.
- Esportazione dei report in PDF, CSV e XLSX.
- Accesso autenticato con profili lavoratore e datore; collegamento tramite codice datore.
- Invio report, storico delle copie inviate, approvazione o rifiuto e notifiche email.
- Archiviazione privata dei PDF, protezioni di accesso e backup programmati.
- Interfaccia mobile e supporto a più lingue.

## Stack

HTML, CSS, JavaScript, Firebase Hosting, Authentication, Cloud Firestore, Storage, Cloud Functions (Node.js 22). Test con Node.js ed emulatori Firebase.

## Stato del progetto

**Fase 2 (13 novembre 2026)**. Il report di esportazione consegnato dal manutentore riporta un confronto dei sorgenti con la versione pubblicata e 27 controlli automatici e integrati superati. Il codice viene condiviso come **snapshot revisionabile**, non come garanzia di pieno collaudo su tutti i dispositivi.

Restano da completare, tra gli altri: login Google, reset password end-to-end, offline su dispositivo fisico e alcuni test di concorrenza online. Vedi `ESITO_FASE2_2026-11-13.md` e `VERIFICHE_FASE2.md`.

## Riproducibilità e test

Richiesti Node.js 22 per le Functions; per Firebase CLI/emulatori usare una versione Node.js conforme ai requisiti del lockfile e Java 21+. Non usare l'ambiente di produzione per i test.

```bash
npm ci
npm --prefix functions ci
npm test
npm run test:emulators
```

Il comando `test:emulators` utilizza `demo-alleoclockcalc` e test con dati fittizi. Il frontend contiene la configurazione web pubblica del progetto Firebase in uso: **servirlo localmente non significa isolarlo dai dati di produzione**. Non accedere con account reali durante prove locali non isolate. Non fare deploy dal clone senza aver verificato esplicitamente progetto, permessi e configurazione.

## Repository e pubblicazione

Questa copia di revisione non contiene i vecchi workflow GitHub di deploy automatico: si tratta di una precauzione per evitare pubblicazioni involontarie su Firebase. Il workflow `ci.yml`, se presente, esegue solo test locali. Prima di aggiornare `main`, verificare che gli eventuali vecchi workflow automatici siano **rimossi anche nel repository remoto**.

Non sono inclusi database, dati reali, credenziali SMTP, chiavi private, `.env`, backup o configurazioni runtime. I riferimenti ai nomi dei segreti non ne includono i valori. La Firebase Web API key è una configurazione client pubblica e non concede di per sé accesso ai dati.

## Documentazione

- `docs/USER_GUIDE.md`: guida per l'utilizzo.
- `docs/DATA_MODEL.md`: strutture dati e accessi.
- `docs/EMAIL_SMTP.md`: architettura email e limiti.
- `docs/SETUP_FIREBASE.md`: informazioni di setup.
- `ESITO_FASE2_2026-11-13.md`: collaudo e limiti dichiarati.
- `GITHUB_REVIEW_NOTES.md`: differenze da GitHub e precauzioni.

**Sviluppo assistito dall'IA:** ideazione e scelte funzionali guidate dalle esigenze degli utilizzatori, con supporto dell'IA principalmente nell'implementazione, nella revisione e nel debugging del codice. L'autore ha una preparazione informatica precedente all'utilizzo di tali strumenti.

*Licenza:* non è stata aggiunta alcuna licenza open source. I diritti sul codice del progetto e sui componenti di terze parti restano soggetti alle rispettive condizioni.
