# Development Notes

A short history of this project: the constraint that shaped it, the approaches that were tried,
and what worked versus what didn't. For the technical option survey and risk assessment, see
[RESEARCH.md](RESEARCH.md).

## What it is

Run **Microsoft Encarta 95** in the browser via [v86](https://github.com/copy/v86), served as a
static site. A pre-booted Windows 95 snapshot resumes straight into Encarta; the Windows 95 hard
disk and the Encarta CD are streamed on demand.

## The one requirement that drove everything: a small initial download

The project was framed from the start around a single hard constraint:

> serve Encarta 95 as a static page where we serve **chunks of the filesystem as needed
> (small initial download before rendering and interaction)**.

The full Windows 95 install plus the ~600 MB Encarta CD cannot be delivered in one burst, and
neither can a pre-saved emulator state that bakes the whole disk into it — an early approach
produced a single ~700 MB "initial state" file, which is just as bad as downloading the disk
itself. So the state had to be split:

- a **small, RAM-only snapshot** (tens of MB) to resume instantly, and
- **chunked disk images** paged in only as the guest actually reads them.

Almost every meaningful design decision — and most of the stalled efforts — were attempts to
satisfy this constraint. It is the thread that ties the whole project together.

## Approaches considered

| Approach | Outcome |
|---|---|
| **v86** full x86 emulation, mount the CD, run Encarta | **Chosen** — the only realistic fully-static option |
| Pre-booted RAM snapshot (resume straight into Encarta) | **Chosen** — combined with the above |
| Extract the ISO and rebuild Encarta as a web app | Rejected — custom binary formats, large unknown effort, licensing risk |
| Compile Wine to WebAssembly | Rejected — not production-ready |
| Server-side VM streamed to the browser (noVNC/WebRTC) | Rejected — not a static site |

## How the goal is met today

- **Small RAM-only snapshot** (~64 MB) — restores into a running Encarta, no cold boot.
- **256 KB paged disk parts** for both the hard disk and the CD; only the chunks the guest reads
  are fetched.
- **Synchronous paged I/O** (`synchronous: true`, via the patched v86 build) — required because
  Windows 95's `ESDI_506` driver aborts asynchronous CD reads, which was the cause of crashes on
  CD-backed features.
- **Build-time splitting**, with the Encarta ISO **user-supplied and git-ignored** — keeps the
  repository small.
- *Planned:* lazily cache chunks (IndexedDB / service worker) for repeat visits.

## Milestones

- Options survey and risk assessment (`RESEARCH.md`).
- First prototype: boot Windows 95 in v86 and mount the Encarta CD.
- Pre-booted snapshot → resume directly into a running Encarta.
- Serve the disk as paged parts (the mechanism that keeps the initial download small).
- Fix the CD crash by switching to synchronous paged I/O.
- Repo restructure (`public/` web root, `build` / `run` scripts).
- Kiosk polish (taskbar mask, pointer capture).
- Touch support (host-side cursor tracking; tap-to-point).
- Repo hygiene: history rewrite (~2.6 GB → ~216 MB) to drop an obsolete, large legacy tree.
- Article deep links: `#/article/<title>`, with a resident 16-bit helper using
  `ENCARAPI.FGETCURTOPICTITLE` and a caption→title map generated from `ENCARTA.M12`.

## What worked

- **v86 + a pre-booted snapshot** → a live, interactive Encarta with no cold boot.
- **Paged (256 KB) disk streaming** for both the hard disk and the CD.
- **Synchronous paged I/O** → resolved the CD/`ESDI_506` crash.
- **Build tooling + repo layout** that keeps the ISO and its parts out of git.
- **Kiosk polish** — taskbar mask and pointer capture.
- **Touch** — a host-side model of the guest cursor makes a tap move the pointer straight to the
  tapped point (~15–20 ms) instead of a visible corner detour.
- **Article deep links** — a resident 16-bit helper calls `ENCARAPI.FGETCURTOPICTITLE` and streams
  the exact current title, so articles without media captions (`Anorexia Nervosa`, `Piracy`) work
  too; the `ENCARTA.M12` map keeps older caption URLs working.
- **Multimedia** — Chrome starts the page with its `AudioContext` suspended and v86 creates its
  context after the emulator has already started, so nothing resumed it; in-guest video/audio was
  silent. The page now resumes it on the first pointer/key/touch gesture.

## Dead ends and lessons learned

### Driven by the small-download constraint

- **A single ~700 MB "initial state" file.** Rejected — it is effectively a full-disk download up
  front. This is precisely what motivated splitting the snapshot from the disks.
- **Booting from an exported, chunked hard disk did not match the monolithic state.** Exporting the
  hard disk and serving it as parts did not boot identically to the single initial-state file, which
  stalled the "use parts" effort; the disk export → split → validate pipeline was left unfinished.
- **"Download Disk" tooling** had repeated problems — the same underlying tension of getting the disk
  out in a form that can be served in small pieces.

### Emulation and input

- **In-guest absolute mouse (VBADOS `VBMOUSE`).** Dead end: the DOS driver loads fine, but
  `VBMOUSE.DRV` crashes the Windows 95 boot (VBADOS targets Windows 3.x). There is no available
  absolute-mouse driver for Windows 95, so touch falls back to the relative PS/2 mouse.
- **Unpaced relative-mouse movement drops packets.** v86's PS/2 controller consumes only one mouse
  packet per browser event-loop turn, so bursts are silently dropped; movement has to be paced one
  packet at a time.
- **"Relative mouse needs pointer lock" was wrong.** Relative PS/2 input reaches the guest without it.

## AI assistance

The project was built with heavy AI assistance across several models over its life:
OpenAI `gpt-5.2-chat` (research and early prototyping), `gpt-5.3-codex` (implementation), and
`deepseek-v4.1-flash` (the long engineering sessions covering the snapshot, paged I/O, kiosk and
touch work).

## Open work

- Finish the disk export → split → validate pipeline.
- Chunk caching for repeat visits (IndexedDB / service worker).
- Simplify the legacy caption map now that the resident helper provides the canonical title.
