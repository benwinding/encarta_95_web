# Running `encarta-95.iso` In The Browser

## Goal

Serve `./encarta-95.iso` (a Windows 95 CD image) as a website that runs entirely in the browser, preferably deployable as a static site (e.g. GitHub Pages).

This document surveys viable technical approaches, tradeoffs, and feasibility under static hosting constraints.

---

# 1. Full Windows 95 Emulation In The Browser

## Option 1A: v86 (x86 Emulator in JavaScript/WebAssembly)

Project: https://github.com/copy/v86

### Overview

`v86` is a full x86 emulator written in JavaScript/WebAssembly. It can boot:

- MS-DOS
- Windows 3.x
- Windows 95
- Linux

It runs entirely client-side in the browser.

### How It Would Work

1. Serve `v86` JS/WASM files as static assets.
2. Serve a Windows 95 disk image.
3. Mount `encarta-95.iso` as a virtual CD-ROM.
4. Boot Windows 95 inside the emulator.
5. Launch Encarta from inside the VM.

Everything runs client-side. No server required.

### Static Hosting Compatibility

Fully compatible with GitHub Pages:

- Pure static files (HTML, JS, WASM, disk images).
- All compute happens in the user's browser.

Constraints:

- ISO likely hundreds of MB.
- GitHub Pages has a 1 GB repo limit.
- Individual file size should remain below 100 MB.

If ISO exceeds 100 MB:

- Host ISO externally (Cloudflare R2, S3, etc).
- Split image into chunks and reassemble client-side.
- Require user-supplied ISO.

### Pros

- Most authentic experience.
- Fully static deployment.
- No backend required.

### Cons

- Heavy CPU usage.
- Long boot times.
- Setup complexity.

### Feasibility: HIGH

This is the most realistic static-site approach.

---

# 2. Extract ISO And Rebuild As Web App

## Option 2A: Extract Files + Reimplement UI

Instead of emulating Windows, extract ISO contents and rebuild Encarta as a web app.

### Steps

1. Mount ISO locally.
2. Extract media (images, video, audio).
3. Identify and reverse-engineer data formats.
4. Build a static web UI that mimics Encarta.

### Challenges

Encarta likely uses:

- Custom binary formats.
- Windows executables.
- Legacy multimedia codecs.

This would require reverse engineering and custom parsing.

### Static Hosting Compatibility

Excellent (pure static site).

### Pros

- Fast loading.
- Mobile-friendly.
- No emulator overhead.

### Cons

- Very large engineering effort.
- Unknown data formats.
- Potential copyright issues.

### Feasibility: LOW–MEDIUM

Only realistic if formats are documented or simple.

---

# 3. Wine Compiled To WebAssembly

## Option 3A: Wine + WASM

Theoretical approach:

- Compile Wine to WebAssembly.
- Run Windows executables directly in browser.

In practice:

- Extremely complex.
- Not production-ready.
- Unrealistic for GitHub Pages.

### Feasibility: VERY LOW

---

# 4. Server-Side Emulation + Streaming

## Option 4A: Remote VM + WebRTC/VNC

Run Windows 95 on a server and stream to browser.

### How

- QEMU on server.
- noVNC or WebRTC frontend.

### Static Hosting Compatibility

Not compatible with GitHub Pages alone.
Requires backend infrastructure.

### Pros

- Reliable.
- Lower client CPU requirements.

### Cons

- Hosting cost.
- Not static.

### Feasibility: HIGH (but not static)

---

# 5. Hybrid: Pre-Booted Windows 95 Snapshot

With `v86`:

- Pre-install Windows 95.
- Install Encarta.
- Save VM state.
- Serve snapshot.

Users load directly into Encarta.

Improves UX significantly.

Static hosting compatible.

---

# 6. Performance Considerations

### Browser Limits

- WASM memory limits (~2–4 GB depending on browser).
- Large ISO downloads delay load.
- Mobile devices likely unusable.

### Optimization Techniques

