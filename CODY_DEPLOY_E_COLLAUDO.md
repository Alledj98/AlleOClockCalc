# Consegna a Cody — deploy e collaudo AlleOClockCalc

## Obiettivo e ambito

Il codice è già revisionato localmente. Il tuo compito è verificare le condizioni reali, applicare i soli aggiustamenti necessari su **alleoclockcalc**, eseguire il deploy selettivo e collaudare online. Regione Functions prevista: europe-west1. Non intervenire su portfolio, altri progetti o progetto Vertex AI. Non creare chiavi service account. Non cambiare account di fatturazione.

## Prima del deploy

1. Leggi `LEGGIMI_PRIMA_DI_DEPLOY.md`, `VERIFICHE_FASE2.md`, `docs/DATA_MODEL.md` e `docs/EMAIL_SMTP.md`.
2. Lavora in una cartella nuova, conserva il sorgente attualmente pubblicato separatamente. Verifica account CLI e progetto tramite comandi in sola lettura. Controlla hosting target, bucket reale, Functions e versioni, Rules, indici e job Scheduler. Non riportare credenziali in chat.
3. Usa **Node 22** e **Java 21+** per gli emulatori. Da root esegui `npm ci`, poi `npm --prefix functions ci`, `npm run assets`, `npm test`, `npm run test:emulators`. I test emulatori usano esclusivamente demo-alleoclockcalc.
4. Esporta/conserva regole e configurazioni live e predisponi un backup dei dati con autorizzazione del titolare. Il rollback non può dipendere soltanto dal codice della vecchia fase 1, che ha difetti noti di sicurezza.
5. Controlla mapping `codes`/`employers` e ruoli esistenti: confronta proprietario codice, codice nel documento datore e ruolo profilo. Non sovrascrivere conflitti. Verifica campi reali dei documenti entry e identificativi (il nuovo schema accetta uid, date, dayOff, i quattro orari, hourlyRate, totalMinutes, totalPay, updatedAt). Se esistono campi legacy aggiuntivi, prepara e testa una compatibilità esplicita prima di applicare le Rules.
6. Controlla Secret Manager per MAIL_USER/MAIL_PASS e autorizzazioni delle sole funzioni email. Verifica MAIL_FROM col titolare. Nessun valore segreto in file di consegna o output chat.
7. Conferma i limiti email: default 5/giorno per lavoratore e 60 secondi tra nuovi invii, modificabili con variabili documentate. Non aumentare alla cieca oltre le quote SMTP. Il budget cloud è un avviso e non un blocco di spesa.
8. Verifica CORS del bucket per download autenticati `getBlob`, limitando le origini ai domini effettivi dell'app e ai soli metodi necessari. Non concedere allUsers o ruoli Editor/Owner per aggirare errori. Rileva eventuali token permanenti su backup vecchi e pianifica la revoca separatamente, senza distruggere documenti storici.
9. Concorda una breve finestra di manutenzione e informa gli utenti di ricaricare l'app dopo il rilascio: vecchi client e nuove Rules non sono completamente compatibili per registrazione/codici/approvazioni. Controlla se il vecchio backup notturno è attivo e quale politica desidera il titolare. Il nuovo backup è opt-in; evitare di lasciare un job inatteso attivo o riattivarlo automaticamente.

## Deploy selettivo

Esegui uno step alla volta, con verifica dell'esito. Niente `--force`. Se il CLI propone eliminazioni, cambio di generazione, nuovi servizi inattesi o cambio di permessi, fermati e analizza prima di proseguire.

1. Functions applicative (nomi esistenti conservati, nuove callable aggiunte):

```bash
firebase deploy --project alleoclockcalc --only functions:ensureProfile,functions:linkEmployer,functions:sendTimesheet,functions:getSubmissionReport,functions:updateSubmissionStatus,functions:smtpTest
```

Verifica caricamento Node 22, nomi e regione, accesso ai segreti e log di avvio. Il codice usa v1: non convertire a v2 durante questo rilascio.

