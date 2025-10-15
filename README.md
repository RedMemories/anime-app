# Setup rapido

Istruzioni per scaricare e far partire il progetto in locale.

## Prerequisiti
- Node.js LTS (consigliato 18+)
- Git
- Expo Go sul dispositivo mobile (opzionale, per test su device)

## Clona il repository
Sostituisci `<repo-url>` con l’URL del tuo repository GitHub.

```bash
git clone <repo-url>
```

Entra nella cartella del progetto (se hai clonato `AppStreamingAnime`):

```bash
cd AppStreamingAnime
```

Poi entra nella sottocartella dell’app (dove c’è `package.json`):

```bash
cd anime-app
```

## Installa le dipendenze

```bash
npm install
```

## Avvia il bundler

```bash
npm run start
```

- Scansiona il QR con Expo Go (Android/iOS) oppure usa un emulatore.

## Apri su Android (emulatore o dispositivo collegato)

```bash
npm run android
```

## Apri in modalità web (browser)

```bash
npm run web
```

## Note utili
- Se il bundler resta bloccato, chiudi con `Ctrl + C` e rilancia `npm run start`.
- In caso di errori di rete o troppi accessi all’API (429), aspetta qualche minuto e riprova.
- Per i test su emulatore Android, assicurati di avere Android SDK installato e un AVD configurato.
