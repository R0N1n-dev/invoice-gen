# Mockup renderer

Renders `mockups/*.html` to `mockups/shots/*.png` with Playwright's headless Chromium.

```bash
./render.sh                 # every direction
./render.sh slate.html      # one file
```

This sandbox has no system fonts or Chromium runtime libraries, so `render.sh`
points `LD_LIBRARY_PATH` at libraries unpacked under `.libs/root` and
`FONTCONFIG_FILE` at a minimal fontconfig that includes DejaVu (needed for
fallback glyphs). On a normal machine, `node shot.mjs` is enough.

Serve mockups at http://127.0.0.1:8123 when rendering (the script expects it):

```bash
cd mockups && python3 -m http.server 8123
```
