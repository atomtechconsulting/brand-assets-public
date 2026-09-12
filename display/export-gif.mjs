#!/usr/bin/env node
/**
 * Exporta display/index.html a GIF (o MP4) conservando calidad y proporción.
 *
 * Cómo conserva la calidad
 * ------------------------
 * · La página expone `window.__display.renderAt(ms)`, así que cada fotograma se
 *   renderiza en TIEMPO VIRTUAL exacto. No se graba la pantalla en tiempo real:
 *   no hay fotogramas perdidos ni tirones, y el resultado es reproducible.
 * · La página también declara el tamaño de su escenario (1080×1920, vertical).
 *   El alto de salida sale de ahí, nunca de una proporción supuesta, así que
 *   el encuadre se mantiene intacto a cualquier --width.
 * · Para GIF (limitado a 256 colores) se codifica en dos pasadas con ffmpeg:
 *   primero se calcula una paleta óptima del bucle (palettegen) y después se
 *   aplica con difuminado ordenado (paletteuse). Así los degradados de marca
 *   no producen bandas. Si no hay ffmpeg, se usa un codificador en JavaScript
 *   puro como respaldo.
 *
 * Uso
 * ---
 *   npm install
 *   npm run export                       # bucle completo a 720 px de ancho
 *   node export-gif.mjs --width 1080     # máxima resolución
 *   node export-gif.mjs --slide 3        # solo la diapositiva 3
 *   node export-gif.mjs --format mp4     # vídeo (mucho más ligero)
 *
 * Opciones
 * --------
 *   --out <fichero>   Salida. Por defecto atomtech-display.gif / .mp4
 *   --width <px>      Ancho en píxeles; el alto sale de la proporción real
 *                     del escenario. Por defecto 720 (→ 1280 de alto).
 *   --fps <n>         Fotogramas por segundo. Por defecto 12.5.
 *                     En GIF los retardos van en centésimas de segundo, así que
 *                     conviene usar 10, 12.5, 20 o 25 para que el bucle no derive.
 *   --slide <n>       Exporta solo esa diapositiva (1–8) en vez del bucle entero.
 *   --start <s>       Segundo inicial dentro del bucle. Por defecto 0.
 *   --duration <s>    Duración en segundos. Por defecto, hasta el final del bucle.
 *   --format <f>      gif (por defecto) o mp4.
 */
import { chromium } from "playwright-core";
import { spawn, execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/* ————— Argumentos ————— */
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith("--")) args[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
}

const FORMAT = (args.format ?? "gif").toLowerCase();
if (!["gif", "mp4"].includes(FORMAT)) fail(`--format debe ser gif o mp4, no "${FORMAT}"`);

// Ancho par: los códecs de vídeo exigen dimensiones pares.
// El alto no se asume: sale de la proporción real del escenario (vertical o apaisado).
const WIDTH = Math.round(+(args.width ?? 720) / 2) * 2;
const FPS = +(args.fps ?? 12.5);
const OUT = args.out ?? `atomtech-display.${FORMAT}`;

if (!Number.isFinite(WIDTH) || WIDTH < 160) fail("--width debe ser un número >= 160");
if (!Number.isFinite(FPS) || FPS <= 0) fail("--fps debe ser un número positivo");
if (FORMAT === "gif" && Math.abs(100 / FPS - Math.round(100 / FPS)) > 1e-6) {
  console.warn(
    `Aviso: el GIF guarda los retardos en centésimas de segundo y ${FPS} fps no es divisor exacto de 100.\n` +
    `       El bucle se reproducirá algo más rápido o más lento. Usa 10, 12.5, 20 o 25 para que cuadre.`
  );
}

function fail(msg) { console.error(`Error: ${msg}`); process.exit(1); }

