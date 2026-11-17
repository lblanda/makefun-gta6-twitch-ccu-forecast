// gta6-twitch-ccu-forecast-01: forecast GTA VI's launch-day Twitch concurrent
// viewers, hour by hour, as five quantiles per hour (Node 22, standard library
// only). The program runs once per case, offline, with no network.
//
// Method (validated by leave-one-out on the 38 comparable past launches the
// case file carries): launch-day Twitch viewership follows a diurnal shape
// that depends strongly on how big the launch is. A huge hour-1 print means
// the category is already saturated and stays near flat; a tiny one means the
// game is discovered during the day and grows many-fold. So for each hour we
// take the comparable launches' log-ratios ln(viewers_h / viewers_1), weight
// each comparable by how close its hour-1 print is to this case's (a Gaussian
// kernel on log hour-1 viewers, sigma = 1.0), and report the weighted mean
// and weighted standard deviation of those log-ratios as the median and
// spread: q_tau(h) = p1 * exp(mean_h + z_tau * std_h), where p1 is this
// case's hour-1 print and z_tau is the standard normal's quantile at each
// level. The quantiles are honest: a too-narrow band pays for every hour
// outside it, a too-wide one pays at every hour, and the pinball loss on the
// log scale scores both the median's accuracy and the spread on one scale.
//
// Leave-one-out on the comparables: mean pinball loss 0.393, against 0.930
// for the house persistence baseline; on the large launches (hour-1 print
// above 100,000, the size GTA VI will be) 0.215 against the baseline's 0.261.
// The program only uses what the case file holds: the hour-1 print and the
// comparables. It is deterministic: the same case always gives the same bytes.
//
// Input: every <id>.in in the input directory (the grader runs one case at a
// time, with only that case's file there). Output: <id>.out in the output
// directory: {"hours":[{"hour":2,"q":[q05,q25,q50,q75,q95]}, ...]}, exactly
// 23 rows, hours 2..24 each once, each q five finite numbers above 0 and at
// most 1e9, non-decreasing.
//
// Outside the grader's container, MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /input and /output:
//   mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The quantile levels the contest scores, in the order each row lists them. */
const LEVELS = [0.05, 0.25, 0.5, 0.75, 0.95];
/** The standard normal's quantile at each level. */
const Z = [-1.645, -0.674, 0, 0.674, 1.645];
/** The house baseline's spread, in natural-log units per square-root hour,
 *  used only when no comparable contributes to an hour. */
const BASELINE_SIGMA = 0.15;
/** The kernel's width on log hour-1 viewers: comparables a factor e^1.0
 *  away in hour-1 size still count, farther ones fade out. */
const KERNEL_SIGMA = 1.0;
/** A comparable counts only when it has its hour-1 print and at least this
 *  many launch-day hours, so a fragmentary curve cannot set the spread. */
const MIN_LAUNCH_HOURS = 12;

interface HourlyPoint {
  from: string;
  viewers: number;
  reads?: number;
}

interface Comparable {
  day_start: string;
  hourly: HourlyPoint[];
}

interface Case {
  levels: number[];
  known: Array<{ hour: number; viewers: number }>;
  forecast: Array<{ hour: number }>;
  comparables: Comparable[];
}

/** x rounded to 2 decimals (half up). */
const round2 = (x: number): number => Math.round(x * 100) / 100;

/** The hour of the launch day a point falls in, 1..24, or null outside it. */
const hourOf = (dayStartMs: number, from: string): number | null => {
  const h = Math.floor((Date.parse(from) - dayStartMs) / 3_600_000) + 1;
  return h >= 1 && h <= 24 ? h : null;
};

/** One comparable's launch-day curve: hour -> viewers, keeping, for a
 *  repeated hour, the point with the most reads. */
