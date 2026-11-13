# Preparazione aggiornamento AlleOClockCalc — Fase 2

Stato: **preparazione; sorgenti della Fase 2 NON ANCORA caricati in questo branch**.

Il branch `prep/fase2-2026-11-13` parte dalla V4 (26 agosto 2025). È stato creato per aggiornare il repository alla Fase 2 del 13 novembre 2026 senza interferire con il sito Firebase in produzione.

## Interventi di sicurezza iniziali
- Rimozione dei due workflow GitHub Actions legacy che tentavano deploy automatici Firebase su pull request e su push in `main`.
- Non eseguire deploy né usare database reali durante il caricamento.
- Nessun file dell'applicazione è stato cambiato in questa fase preparatoria.

## Prima del merge
1. Importare i sorgenti dal pacchetto locale revisionato `AlleOClockCalc_Fase2_GitHub_Candidate.zip`.
2. Non importare `.env`, password, token, account di servizio, database, report personali o backup.
3. Verificare `npm ci` e `npm --prefix functions ci` con la toolchain corretta, poi `npm test` e i test emulatori in ambiente isolato.
4. Verificare il diff contro `main`, incluse Rules, Functions e configurazioni.
5. Confermare che i workflow di deploy legacy non riappaiano nel commit.
6. Solo dopo, valutare il merge della pull request.

### Limiti del collaudo riportati
Login Google, recupero password completo, comportamento offline su dispositivo fisico e alcune prove di concorrenza reali non sono state certificate nel report Fase 2.

Questa nota non certifica l'assenza di vulnerabilità e non equivale a un rilascio di produzione.
