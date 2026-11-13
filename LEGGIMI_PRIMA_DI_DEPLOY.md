# AlleOClockCalc — revisione fase 2

Questa copia completa le correzioni locali della fase 1. Progetto previsto: **alleoclockcalc**, regione Functions **europe-west1**. I dati Firebase reali non sono stati letti o modificati. Il deploy e il collaudo online sono affidati a Cody.

## Cosa cambia

- Registrazione e recupero del profilo passano da `ensureProfile`; il ruolo esistente viene conservato.
- Codici datore e collegamenti sono gestiti da funzioni autenticate; nessun client può enumerare o modificare `codes`.
- `sendTimesheet` legge i turni salvati, calcola i totali sul server e salva copie del report per lavoratore e datore. Il PDF allegato all'email è generato sul server, in italiano, con gli importi nascosti se la paga del profilo è zero.
- Il nuovo storico mostra stato invio email e approvazione. Le copie inviate si scaricano tramite funzione autenticata. Modificare i turni dopo l'invio non modifica il report già ricevuto dal datore.
- L'email richiede un mittente verificato. Se c'è un datore collegato, il destinatario deve essere l'email del suo account. Senza collegamento il lavoratore può inviare a un indirizzo email valido, ma non viene creata una richiesta da approvare.
- Approvazione/rifiuto sono operazioni server con controllo del datore. Decisioni ripetute identiche non producono nuove notifiche. Una decisione già presa non è sovrascrivibile con quella opposta.
- Errori SMTP non cancellano il report. Lo stato `failed` indica mancata consegna, `sending` indica consegna da verificare. Dopo un timeout lo stesso ID non reinvia automaticamente: nessuna promessa di consegna SMTP “exactly once”. Se il processo muore dopo la spedizione e prima dell'aggiornamento, può restare `sending`; occorre verificare i log prima di un nuovo invio esplicito.
- Limite iniziale **5 invii per lavoratore per giorno UTC**, attesa **60 secondi** tra nuovi invii. Non è un limite per azienda. Variabili `MAIL_DAILY_LIMIT_PER_USER` (1–1000) e `MAIL_SEND_COOLDOWN_SECONDS` (1–3600). Il valore deve rispettare le quote effettive del provider SMTP; non costituisce un tetto di spesa cloud. Le notifiche delle decisioni sono separate e inviate una volta per decisione, ai soli report nuovi.
- `smtpTest` è riservato a chi ha il custom claim `admin: true`. Non assegnare quel claim solo per aggirare un errore di configurazione.
- Runtime Node 22, API Functions di prima generazione esplicite. Nomi delle funzioni già presenti conservati.
- Librerie PDF ed Excel locali, versioni bloccate nel lockfile; esportazione XLSX tramite ExcelJS. PDF locale con tabella multipagina. Firebase SDK rimane caricato da gstatic e richiede rete al primo accesso.
- Lettura/caricamento giorno automatico al cambio data, protezione dai caricamenti in ritardo, salvataggio atomico turni+paga del profilo. Vista mensile con tutti i giorni mantenuta.

## File da consegnare a Cody

Leggere `CODY_DEPLOY_E_COLLAUDO.md`, `docs/DATA_MODEL.md` e `VERIFICHE_FASE2.md`. I test usano solo `demo-alleoclockcalc`; nessun accesso al progetto reale è richiesto.

## Limiti espliciti

La consegna SMTP reale, la compatibilità dei dati preesistenti, i permessi IAM/Storage effettivi, CORS, Auth e service worker nel browser vanno verificati online. Il superamento dei test locali non certifica il deploy reale.

I report storici con link/token permanenti restano potenzialmente accessibili a chi possiede il link; le nuove Rules non revocano quei token. Non cancellare dati o token in massa. Prevedere analisi dedicata dei backup e dei token precedenti, preservando i PDF storici.

Il vecchio job notturno va controllato prima del rilascio. Il codice nuovo esegue backup solo con `BACKUP_ENABLED=true`; la retention è disattivata per default e si abilita con `BACKUP_RETENTION_DAYS>=7`. Non abilitare backup o cancellazioni senza accordo dell'utente. Il job precedente può rimanere attivo finché non viene messo in pausa o aggiornato da Cody.

Le chiamate email e i report non sono un sistema di certificazione delle ore: il lavoratore resta proprietario dei propri turni. Il server impedisce falsificazioni dei totali nel payload e modifiche alle copie già inviate.
