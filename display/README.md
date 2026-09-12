# Escaparate Atomtech — pantalla de puerta

Presentación en bucle para la pantalla de la entrada del despacho. Formato
**vertical 1080×1920**, es decir, una pantalla 16:9 girada a retrato. Se
reproduce sola, sin interacción y sin conexión a internet.

```
display/
├── index.html          la presentación (autocontenida: se abre y funciona)
├── export-gif.mjs      exportador a GIF / MP4 fiel a lo que se ve en pantalla
├── package.json        dependencias solo del exportador
└── assets/
    ├── atomtech-blanco.svg
    ├── clients/        logos de clientes y prensa
    └── fonts/          Archivo y Chivo Mono
```

## Diseño

Todo sale de atomtech.es, no de una plantilla genérica:

- **Color.** El acento es `#FF4F2B`, el rojo que la propia web llama `flame`
  en su CSS. Lo acompañan el azul marino de marca (`#1B2A4A` / `#2A3F6B`) y un
  gris cálido desplazado hacia el rojo, en vez de un gris neutro de fábrica.
- **Tipografía.** **Archivo** para titulares y texto, **Chivo Mono** para
  etiquetas, unidades y datos técnicos. Son las dos familias que usa la web
  (`--font-grotesk` y `--font-chivo-mono`), y van empotradas en `assets/fonts`.
- **Header.** Aurora cónica en rojo y marino sangrando desde arriba, como el
  hero de la web, girando muy despacio para que nunca esté del todo quieta.
- **Tarjetas.** Ocupan el ancho completo y entran alternando lado —una por la
  izquierda, la siguiente por la derecha— con una luz roja que barre el canto
  por el que entran y se apaga al posarse. El tono rota entre tres: cristal
  oscuro, rojo y marino. Dentro de cada diapositiva todas miden lo mismo y el
  bloque ocupa siempre la misma franja, así el bucle no da saltos.
- **Fondo.** Retícula técnica fina y brasa lenta, no un cielo estrellado.
- **Logos de clientes.** En silueta blanca, exactamente el mismo tratamiento
  (`brightness-0 invert`) que el muro de logos de atomtech.es.

## Poner la pantalla en marcha

Abre `index.html` en cualquier navegador y ponlo a pantalla completa (`F11`).
No necesita servidor ni red: tipografías, logotipo y logos de clientes van
dentro de la carpeta.

El escenario mide 1080×1920 fijos y se escala solo al tamaño de la ventana
conservando la proporción, con bandas negras si la pantalla no es exactamente
9:16. Así se ve igual en un monitor Full HD girado, en un 4K o en una tele
más modesta.

### Arranque automático en un equipo dedicado

Gira la pantalla a retrato y arranca Chromium en modo quiosco:

```bash
# rota la salida de vídeo (ajusta el nombre de la salida con xrandr)
xrandr --output HDMI-1 --rotate left

chromium --kiosk --noerrordialogs --disable-infobars \
  --disable-session-crashed-bubble --incognito \
  file:///ruta/a/display/index.html
```

Conviene desactivar el salvapantallas y la suspensión:

```bash
xset s off && xset -dpms && xset s noblank
```

## El bucle

Dura **90,5 segundos** y encadena ocho diapositivas:

| # | Diapositiva | Duración | Contenido |
|---|---|---|---|
| 1 | Intro | 8,5 s | Logotipo y lema |
| 2 | Quiénes somos | 11 s | Posicionamiento y cifras de la empresa |
| 3 | Servicios | 13,5 s | Los 7 servicios, encabezados por desarrollo y Big Data |
| 4 | Productos | 12 s | RAG-PRO, LICITA-PRO, MAGEC, VULCAN, DRAGO |
| 5 | Clientes | 12 s | Los seis clientes, con su logo |
| 6 | Casos de éxito | 11 s | Las tres métricas de resultado |
| 7 | Medios | 11 s | Un artículo en La Voz de Lanzarote y dos entrevistas en BiosferaTV |
| 8 | Contacto | 11,5 s | Web, teléfono, correo y dirección |

Los datos de contacto no dependen del turno de la diapositiva 8: van siempre
visibles en la cinta inferior, que no para. Quien pase por delante en cualquier
momento ve cómo localizaros.

### Cambiar textos o tiempos

