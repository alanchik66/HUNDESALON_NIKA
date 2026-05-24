# Header Sun (NASA Eyes style)

Daytime header orb: **WebGL** via `assets/js/header-weather-sun-scene.js`, inspired by [NASA Eyes — Sun](https://eyes.nasa.gov/apps/solar-system/#/sun?embed=true).

- Transparent background, starfield, NASA SDO disk, Moon in orbit
- Camera from Earth (geo + date/time): annual ecliptic orbit + daily rotation

```bash
npm run sun:fetch-nasa
```

Produces `nasa_sun_disk.jpg` (texture) and optional `nasa_sun_loop.mp4` (not used in header).
