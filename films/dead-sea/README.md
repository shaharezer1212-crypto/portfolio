# למה אי אפשר לשקוע בים המלח?

A 50-second explainer film rendered entirely in code (three.js + a synthesised score).
Open `index.html` from a web server to play it live.

Render to video:

    npm i three@0.170.0            # anywhere; pass the path below
    python3 tools/score.py score.wav
    node tools/render.cjs --three <node_modules>/three/build/three.module.js --out frames
    ffmpeg -framerate 30 -i frames/f_%05d.jpg -i score.wav -c:v libx264 -crf 22 -pix_fmt yuv420p -c:a aac -shortest dead-sea-film.mp4

Figures used: salinity ~34%, density ~1.24 kg/L, surface ~430 m below sea level;
ions per litre ≈ Cl⁻ 6.3 mol, Mg²⁺ 1.8, Na⁺ 1.7, Ca²⁺ 0.43, K⁺ 0.19 against ~45 mol of water
(about one ion per four water molecules; in the ocean about one per fifty). Mg–O distance in the hydration shell ≈ 0.21 nm.
