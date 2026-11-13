# Verifiche locali — revisione fase 2, 8 novembre 2026

## Esito

**25 test superati**: 12 prove locali e 13 prove integrate con Firestore/Storage Emulator. Node 22.23.4, Firebase CLI 15.35.0, Java 21 per gli emulatori. Nessun accesso ai dati live, nessun deploy e nessuna email reale inviata.

### Prove locali (12/12)

Turni notturni/sessantesimi, turni incompleti, esportazione con/senza paga, escaping CSV e formule, presenza moduli dashboard/report, protezione backup, salvataggio mensile e date locali, comportamento service worker offline con moduli/Firebase Auth, configurazione progetto, file XLSX generato e riletto, PDF multipagina.

### Emulatori (13/13)

1. Un client non può cambiare ruolo/datore, leggere o riscrivere codici, falsificare un report o approvarlo direttamente.
2. Bootstrap datore legacy conserva codice e ruolo, retry account lavoratore conserva il ruolo esistente.
3. Nuovo datore crea codice stabile; mapping in conflitto viene rifiutato.
4. Collegamento datore valida proprietà del codice e quota.
5. Invio ricalcola i totali dai turni, crea copie server, produce un PDF valido e nega download ad altri utenti.
6. Invii concorrenti con stesso ID producono una sola consegna al trasporto simulato; retry non duplica.
7. Approvazione solo dal datore, aggiornamento ricevuta lavoratore, decisioni opposte in conflitto e scritture client negate.
8. Fallimento SMTP simulato conserva report e dashboard; il retry con stesso ID non reinvia.
9. Account non verificato, data/intervallo/input email errati, turno incompleto e destinatario diverso dal datore vengono rifiutati.
10. Limite di 5 nuovi invii per lavoratore/giorno UTC, paga zero nascosta nella copia.
11. Storage privato, backup negati, file non-PDF negato e sovrascrittura PDF negata.
12. Limite per lavoratore configurabile, test con 6 invii consentiti se impostato a 10.
13. Salvataggio atomico entry+paga consentito al proprietario; lettura di turni altrui negata.

Le prove SMTP usano un trasporto simulato in memoria. Validano messaggi, destinatari, PDF e comportamento in caso di errore, non la raggiungibilità del server o l'arrivo nella casella reale.

## Altri controlli

- Sintassi dei moduli modificati e caricamento degli export Functions su Node 22.
- `npm audit --omit=dev` in functions: zero vulnerabilità segnalate nel controllo finale. Override glob/minimatch bloccati a versioni corrette, verificati con la suite backend. Questo controllo riguarda le dipendenze npm di produzione del backend, non certifica tutti i servizi remoti o i pacchetti di sviluppo.
- Lockfile inclusi per root e functions; librerie browser PDF/Excel locali e licenze conservate.
- Nessun file .env reale, chiave service account, node_modules o cache Firebase nel pacchetto finale.

## Da completare online da Cody

Compatibilità dati legacy effettivi, verifica email Auth, segreti SMTP, email con PDF realmente ricevuta, notifica decisione realmente ricevuta, CORS download autenticati, service worker/browser mobile e desktop, IAM/token storici, baseline e rollback, stato del job backup e costi reali. Non pubblicare senza aver letto CODY_DEPLOY_E_COLLAUDO.md.
