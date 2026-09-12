# Escaparate Atomtech — pantalla de puerta

Presentación en bucle, formato 16:9, pensada para la pantalla de la entrada del
despacho. Se reproduce sola, sin interacción y sin conexión a internet.

```
display/
├── index.html          la presentación (autocontenida: se abre y funciona)
├── export-gif.mjs      exportador a GIF / MP4 fiel a lo que se ve en pantalla
├── package.json        dependencias solo del exportador
└── assets/
    ├── atomtech-blanco.svg
    └── fonts/inter-var-latin.woff2
```

## Poner la pantalla en marcha

Abre `index.html` en cualquier navegador y ponlo a pantalla completa (`F11`).
No necesita servidor ni red: la tipografía y el logotipo van dentro de la carpeta.

El escenario mide 1920×1080 fijos y se escala solo al tamaño de la ventana
conservando el 16:9, con bandas negras si la pantalla no es exactamente 16:9. Así
se ve igual en un monitor Full HD, en un 4K o en una tele de 1366×768.

### Arranque automático en un equipo dedicado

Chromium en modo quiosco, arrancando en bucle al encender:

```bash
chromium --kiosk --noerrordialogs --disable-infobars \
  --disable-session-crashed-bubble --incognito \
  file:///ruta/a/display/index.html
```

Conviene desactivar el salvapantallas y la suspensión del equipo:

```bash
xset s off && xset -dpms && xset s noblank
```

## El bucle

Dura **81 segundos** y encadena ocho diapositivas:

| # | Diapositiva | Duración | Contenido |
|---|---|---|---|
| 1 | Intro | 9 s | Logotipo en órbita y lema |
| 2 | Quiénes somos | 10 s | Posicionamiento y cifras de la empresa |
| 3 | Servicios | 11,5 s | Los 7 servicios, con el diagnóstico destacado |
| 4 | Productos | 11 s | RAG-PRO, LICITA-PRO, MAGEC, VULCAN, DRAGO |
| 5 | Clientes | 9 s | Los seis clientes de referencia |
| 6 | Casos de éxito | 10,5 s | Las tres métricas de resultado |
| 7 | Medios | 8,5 s | La Voz de Lanzarote y BiosferaTV |
| 8 | Contacto | 11,5 s | Web, teléfono, correo y dirección |

Los datos de contacto no dependen del turno de la diapositiva 8: van siempre
visibles en la cinta inferior, que no para. Quien pase por delante en cualquier
momento ve cómo localizaros.

### Cambiar textos o tiempos

Los textos están en el HTML, en la sección de cada diapositiva (`<section
class="slide" id="s-...">`). Las duraciones están juntas al principio del
`<script>`, en la constante `SLIDES`: cambia `dur` (en milisegundos) y el
exportador se adapta solo.

Los colores salen de `brand.json` del repositorio y están declarados como
variables CSS en `:root`.

## Exportar a GIF

```bash
npm install        # una sola vez
npm run export     # bucle completo a 1280 px
```

El GIF sale **idéntico** a lo que se ve en pantalla. La presentación expone
`window.__display.renderAt(ms)`, así que el exportador no graba la pantalla en
tiempo real: pide cada fotograma en su instante exacto de la línea de tiempo. No
hay fotogramas perdidos, tirones ni desincronización, y dos exportaciones
seguidas dan el mismo resultado.

Para que los degradados de marca no produzcan bandas al bajar a los 256 colores
del GIF, se codifica en dos pasadas con ffmpeg: primero se calcula la paleta
óptima del bucle entero y después se aplica con difuminado. `ffmpeg` viene
instalado como dependencia, no hay que instalar nada aparte.

### Opciones

| Opción | Por defecto | Para qué |
|---|---|---|
| `--width <px>` | `1280` | Ancho; el alto sale del 16:9. `1920` para máxima resolución |
| `--fps <n>` | `12.5` | Usa 10, 12,5, 20 o 25: son divisores exactos de 100 y el GIF no deriva |
| `--slide <n>` | — | Exporta solo esa diapositiva (1–8) |
| `--start <s>` / `--duration <s>` | — | Exporta un tramo concreto del bucle |
| `--format <gif\|mp4>` | `gif` | MP4 pesa mucho menos con la misma calidad |
| `--out <fichero>` | `atomtech-display.gif` | Fichero de salida |

### Peso orientativo

Un GIF de 81 segundos es pesado por definición: guarda cada fotograma completo.
A 960 px y 12,5 fps ronda los 38 MB.

- **Para la pantalla de la puerta**, usa el HTML directamente. Se ve mejor, va
  más fluido y no pesa nada.
- **Para redes o para enviarlo por correo**, exporta una sola diapositiva:
  `node export-gif.mjs --slide 1 --width 960` deja un GIF de unos 4 MB.
- **Si el reproductor admite vídeo**, `--format mp4` da la mejor calidad por
  megabyte con diferencia.

```bash
node export-gif.mjs --width 1920                 # GIF a máxima resolución
node export-gif.mjs --slide 6 --width 960        # solo los casos de éxito
node export-gif.mjs --format mp4 --width 1920    # vídeo Full HD
```
