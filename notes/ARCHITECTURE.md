# Architecture

How the pieces fit together. The short version: this is a **full PC emulated in WebAssembly**
running Windows 95 and Encarta 95, wrapped in a thin host UI that keeps the **initial download
small** by streaming the disks on demand.

## Key ideas

- **Two state machines.** The guest (Windows 95 + Encarta) is an opaque VM. The host is a small
  web page that can touch it only through a few narrow interfaces: **video** (framebuffer → canvas),
  **input** (synthesized PS/2 events), **disk** (serving bytes to the emulated IDE/CD controller),
  and **RAM** (snapshot save/restore).
- **Small initial download**, achieved by three separations: runtime vs data; a **RAM-only
  snapshot (~64 MB)** vs the **disks** (HD ~471 MB, CD ~675 MB); and disks **split into 256 KB
  parts fetched on demand**.
- **Synchronous paged I/O.** Reads are made synchronous (`synchronous: true`, via a patched v86
  build) because Windows 95's `ESDI_506` driver aborts asynchronous CD reads — this is what keeps
  CD-backed features stable.
- **Touch and keyboard are host-side layers** that synthesize PS/2 input; the guest is unaware.

## Layers of the system

Each layer is a container; arrows show the direction of control/data dependency, and the dashed
edge is the on-demand paging.

```mermaid
flowchart TB
  subgraph L1["Layer 1 — Static hosting (plain HTTP files)"]
    direction LR
    F1["public/index.html"]
    F2["public/runtime/ — libv86.js + v86.wasm"]
    F3["public/bios/ — seabios.bin + vgabios.bin"]
    F4["public/state/encarta95.bin.zst — zstd RAM snapshot (~9 MB)"]
    F5["public/disks/c-drive/ — 1800 × 256 KB .img"]
    F6["public/disks/encarta95/ — N × 256 KB .iso (generated)"]
  end

  subgraph L2["Layer 2 — Host app (public/index.html)"]
    direction LR
    A1["Viewport / canvas + taskbar mask"]
    A3["Touch layer — cursor model + tap-to-click"]
    A4["Keyboard bridge — OSK + kiosk key block"]
  end

  subgraph L3["Layer 3 — v86 runtime (WebAssembly, patched)"]
    direction LR
    R1["x86 CPU"]
    R2["IDE / CD controller — partfile buffers"]
    R3["PS/2 keyboard + mouse"]
    R4["VGA framebuffer"]
    R5["Snapshot save / restore"]
  end

  subgraph L4["Layer 4 — Guest (opaque)"]
    direction LR
    G1["Windows 95"] --> G2["Encarta 95"]
  end

  L1 -->|loads| L2
  L2 -->|drives| L3
  L3 -->|emulates| L4
  L3 -.->|range GET per 256 KB chunk| L1
```

## Article deep links

The host exposes hash routes (`#/article/<title>`) without changing the guest:

- `ENCTITLE.EXE` (baked into the Windows disk and autostarted from `win.ini`; source in
  `spike/enctitle16.c`) calls Encarta's `ENCARAPI.FGETCURTOPICTITLE` through a 16-bit helper and
  streams `T<title>` lines over COM1. This also covers articles with no media caption (for
  example `Anorexia Nervosa` and `Piracy`).
- `public/title-map.js` is generated from `ENCYC95/ENCARTA.M12`. It maps media captions to
  canonical Pinpointer/article titles and includes a canonical-title set used to avoid
  remapping searchable titles.
- URL-driven navigation pins the requested title until the caption changes. Ambiguous captions
  (the same caption reused by multiple articles) fall back to the caption when browsing manually.

## Dependency graph

What depends on what, split into build time and runtime.

```mermaid
flowchart LR
  ISO["input/encarta-95.iso (user-supplied)"]
  NV["node_modules/v86/build"]
  CD["public/disks/encarta95/*.iso"]

  subgraph BUILD["Build time — npm run build"]
    B["scripts/build.mjs"]
    SY["scripts/sync-v86.mjs"]
    SP["scripts/split-parts.mjs"]
    P["vendor/v86-sync-xhr.patch"]
    ISO --> B
    B --> SY
    B --> SP
    SY -->|copies| NV
    P -.->|overlaid as libv86.sync.js| NV
    SP -->|splits| CD
  end

  subgraph RUNTIME["Runtime — browser"]
    HTML["public/index.html"]
    LIB["public/runtime/libv86.js"]
    WASM["public/runtime/v86.wasm"]
    SNAP["public/state/encarta95.bin.zst"]
    HD["public/disks/c-drive/*.img"]
    BIOS["public/bios/*.bin"]
    G["Guest: devices + RAM"]
    HTML --> LIB --> WASM
    HTML --> SNAP
    LIB --> HD
    LIB --> CD
    LIB --> BIOS
    HTML -.->|bus.send / keyboard| G
  end

  NV --> LIB
```
