# StridePause

A running app for iPhone and Android that tracks mile pace, auto-pauses when you stop, reminds you to fuel, and saves your runs and routes. It keeps recording when it's minimized or behind Spotify.

Built with [Expo](https://expo.dev) (React Native), so one codebase covers both platforms.

## Roadmap

1. **Background tracking test** (this version): GPS keeps recording when the app is hidden.
2. Pace engine with auto-pause after 5 seconds stopped.
3. Fueling reminders (every mile or every N minutes, custom message, voice cue).
4. Run log and route map, matching the original design.

## How background tracking works

- **iPhone:** the app has the `location` background mode. It asks for "Always" location permission and shows the blue location pill while a run is going. iOS is told the activity is fitness and is never allowed to pause updates on its own.
- **Android:** tracking runs in a foreground service with a persistent "StridePause is tracking your run" notification. That's what stops Android from killing it behind other apps.
- GPS fixes are handled by a background task (`src/tracking/locationTask.ts`) and saved to phone storage straight away, so nothing is lost if the screen is off.

## Testing step 1 on your phone

You need a free [Expo account](https://expo.dev/signup). Run these from this folder:

```bash
npm install
npx eas-cli@latest login
npx eas-cli@latest init          # links the project to your Expo account (first time only)

# iPhone: builds in the cloud and uploads to TestFlight (no Mac needed)
npx eas-cli@latest build --platform ios --profile production --auto-submit

# Android: builds an APK you can install directly
npx eas-cli@latest build --platform android --profile preview
```

The first iOS build asks you to sign in with your Apple Developer account so EAS can create the certificates.

### Test checklist

1. Open the app and tap **Start run**. Allow location, and choose **Always** (iPhone) or **Allow all the time** (Android).
2. Start walking or running, then switch to Spotify, or lock the phone, for a few minutes.
3. Come back to StridePause. A green card should say how many GPS points were recorded while the app was hidden.
4. Tap **Stop & save run**. The run appears under Saved runs.

If the card is red (0 points), check the location permission. On Android, also set battery usage for StridePause to **Unrestricted** (Settings → Apps → StridePause → Battery).

## Project layout

```
index.ts                     registers the background task, then the app
App.tsx                      test screen
src/tracking/locationTask.ts background GPS task
src/tracking/controller.ts   permissions, start, stop
src/tracking/runStore.ts     saves the active run and run history on the phone
src/tracking/geo.ts          distance, pace and time formatting
```