Los textos están en el HTML, dentro de la sección de cada diapositiva
(`<section class="slide" id="s-...">`). Las duraciones están juntas al
principio del `<script>`, en la constante `SLIDES`: cambia `dur` (en
milisegundos) y el exportador se adapta solo.

El tono y el lado de entrada de cada tarjeta **no se escriben a mano**. Cada
contenedor de tarjetas declara `data-tones="flame,glass,navy"` y
`data-seq` (milisegundos entre tarjeta y tarjeta), y el motor reparte tonos,
lados y retardos por índice. Para añadir un servicio basta con copiar un
bloque `<div class="card">`: entra por el lado y con el tono que le tocan.

## Exportar a GIF

```bash
npm install        # una sola vez
npm run export     # bucle completo a 720 px de ancho
```

El GIF sale **idéntico** a lo que se ve en pantalla. La presentación expone
`window.__display.renderAt(ms)`, así que el exportador no graba la pantalla en
tiempo real: pide cada fotograma en su instante exacto de la línea de tiempo.
No hay fotogramas perdidos, tirones ni desincronización, y dos exportaciones
seguidas dan el mismo resultado. El alto tampoco se supone: la página declara
el tamaño de su escenario y el exportador hereda esa proporción, así que el
encuadre vertical se mantiene a cualquier resolución.

Para que los degradados de marca no produzcan bandas al bajar a los 256
colores del GIF, se codifica en dos pasadas con ffmpeg: primero se calcula la
paleta óptima del bucle entero y después se aplica con difuminado ordenado.
`ffmpeg` viene instalado como dependencia, no hay que instalar nada aparte.

### Opciones

| Opción | Por defecto | Para qué |
|---|---|---|
| `--width <px>` | `720` | Ancho; el alto sale de la proporción real. `1080` para máxima resolución |
| `--fps <n>` | `12.5` | Usa 10, 12,5, 20 o 25: son divisores exactos de 100 y el GIF no deriva |
| `--slide <n>` | — | Exporta solo esa diapositiva (1–8) |
| `--start <s>` / `--duration <s>` | — | Exporta un tramo concreto del bucle |
| `--format <gif\|mp4>` | `gif` | MP4 pesa mucho menos con la misma calidad |
| `--out <fichero>` | `atomtech-display.gif` | Fichero de salida |

### Peso orientativo

Un GIF de 90 segundos es pesado por definición: guarda cada fotograma
completo. Medido: a 540 px de ancho y 12,5 fps pesa unos 41 MB.

- **Para la pantalla de la puerta**, usa el HTML directamente. Se ve mejor, va
  más fluido y no pesa nada.
- **Para redes o para enviarlo por correo**, exporta una sola diapositiva:
  `node export-gif.mjs --slide 5 --width 540` deja un GIF de unos 8 MB.
- **Si el reproductor admite vídeo**, `--format mp4` da la mejor calidad por
  megabyte con diferencia.

```bash
node export-gif.mjs --width 1080                 # GIF a máxima resolución
node export-gif.mjs --slide 6 --width 540        # solo los casos de éxito
node export-gif.mjs --format mp4 --width 1080    # vídeo vertical 1080×1920
```

## Menciones en prensa

Las tres menciones de la diapositiva 7 están verificadas en su enlace original,
listado en atomtech.es:

| Medio | Tipo | Fecha | Enlace |
|---|---|---|---|
| La Voz de Lanzarote | Prensa escrita | dic. 2025 | [Artículo](https://www.lavozdelanzarote.com/ekonomus/emprendedores/atomtech-start-up-lanzarote-asesora-pymes-islenas-sobre-piensan-sus-clientes_239967_102.html) |
| BiosferaTV | Entrevista | sept. 2025 | [El Magazine de Biosfera (30/09/25)](https://youtu.be/3exsNnQDxA4) |
| BiosferaTV | Entrevista sobre DRAGO | jul. 2026 | [El Magazine (15/07/2026)](https://youtu.be/I0sVUoAhAxc) |

## Logos de clientes

Los logos viven en `logos/clients/` del repositorio y se copian a
`display/assets/clients/` para que la página funcione sin red. Se han recortado
los márgenes transparentes y limitado a 400 px de alto. Pertenecen a sus
respectivos propietarios.
