// Running statistics, parsed from the markdown tables in the running results posts.
// Race table:   | Date | Location | Distance | Title | Time | Pace |
// Yearly table: | Year | Hours | Km | Runs |
// Draft posts are skipped in production builds and shown under `eleventy --serve`/`--watch`.
const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "..", "posts");
const includeDrafts = process.env.ELEVENTY_RUN_MODE !== "build";

function frontMatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  return m ? m[1] : "";
}

function tableRows(body, firstHeader) {
  const lines = body.split("\n");
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (!t.startsWith("|")) {
      inTable = false;
      continue;
    }
    const cells = t.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    if (cells[0].toLowerCase() === firstHeader) {
      inTable = true;
      continue;
    }
    if (inTable && !/^[-:\s]+$/.test(cells[0])) rows.push(cells);
  }
  return rows;
}

const toSeconds = (s) => {
  const h = /(\d+)h/.exec(s), m = /(\d+)m/.exec(s), sec = /(\d+)s/.exec(s);
  return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0) + (sec ? +sec[1] : 0);
};

const fmtTime = (sec) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
};

const fmtPace = (secPerKm) => {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

const num = (s) => parseFloat(String(s).replace(/,/g, ""));

function raceType(km) {
  if (km >= 42) return "Marathon";
  if (km >= 20 && km <= 22) return "Half marathon";
  return "Other";
}

module.exports = function () {
  const races = [];
  const yearly = {};

  for (const file of fs.readdirSync(POSTS_DIR).filter((f) => /running/i.test(f) && f.endsWith(".md"))) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf8");
    const fm = frontMatter(raw);
    if (/^draft:\s*true/m.test(fm) && !includeDrafts) continue;
    const body = raw.slice(raw.indexOf("---", 3) + 3);

    for (const [date, location, distance, title, time, pace] of tableRows(body, "date")) {
      const dm = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(date);
      const km = num(distance);
      const seconds = toSeconds(time);
      if (!dm || !km || !seconds) continue;
      // Use the listed pace when well formed (m:ss), otherwise derive it from time and distance.
      const pm = /^(\d+):(\d{2})\b/.exec(pace || "");
      const paceSec = pm ? +pm[1] * 60 + +pm[2] : seconds / km;
      races.push({
        year: +dm[3],
        iso: `${dm[3]}-${dm[2]}-${dm[1]}`,
        date,
        location,
        km,
        title,
        type: raceType(km),
        seconds,
        time: fmtTime(seconds),
        pace: fmtPace(paceSec),
      });
    }

    for (const [year, hours, km, runs] of tableRows(body, "year")) {
      if (!/^\d{4}$/.test(year) || isNaN(num(hours)) || isNaN(num(km)) || isNaN(num(runs))) continue;
      yearly[year] = { year: +year, hours: num(hours), km: num(km), runs: num(runs) };
    }
  }

  races.sort((a, b) => a.iso.localeCompare(b.iso));

  const years = new Set([...Object.keys(yearly).map(Number), ...races.map((r) => r.year)]);
  const byYear = [...years].sort((a, b) => b - a).map((year) => {
    const y = yearly[year] || {};
    const yr = races.filter((r) => r.year === year);
    return {
      year,
      hours: y.hours ?? null,
      km: y.km ?? null,
      runs: y.runs ?? null,
      avgPace: y.hours && y.km ? fmtPace((y.hours * 3600) / y.km) : null,
      marathons: yr.filter((r) => r.type === "Marathon").length,
      halfMarathons: yr.filter((r) => r.type === "Half marathon").length,
      otherRaces: yr.filter((r) => r.type === "Other").length,
    };
  });

  // Mark the fastest result per distance class as a personal best.
  for (const type of ["Marathon", "Half marathon"]) {
    const best = races.filter((r) => r.type === type).sort((a, b) => a.seconds - b.seconds)[0];
    if (best) best.pb = true;
  }

  const withKm = byYear.filter((y) => y.km);
  return {
    byYear,
    races: races.filter((r) => r.type !== "Other").reverse(),
    otherRaces: races.filter((r) => r.type === "Other").reverse(),
    pbs: {
      marathon: races.find((r) => r.type === "Marathon" && r.pb) || null,
      half: races.find((r) => r.type === "Half marathon" && r.pb) || null,
    },
    maxKm: Math.max(0, ...withKm.map((y) => y.km)),
    totals: {
      km: withKm.reduce((a, y) => a + y.km, 0),
      hours: withKm.reduce((a, y) => a + (y.hours || 0), 0),
      runs: withKm.reduce((a, y) => a + (y.runs || 0), 0),
      marathons: races.filter((r) => r.type === "Marathon").length,
      halfMarathons: races.filter((r) => r.type === "Half marathon").length,
    },
  };
};