/* ————— Localizar binarios ————— */
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  if (existsSync("/opt/pw-browsers/chromium")) return "/opt/pw-browsers/chromium";
  try { return chromium.executablePath(); } catch { /* sigue */ }
  fail("no encuentro Chromium. Ejecuta `npx playwright-core install chromium` o define CHROMIUM_PATH.");
}

/**
 * Devuelve un ffmpeg que sepa hacer lo que necesitamos. No vale cualquiera:
 * la compilación recortada que Playwright trae para grabar vídeo no incluye
 * ni el códec PNG ni el filtro palettegen, así que se comprueba antes de usarla.
 */
function findFfmpeg() {
  const candidates = [];
  if (process.env.FFMPEG_PATH) candidates.push(process.env.FFMPEG_PATH);
  try { candidates.push(require("ffmpeg-static")); } catch { /* opcional */ }
  try {
    const sys = execSync(process.platform === "win32" ? "where ffmpeg" : "command -v ffmpeg", {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).split("\n")[0].trim();
    if (sys) candidates.push(sys);
  } catch { /* no hay ffmpeg en el PATH */ }

  for (const bin of candidates) {
    if (!bin || !existsSync(bin)) continue;
    try {
      const filters = execSync(`"${bin}" -hide_banner -filters`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const muxers = execSync(`"${bin}" -hide_banner -muxers`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const decoders = execSync(`"${bin}" -hide_banner -decoders`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      if (filters.includes("palettegen") && muxers.includes(" gif") && /\bpng\b/.test(decoders)) return bin;
    } catch { /* prueba el siguiente */ }
  }
  return null;
}

const here = dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(join(here, "index.html")).href;
const ffmpeg = findFfmpeg();

if (FORMAT === "mp4" && !ffmpeg) fail("exportar a MP4 requiere ffmpeg. Instálalo o usa --format gif.");

/* ————— Abrir la página y leer la línea de tiempo ————— */
const browser = await chromium.launch({ executablePath: findChromium() });
const page = await browser.newPage({ viewport: { width: WIDTH, height: WIDTH }, deviceScaleFactor: 1 });
await page.goto(pageUrl);
await page.evaluate(() => document.fonts.ready);
await page.waitForFunction(() => window.__display, null, { timeout: 15000 });

const info = await page.evaluate(() => window.__display);

// La página declara el tamaño de su escenario: el vídeo hereda esa proporción exacta.
const HEIGHT = Math.round((WIDTH * info.h) / info.w / 2) * 2;
await page.setViewportSize({ width: WIDTH, height: HEIGHT });

let startMs = +(args.start ?? 0) * 1000;
let durMs = args.duration ? +args.duration * 1000 : info.total - startMs;
if (args.slide) {
  const s = info.slides[+args.slide - 1];
  if (!s) fail(`--slide debe estar entre 1 y ${info.slides.length}`);
  startMs = s.start;
  durMs = s.dur;
}

const frameCount = Math.max(1, Math.round((durMs / 1000) * FPS));
const stepMs = durMs / frameCount;

console.log(
  `${FORMAT.toUpperCase()} · ${WIDTH}×${HEIGHT} · ${FPS} fps · ` +
  `${(durMs / 1000).toFixed(1)} s · ${frameCount} fotogramas → ${OUT}`
);
console.log(ffmpeg ? `Codificando con ffmpeg (${ffmpeg})` : "Codificando con gifenc (sin ffmpeg: calidad algo menor)");

/** Renderiza el fotograma i y devuelve su PNG. */
async function frame(i) {
  await page.evaluate(ms => window.__display.renderAt(ms), startMs + i * stepMs);
  return page.screenshot({ type: "png" });
}

function progress(done, total, label) {
  const pct = Math.round((done / total) * 100);
  process.stdout.write(`\r  ${label} ${String(pct).padStart(3)} %`);
}

/** Envía fotogramas PNG a ffmpeg por stdin y espera a que termine. */
function runFfmpeg(ffArgs, produce) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, ffArgs, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", d => { stderr += d; if (stderr.length > 40000) stderr = stderr.slice(-20000); });
    proc.on("error", reject);
    proc.on("close", code => (code === 0 ? resolve() : reject(new Error(`ffmpeg salió con código ${code}\n${stderr}`))));
    produce(proc.stdin).then(() => proc.stdin.end(), err => { proc.kill(); reject(err); });
  });
}

/** Escribe respetando la contrapresión del stream. */
function write(stream, buf) {
  return stream.write(buf) ? Promise.resolve() : new Promise(r => stream.once("drain", r));
}

const IN_ARGS = ["-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS), "-i", "pipe:0"];

try {
  if (FORMAT === "mp4") {
    await runFfmpeg(
      ["-y", ...IN_ARGS, "-c:v", "libx264", "-preset", "slow", "-crf", "16",
       "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT],
      async stdin => {
        for (let i = 0; i < frameCount; i++) {
          await write(stdin, await frame(i));
          if (i % 10 === 0) progress(i, frameCount, "codificando");
        }
      }
    );
  } else if (ffmpeg) {
    // Pasada 1 — paleta óptima a partir de una muestra del bucle.
    // Muestrear en vez de usar todos los fotogramas ahorra la mitad del tiempo
    // sin cambiar la paleta de forma apreciable: el fondo varía muy despacio.
    const sampleStep = Math.max(1, Math.floor(frameCount / 120));
    const tmp = mkdtempSync(join(tmpdir(), "atomtech-gif-"));
    const palette = join(tmp, "palette.png");
    try {
      await runFfmpeg(
        ["-y", "-f", "image2pipe", "-c:v", "png", "-framerate", String(FPS), "-i", "pipe:0",
         "-vf", "palettegen=max_colors=256:stats_mode=full", palette],
        async stdin => {
          let done = 0;
          for (let i = 0; i < frameCount; i += sampleStep) {
            await write(stdin, await frame(i));
            progress(++done, Math.ceil(frameCount / sampleStep), "paleta     ");
          }
        }
      );
      process.stdout.write("\r  paleta      100 %\n");

      // Pasada 2 — aplicar la paleta con difuminado y diferencia por rectángulos.
      // `diff_mode=rectangle` solo reescribe la zona que cambia entre fotogramas:
      // menos peso sin tocar la calidad de lo que se ve.
      await runFfmpeg(
        ["-y", ...IN_ARGS, "-i", palette,
         "-lavfi", "paletteuse=dither=bayer:bayer_scale=3:diff_mode=rectangle",
         "-loop", "0", OUT],
        async stdin => {
          for (let i = 0; i < frameCount; i++) {
            await write(stdin, await frame(i));
            if (i % 10 === 0) progress(i, frameCount, "codificando");
          }
        }
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  } else {
    // Respaldo sin ffmpeg: paleta por fotograma, sin difuminado.
    const [{ default: gifenc }, { PNG }] = await Promise.all([import("gifenc"), import("pngjs")]);
    const { GIFEncoder, quantize, applyPalette } = gifenc;
    const gif = GIFEncoder();
    const delay = Math.max(2, Math.round(100 / FPS)) * 10; // centésimas → ms
    for (let i = 0; i < frameCount; i++) {
      const png = PNG.sync.read(await frame(i));
      const palette = quantize(png.data, 256);
      gif.writeFrame(applyPalette(png.data, palette), WIDTH, HEIGHT, { palette, delay });
      if (i % 10 === 0) progress(i, frameCount, "codificando");
    }
    gif.finish();
    writeFileSync(OUT, gif.bytes());
  }

  process.stdout.write("\r  codificando 100 %\n");
  const mb = (statSync(OUT).size / 1024 / 1024).toFixed(1);
  console.log(`Listo: ${OUT} — ${mb} MB, ${(durMs / 1000).toFixed(1)} s, ${WIDTH}×${HEIGHT}`);
} finally {
  await browser.close();
}
