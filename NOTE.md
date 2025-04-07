## Primi passi

- Configurazione di un server locale sul mio PC, un endpoint /alive_locale (FastAPI)
- Configurazione di un server remoto con endpoint /alive_remoto (FastAPI)
- Configurazione di un frontend che dovrà connettersi ad entrambi e printare l'alive di entrambi (Svelte)

Obiettivo principale di questo primissimo test end-to-end è testare l'applicazione del frontend, che dovrà essere in grado di chiamare due backend diversi:

- Il backend centralizzato. Questo verosimilmente sarà sulla stessa macchina, ma altrimenti può essere un qualsiasi indirizzo che sia raggiungibile dalla macchina dove gira il frontend. Una prima ipotesi è che questa chiamata avvenga nella fase di server-side rendering, e quindi parta dalla macchina su cui gira il frontend centrale.

- Il localhost del laptop di chi visualizza il frontend nel browser, e che non è in nessun modo pubblico. Questa chiamata deve partire ovviamente dal browser, e quindi dal client del frontend (AKA non come parte del server-side rendering).


## Risorse e cose da leggere

Server SSH on browser : https://en.wikipedia.org/wiki/Web-based_SSH