2. Pubblica frontend e Rules nella finestra prevista. Le nuove funzioni devono già essere disponibili; le operazioni di vecchi client vanno bloccate con manutenzione concordata. Le scritture al momento del cambio Rules non sono atomiche rispetto a Hosting, quindi controlla ogni passaggio.

```bash
firebase deploy --project alleoclockcalc --only hosting
firebase deploy --project alleoclockcalc --only firestore:rules,storage
```

Confronta indici esistenti prima di qualsiasi deploy di indici. Le query nuove principali richiedono soltanto createdAt/collection diretta e la query per data già presente.

3. Backup: gestire separatamente dopo aver confermato intenzione del titolare. Per aggiornare il codice esistente si usa solo `--only functions:scheduledBackup`. Il nuovo codice non esegue backup se BACKUP_ENABLED non è true. Retention di default disabilitata, niente cancellazione automatica di archivi vecchi. Prima di sospendere un backup effettivamente usato, concorda una copia alternativa e il ripristino.

## Collaudo online con dati controllati

Usa account di prova e destinatari controllati autorizzati. Per creare nuovi account o documenti di test segui l'autorizzazione del titolare. Niente test con dati personali estranei.

- Home: login email/password, verifica email, reset password, Google, uscita. Nuovo datore e account datore già esistente mantengono ruolo corretto; login interrotto a metà si recupera con nuovo accesso.
- Giornaliero: giornata nuova e già presente, cambio data con rete lenta, giorno libero con orari precedenti, turni notturni, turno incompleto rifiutato, paga zero e importi nascosti.
- Mensile: tutti i giorni, mese vuoto, febbraio bisestile, caricamenti concorrenti, salvataggio atomico, riepiloghi e paga zero. Controlla che il mese non venga cancellato al primo accesso.
- Report: intervallo max 12 mesi, cambio intervallo dopo caricamento, PDF multipagina locale, CSV, XLSX reale, upload e scaricamento autenticato. Verifica eventuali CORS prima di dichiarare pronto.
- Collegamento: codice valido/errato, email datore corretta/errata. Un lavoratore non può leggere altri profili o inserire richieste direttamente.
- Invio reale: un PDF generato dai turni salvati, storico lavoratore e dashboard datore con stesso ID e totali; modifica successiva ai turni lascia invariata la copia inviata.
- Doppio clic/ripetizione richiesta con stesso ID: un solo report/email. Dopo timeout controllare lo storico prima di creare un nuovo invio. `sending` persistente richiede verifica dei log SMTP, non retry cieco.
- Approva/rifiuta: soltanto il datore corretto, esito visibile nello storico lavoratore, email notifica ricevuta. Decisione ripetuta uguale innocua, decisione opposta rifiutata.
- Storage: altro utente e anonimo non leggono i PDF via SDK, nessun client legge backup; i link con token preesistenti richiedono analisi distinta. I PDF nuovi di report condivisi si scaricano tramite callable autenticata.
- PWA: aggiorna il service worker, ricarica due volte, verifica mobile; offline shell disponibile dopo primo accesso. Non promettere invio/email o salvataggio confermato senza rete.
- Dopo test, verifica costi/log, cleanup dei soli dati di prova autorizzati, eventuali errori e ritorno del titolare al proprio account.

## Rollback

Prima del rilascio conserva baseline Hosting, sorgente Functions e Rules reali. Se il deploy parziale fallisce, blocca nuove operazioni di scrittura/invio e ripristina una combinazione coerente già testata. Non ripubblicare automaticamente le vecchie Rules che rendono `codes` scrivibile a tutti gli autenticati. I documenti `submissions` schema 2 devono essere conservati. Non cancellare nuovi report per tornare alla UI precedente. Il piano concreto va adattato alla baseline live prima del deploy.

## Risultato da riportare

Versioni deployate, orari, funzioni/regione, account di test usati senza password, prove riuscite/fallite, prova SMTP, stato backup e costi. Nessuna dichiarazione “100% pronto” finché consegna email e test browser reali non sono superati.
