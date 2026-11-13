# Email — configurazione e collaudo

Nodemailer usa i segreti Secret Manager `MAIL_USER` e `MAIL_PASS` già previsti dal progetto. Password e token non vanno nel repository, negli ZIP o nei log.

Variabili non segrete (configurare solo nel progetto alleoclockcalc):

- `MAIL_HOST`: default smtp.gmail.com.
- `MAIL_PORT`: default 465.
- `MAIL_SECURE`: default true (TLS implicito). Per STARTTLS sulla porta 587 usare false e verificare il provider.
- `MAIL_FROM`: usare un mittente autorizzato dal provider; il default storico è AlleOClockCalc <alleoclockcalc@gmail.com> e va verificato.
- `MAIL_DAILY_LIMIT_PER_USER`: default 5; riguarda ogni lavoratore, non il totale dell'azienda.
- `MAIL_SEND_COOLDOWN_SECONDS`: default 60; protezione contro invii ravvicinati.

Account Gmail/Workspace possono richiedere password per app o altra autenticazione supportata. Il tecnico deve verificare l'impostazione reale col titolare, senza farsi inviare credenziali in chat. Le quote e gli eventuali prezzi dipendono dal provider e dall'account. Le funzioni cloud e le operazioni Firestore hanno costi separati. Le quote locali non bloccano il conto cloud al raggiungimento di un budget.

Prima di inviare: il lavoratore deve verificare l'email dal link Auth e rientrare nell'app. Per Google login l'email normalmente risulta già verificata; controllare comunque lo stato.

Se il report è collegato a un datore, l'email deve coincidere con quella del profilo datore. Se il datore cambia email in Auth fuori dall'app, deve accedere nuovamente dalla home per sincronizzare il profilo. Fino a quel momento il server non accetta un destinatario diverso.

La funzione riceve solo `requestId`, `fromMonth`, `toMonth`, `to`. Ignora PDF, link, totali e oggetti passati dal client e rigenera il PDF dai dati salvati.

Test reale minimo: un invio a un indirizzo controllato, verifica ricezione PDF e totali, un'approvazione e verifica email al lavoratore, un errore SMTP controllato solo in un ambiente di prova. Registrare orari e ID senza contenuto dei documenti personali. Nessun test reale su destinatari estranei.