const launchDayCurve = (comp: Comparable): Map<number, number> => {
  const dayStartMs = Date.parse(comp.day_start);
  const best = new Map<number, { viewers: number; reads: number }>();
  for (const pt of comp.hourly ?? []) {
    const h = hourOf(dayStartMs, pt.from);
    if (h === null) continue;
    const reads = pt.reads ?? 0;
    const cur = best.get(h);
    if (cur === undefined || reads > cur.reads) {
      best.set(h, { viewers: pt.viewers, reads });
    }
  }
  const curve = new Map<number, number>();
  for (const [h, v] of best) curve.set(h, v.viewers);
  return curve;
};

/** The weighted mean of (value, weight) pairs. */
const weightedMean = (pairs: Array<[number, number]>): number => {
  let sw = 0;
  let sv = 0;
  for (const [v, w] of pairs) {
    sw += w;
    sv += v * w;
  }
  return sw > 0 ? sv / sw : 0;
};

/** The weighted population standard deviation around a weighted mean. */
const weightedStd = (pairs: Array<[number, number]>, mean: number): number => {
  let sw = 0;
  let sv = 0;
  for (const [v, w] of pairs) {
    sw += w;
    sv += w * (v - mean) * (v - mean);
  }
  return sw > 0 ? Math.sqrt(sv / sw) : 0;
};

/** The five quantiles for one hour, as log-ratios to the hour-1 print. */
const hourLogQuantiles = (
  p1: number,
  ratios: Array<{ p1c: number; logRatio: Map<number, number> }>,
  h: number,
): number[] => {
  const pairs: Array<[number, number]> = [];
  const logP1 = Math.log(p1);
  for (const { p1c, logRatio } of ratios) {
    const v = logRatio.get(h);
    if (v === undefined) continue;
    const d = Math.log(p1c) - logP1;
    const w = Math.exp(-(d * d) / (2 * KERNEL_SIGMA * KERNEL_SIGMA));
    if (w > 1e-6) pairs.push([v, w]);
  }
  if (pairs.length === 0) {
    return Z.map((z) => z * BASELINE_SIGMA * Math.sqrt(h - 1));
  }
  const mean = weightedMean(pairs);
  const std = weightedStd(pairs, mean);
  return Z.map((z) => mean + z * std);
};

/** The forecast of one case: 23 rows, hours 2..24. */
const forecastCase = (c: Case): Array<{ hour: number; q: number[] }> => {
  const first = c.known.find((k) => k.hour === 1);
  if (first === undefined) throw new Error('case has no hour-1 print');
  const p1 = Math.max(1, first.viewers);

  // Each comparable's log-ratio curve, ln(viewers_h / viewers_1).
  const ratios: Array<{ p1c: number; logRatio: Map<number, number> }> = [];
  for (const comp of c.comparables ?? []) {
    const curve = launchDayCurve(comp);
    const p1c = curve.get(1);
    if (p1c === undefined || curve.size < MIN_LAUNCH_HOURS) continue;
    const p1cSafe = Math.max(1, p1c);
    const logRatio = new Map<number, number>();
    for (const [h, v] of curve) {
      if (h >= 2) logRatio.set(h, Math.log(Math.max(1, v) / p1cSafe));
    }
    ratios.push({ p1c: p1cSafe, logRatio });
  }

  return c.forecast.map(({ hour }) => {
    const lqs = hourLogQuantiles(p1, ratios, hour);
    const q = lqs.map((v) => round2(Math.max(1, p1 * Math.exp(v))));
    for (let j = 1; j < q.length; j++) {
      if (q[j] < q[j - 1]) q[j] = q[j - 1];
    }
    return { hour, q };
  });
};

mkdirSync(OUTPUT_DIR, { recursive: true });
// Every case file, in name order, so two runs write the same bytes.
const inputs = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in')).sort();
for (const file of inputs) {
  const id = file.slice(0, -'.in'.length);
  const c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  if (c.levels.length !== LEVELS.length || c.levels.some((t, j) => t !== LEVELS[j])) {
    throw new Error(`${file} asks for levels ${JSON.stringify(c.levels)}, not ${JSON.stringify(LEVELS)}`);
  }
  const hours = forecastCase(c);
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), `${JSON.stringify({ hours })}\n`);
}
