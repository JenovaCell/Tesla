# Tesla Screen Sim

A touchscreen simulator of the Tesla in-car UI (v14-style layout), built for a Windows 11 touch PC
(e.g. Surface Studio). It is an independent, unofficial look-alike: all icons and artwork are original,
and no Tesla software or assets are used.

## Run it (Windows 11)

1. Install **Node.js LTS** (https://nodejs.org) and **Git**.
2. In this folder:

   ```powershell
   npm install
   npm start
   ```

3. Press **F11** (or tap the fullscreen icon in the status bar) for fullscreen. **Esc** leaves fullscreen.

To build a double-clickable app: `npm run dist` (output in `dist\`).

> `npm install` pulls the **castLabs Electron** build (a normal Electron with the Widevine DRM module).
> That is what lets Netflix / Disney+ / Prime etc. play inside the app. Plain Electron cannot play DRM video.

## What's in it

| Area | What works |
|---|---|
| Vehicles | Model 3, Model Y, Model S, Model X, Cybertruck: own screen size/aspect, car art, paint colours, wheels. Edit `src/js/models.js` to add more. |
| Display | Auto / Light / Dark theme, brightness, 12/24h, mi/km, °F/°C, fill-window vs true aspect ratio, screen-clean mode. |
| Touch | Everything is pointer-event based: multi-touch sketchpad, swipe games, pinch/drag map, big sliders, on-screen keyboard. |
| Theater | Netflix, Disney+, YouTube, Hulu, Max, Prime Video, Apple TV+, Paramount+, Peacock, Twitch, Tubi, Plex, Crunchyroll, Vimeo in an embedded browser. **Park only**, like the car. Logins persist. |
| Media | Streaming music sites (Spotify, YouTube Music, Apple Music, ...) keep playing in the background; local audio files; mini-player; volume. |
| Navigation | OpenStreetMap map, address search (Nominatim), routing (OSRM), and a drive simulator that moves the car along the route. Needs internet. |
| Drive | P/R/N/D, set-speed slider + brake, speed, battery drain, range, road animation. Reverse shows the rear camera (uses the PC webcam). |
| Climate | Dual-zone temps, fan, A/C, recirculate, defrost, seat/wheel heat, Dog / Camp / Keep-climate-on, cabin temperature that really drifts to the setpoint. |
| Controls | Quick controls (frunk, trunk, locks, charge port, lights, doors, honk...), Pedals & Steering, Charging (simulated), Autopilot, Locks, Lights, Display, Trips, Navigation, Safety, Service, Software, Wi-Fi/Bluetooth, Simulator. |
| Apps | Phone (dialer, simulated calls), Calendar (saved locally), Energy graph, Camera viewer, Web browser, Toybox (Snake, 2048, Sketchpad, Boombox, Romance fireplace, Light Show). |

## Honest limits

* It simulates the car; nothing talks to a real vehicle. Phone calls, Bluetooth, Wi-Fi, Autopilot/FSD, Sentry,
  Summon and charging are simulated UI states.
* Streaming quality depends on Widevine in the castLabs build. Netflix and some others check for
  VMP-signed builds and may cap resolution or refuse playback; Disney+, YouTube, Prime etc. usually work at HD.
  castLabs provides a free signing service (EVS) if you need full-HD/4K from a packaged build.
* Tesla's Model S / X production wind-down was announced; they are kept in the list for completeness.
* Spec numbers (range, 0-60, screen size) are approximate.

## Keys

* `F11` fullscreen · `Esc` exit fullscreen (when no app is open)
* Snake / 2048 also respond to arrow keys.

## Project layout

```
main.js            Electron main process (window, fullscreen, Widevine, permissions)
preload.js         safe bridge to the renderer (fullscreen/quit)
src/index.html     shell
src/css/app.css    light & dark themes + all styling
src/js/app.js      layout, dock, gears, scaling, boot
src/js/models.js   vehicle catalogue
src/js/state.js    persistent store + vehicle simulation
src/js/car.js      vector car renderer
src/js/nav.js      map, search, routing, drive-along
src/js/controls.js settings panels
src/js/webshell.js embedded browser (Theater / Media / Web)
src/js/apps/*      Theater, Media, Toybox, Phone, Calendar, Energy, Camera
```
