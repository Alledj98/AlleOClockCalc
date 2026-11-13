# Modello dati — fase 2

- `users/{uid}`: profilo (`role`, `employerUid`, `email`, `uid` gestiti dal server; `hourlyRate` modificabile dal proprietario).
- `users/{uid}/entries/{YYYY-MM-DD}`: turni originali del lavoratore, privata lettura/scrittura del proprietario.
- `users/{uid}/pdfs/{id}`: vecchio archivio PDF e nuovi PDF caricati dal lavoratore, privato. I nuovi caricamenti conservano `storagePath`, non creano nuovi link download con token.
- `users/{uid}/submissions/{requestId}`: copia server del report inviato, con turni immutabili, totali, destinatario, eventuale datore, `schemaVersion: 2`, stato e stato email. Client solo lettura.
- `employers/{uid}`: codice datore, solo lettura per il proprietario.
- `employers/{uid}/submissions/{requestId}`: copia datore dello stesso report. Lettura privata datore, decisione solo via funzione.
- `codes/{CODE}`: lookup gestito dal server, client sempre negati.
- `operationLimits/{uid}_{kind}`: quote server per link, invio e download. Client sempre negati.

L'ID invio è generato con `crypto.randomUUID()` e conservato dopo errori di rete. La transazione crea una sola copia per ID. Un nuovo ID è consentito solo per nuovo intervallo/destinatario o comando esplicito del lavoratore.

`emailStatus`: `sending`, `sent`, `failed`. `decisionEmailStatus` usa gli stessi valori o `not-applicable` per report legacy. Questi campi non dimostrano lettura dell'email da parte del destinatario.

Gli account datore legacy mantengono il proprio codice se valido e non in conflitto. Un conflitto blocca l'operazione senza sovrascrivere altri codici. La regola permissiva precedente rende necessaria una verifica dei mapping reali prima del deploy. Il server verifica anche la corrispondenza codice nel documento `employers` e il ruolo del profilo datore.

I report legacy restano leggibili nella dashboard datore e possono essere valutati. Non viene inventata una copia lavoratore se manca il documento originale. Per i nuovi report, il PDF on demand richiede accesso alla copia server del lavoratore o del datore.

Storage: `users/{uid}/reports/{file}` accessibile solo al proprietario; creazione PDF fino a 5 MiB, sovrascrittura negata. `backups/**` negato a tutti i client. Admin SDK e IAM sono piani separati dalle Firebase Rules.