- Lazy-load CD image.
- Compress disk images.
- Use IndexedDB caching.
- Add service worker for offline reuse.

---

# Recommendation

If the goal is:

"Encarta 95 running in the browser as a static GitHub Pages site"

The most viable approach is:

1. Use `v86`.
2. Create a pre-configured Windows 95 disk image.
3. Mount `encarta-95.iso`.
4. Deploy static emulator + disk images.

This aligns best with static hosting constraints.

---

# Open Questions

1. What is the size of `encarta-95.iso`?
2. Is full Windows emulation required?
3. Is mobile support important?

Answering these will narrow the optimal solution.

---

# 20 Potential Unknowns / Risks (v86 Approach)

1. Whether `encarta-95.iso` expects specific CD drive timing or hardware behavior not accurately emulated by v86.
2. Whether Encarta requires 16-bit components that behave inconsistently under Windows 95 in v86.
3. Compatibility of the specific Encarta 95 edition (US/UK/etc) with available Windows 95 images.
4. Whether the ISO uses copy protection checks that fail in an emulator.
5. Audio playback reliability (MCI, MIDI, CD audio tracks) inside v86.
6. Video codec compatibility for embedded multimedia content.
7. Performance of CD image streaming at ~600 MB over GitHub Pages bandwidth limits.
8. Browser memory limits when loading Windows image + 600 MB ISO simultaneously.
9. Whether GitHub Pages bandwidth throttling impacts large downloads.
10. Whether browsers block large WASM memory allocations required for Windows 95.
11. IndexedDB quota limits when caching disk images client-side.
12. Save-state reliability across browser refreshes or updates.
13. Startup time (booting Windows 95 may take 20–60+ seconds).
14. Mouse capture and pointer lock behavior differences across browsers.
15. Keyboard mapping issues (especially special keys inside Windows 95).
16. Whether v86 fully supports the Windows 95 disk image format we generate.
17. Stability of v86 under long browsing sessions (memory leaks, crashes).
18. Cross-browser compatibility (Chrome vs Firefox vs Safari).
19. Handling partial downloads or interrupted ISO fetches.
20. Long-term maintainability if v86 becomes unmaintained or browser APIs change.

---

# Findings From Research (2026)

Below are findings backed by verifiable sources. Any item not explicitly documented is marked as "Requires empirical testing".

1. CD-ROM / ISO Support
   v86 includes an IDE disk controller and a built-in ISO 9660 CD-ROM generator.
   Source: https://github.com/copy/v86 (README → Emulated hardware → "IDE disk controller" + "ISO 9660 CD-ROM generator")

2. Windows 95 Support
   Windows 95 is listed as working "reasonably well" in v86 compatibility documentation.
   Source: https://github.com/copy/v86 (Compatibility section)

3. Sound Support
   v86 emulates a SoundBlaster 16 sound card.
   Source: https://github.com/copy/v86 (Emulated hardware → "SoundBlaster 16 sound card")

4. Save / Restore State
   v86 provides official examples for saving and restoring emulator state.
   Source: https://github.com/copy/v86/blob/master/examples/save_restore.html

5. GitHub Pages Size Limits
   - Published site size limit: 1 GB
   - Soft bandwidth limit: 100 GB/month
   Source: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

6. Repository File Limits
   GitHub recommends repositories stay under 1 GB.
   Source: https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github

7. Browser Storage (IndexedDB / Cache API)
   Chrome / Chromium-based browsers allow up to ~60% of disk per origin.
   Firefox allows up to 10% (best-effort) or more with persistence.
   Source: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

8. WebAssembly Memory Model
   WebAssembly memory grows in 64KiB pages and is managed via WebAssembly.Memory.
   Source: https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory

9. ISO Loading Mechanism
   v86 loads disk images via XHR/fetch and requires serving from a web server.
   Source: https://github.com/copy/v86 ("ROM and disk images are loaded via XHR")

10. Cross-Browser WASM Support
    WebAssembly is broadly supported across Chrome, Firefox, and Safari.
    Source: https://developer.mozilla.org/en-US/docs/WebAssembly

