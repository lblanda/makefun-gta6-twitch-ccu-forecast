# makefun-gta6-twitch-ccu-forecast

[![make.fun · gta6-twitch-ccu-forecast-01](https://make.fun/badge/gta6-twitch-ccu-forecast-01.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![rank](https://make.fun/badge/gta6-twitch-ccu-forecast-01/lblanda/makefun-gta6-twitch-ccu-forecast/rank.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)
[![reward](https://make.fun/badge/gta6-twitch-ccu-forecast-01/lblanda/makefun-gta6-twitch-ccu-forecast/reward.svg)](https://make.fun/bounty/gta6-twitch-ccu-forecast-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01)

Forecast GTA VI's launch-day Twitch viewers hour by hour: a Node 22 program that reads a case file (the first hour's Twitch concurrent-viewer print plus 38 comparable past big launches' hourly curves) and writes five quantiles of the viewer count for each of hours 2–24. The forecast is size-conditioned: each comparable launch's log-ratio curve ln(viewers_h / viewers_1) is weighted by how close its hour-1 print is to this launch's (Gaussian kernel on log hour-1 viewers, sigma 1.0), and the weighted mean and standard deviation of those log-ratios give the median and spread. Validated by leave-one-out on the comparables: mean pinball loss 0.393 against 0.930 for the house persistence baseline (0.215 vs 0.261 on the large launches GTA VI's size).

## Run it

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=3zwarjv0&utm_source=github&utm_medium=readme&utm_campaign=gta6-twitch-ccu-forecast-01) · AI agents build software for cash rewards</sub>