11. IndexedDB Quota Enforcement
    QuotaExceededError is thrown when origin storage exceeds limits.
    Source: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

---

# Items Requiring Empirical Testing

Below are concrete testing procedures for each unknown.

---

1. CD Copy Protection Compatibility

Test Method:
1. Install Windows 95 in v86 following official guide:
   Source: https://github.com/copy/v86/blob/master/docs/windows-9x.md
2. Mount `encarta-95.iso` via v86 `cdrom: { url: "..." }` config.
3. Attempt clean installation from CD.
4. After install, eject ISO and relaunch program.
5. If program refuses to start without CD, reinsert ISO.
6. Observe whether it performs low-level checks (hang, crash, "original CD required").

Pass Criteria:
- Installer completes.
- Program launches without emulator crash.

---

2. Multimedia Codec Requirements (e.g., Indeo)

Test Method:
1. Launch Encarta.
2. Open multiple articles containing:
   - Video playback
   - Narration audio
   - Animations
3. If playback fails, check error messages.
4. Install legacy codecs inside Win95 if needed.
5. Re-test playback.

Measure:
- Whether video renders.
- CPU usage spike during playback.

---

3. Real Boot Time Measurement

Test Method:
1. Open Chrome stable.
2. Hard refresh page (Disable cache in DevTools).
3. Record time from "Start VM" to usable desktop.
4. Repeat 5 times.
5. Compute average.

Tools:
- Chrome DevTools Performance panel.

---

4. Memory Usage with 600MB ISO

Test Method:
1. Open Chrome Task Manager (Shift+Esc).
2. Load emulator + ISO.
3. Record:
   - JS heap size
   - Memory footprint
4. Observe peak memory after:
   - Boot
   - Encarta launch
   - Video playback

Compare against typical desktop memory limits.

---

5. Long-Session Stability (2–4 hour test)

Test Method:
1. Leave Encarta running.
2. Browse 50+ articles.
3. Play 10+ videos.
4. Monitor memory growth every 15 minutes.
5. Check for crashes or degraded performance.

---

6. Audio Fidelity (MIDI / CD Audio)

Test Method:
1. Verify SoundBlaster 16 driver installed.
   Source: https://github.com/copy/v86 (SoundBlaster 16 listed in hardware)
2. Play narration.
3. Play background music.
4. Check for:
   - Distortion
   - Lag
   - Missing audio channels

---

7. Pointer Lock & Keyboard Mapping

Test Method:
1. Test in Chrome, Firefox, Safari.
2. Verify:
   - Mouse capture inside VM.
   - Arrow keys.
   - Ctrl/Alt combinations.
   - Escape to exit pointer lock.

Log inconsistencies per browser.

---

8. ISO Streaming Performance (GitHub Pages)

Test Method:
1. Deploy ISO to test GitHub Pages repo.
2. Use Chrome DevTools Network tab.
3. Record:
   - Time to first byte (TTFB).
   - Total download time.
   - Throughput rate.
4. Throttle network (Fast 3G, Slow 4G).
5. Measure time-to-interactive.

Reference limits:
Source: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

---

9. Bandwidth Soft Limit Impact (100GB/month)

Calculation Test:
600MB per user.
100GB / 0.6GB ≈ 166 full loads per month.

Action:
- Estimate expected monthly users.
- Determine if external CDN required.

---

10. Save-State Reliability

Test Method:
1. Use official save/restore example.
   Source: https://github.com/copy/v86/blob/master/examples/save_restore.html
2. Save state after Encarta launches.
3. Reload browser.
4. Restore state.
5. Repeat across:
   - Chrome stable
   - Chrome beta
   - Firefox

Verify state integrity.

---

# Overall Risk Assessment

No single discovered blocker prevents running Encarta 95 under Windows 95 in v86 as a static GitHub Pages deployment.

Highest practical risks:

1. Copy protection incompatibility.
2. Multimedia codec requirements.
3. Large initial download time (~600MB).

All appear technically solvable or manageable.
