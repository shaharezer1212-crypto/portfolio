"""Synthesises the film's score (50 s, D minor -> D major) straight to a WAV file.
   python3 score.py out.wav
Cues follow film.js: dive 12.7, molecules 20.2, close-up 33.6, pull-out 38.0, back on the surface 45.4."""
import sys, wave
import numpy as np
from scipy import signal

SR, DUR = 44100, 50.0
N = int(SR * DUR)
T = np.arange(N) / SR
rs = np.random.RandomState(7)
L = np.zeros(N); R = np.zeros(N)

hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'])}
def m(name):
    return 12 * (int(name[-1]) + 1) + NOTE[name[:-1]]

def add(sig, start, pan=0.0, gain=1.0):
    i = int(start * SR)
    if i >= N: return
    n = min(len(sig), N - i)
    a = np.sqrt(0.5 * (1 - pan)); b = np.sqrt(0.5 * (1 + pan))
    L[i:i + n] += sig[:n] * a * gain; R[i:i + n] += sig[:n] * b * gain

def pad(notes, t0, t1, amp, bright, attack=1.5, release=2.0):
    """Detuned additive saw pad. bright = (start, end) harmonic roll-off."""
    n = int((t1 - t0 + release) * SR); t = np.arange(n) / SR
    env = np.clip(t / attack, 0, 1) ** 1.5 * np.clip((t1 - t0 + release - t) / release, 0, 1) ** 1.5
    br = np.interp(t, [0, t1 - t0, t1 - t0 + release], [bright[0], bright[1], bright[1] * 0.6])
    for name in notes:
        f = hz(m(name))
        for cents, pan in ((-9, -0.7), (0, 0.0), (8, 0.7)):
            ff = f * 2 ** (cents / 1200)
            s = np.zeros(n)
            for k in range(1, int(min(22, 7000 / ff)) + 1):
                s += np.sin(2 * np.pi * ff * k * t + rs.rand() * 6.28) / k * np.exp(-(k - 1) / br)
            s *= 1 + 0.08 * np.sin(2 * np.pi * (0.13 + rs.rand() * 0.2) * t + rs.rand() * 6.28)
            add(s * env, t0, pan, amp / len(notes) ** 0.5 * 0.5)

def bell(note, t0, amp, dur=3.2, pan=0.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m(note))
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 1.4), (2, .35, 2.2), (3, .12, 3.5), (4.2, .06, 5)))
    add(s * np.clip(t / 0.006, 0, 1), t0, pan, amp)

def pluck(midi, t0, amp, pan):
    n = int(0.7 * SR); t = np.arange(n) / SR; f = hz(midi)
    s = (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) * np.exp(-t * 9) + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t * 14)) * np.exp(-t * 6.5)
    add(s * np.clip(t / 0.004, 0, 1), t0, pan, amp)

def boom(t0, amp, braam=None):
    n = int(4.0 * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(38 + 55 * np.exp(-t / 0.10)) / SR
    s = np.sin(ph) * np.exp(-t / 1.1)
    nz = signal.sosfilt(signal.butter(2, 180, 'low', fs=SR, output='sos'), rs.randn(n)) * np.exp(-t / 0.45) * 2.5
    add((s + nz) * np.clip(t / 0.004, 0, 1), t0, 0, amp)
    if braam:
        for name in braam:
            f = hz(m(name))
            for cents, pan in ((-12, -0.5), (11, 0.5)):
                ff = f * 2 ** (cents / 1200); b = np.zeros(n)
                for k in range(1, 19):
                    b += np.sin(2 * np.pi * ff * k * t + rs.rand() * 6.28) / k * np.exp(-(k - 1) / (2 + 9 * np.exp(-t / 0.9)))
                add(b * np.clip(t / 0.03, 0, 1) * np.exp(-t / 1.5), t0, pan, amp * 0.33)

BANDS = [signal.butter(2, [lo, lo * 1.9], 'band', fs=SR, output='sos') for lo in (150, 280, 520, 960, 1800, 3300, 6000)]
def sweep(t0, t1, amp, up=True, power=2.5):
    """Filtered-noise riser (or fall), ending abruptly at t1."""
    n = int((t1 - t0) * SR); x = np.linspace(0, 1, n)
    for side, pan in ((0, -0.6), (1, 0.6)):
        nz = rs.randn(n); out = np.zeros(n)
        pos = (x if up else 1 - x) * (len(BANDS) - 1)
        for i, sos in enumerate(BANDS):
            out += signal.sosfilt(sos, nz) * np.exp(-((pos - i) ** 2) / 0.9)
        env = x ** power if up else (1 - x) ** 1.5
        add(out * env, t0, pan, amp)
    # tonal glide underneath
    f = hz(m('D3')) * 2 ** ((x if up else 1 - x) * 2)
    g = np.sin(2 * np.pi * np.cumsum(f) / SR) * (x ** power if up else (1 - x) ** 1.5)
    add(g, t0, 0, amp * 0.25)

# ---- drone -----------------------------------------------------------------
def drone(note, pts, amp):
    f = hz(m(note)); env = np.interp(T, [p[0] for p in pts], [p[1] for p in pts])
    s = (np.sin(2 * np.pi * f * T) + 0.5 * np.sin(4 * np.pi * f * T)) * env * (1 + 0.15 * np.sin(2 * np.pi * 0.21 * T))
    L[:] += s * amp; R[:] += s * amp
drone('D1', [(0, 0), (2, .7), (12.7, .9), (13.5, 1.2), (20, 1.3), (20.4, 1.0), (33, .9), (36, 0), (50, 0)], 0.16)
drone('A1', [(0, 0), (35.5, 0), (37.5, .8), (44.8, 1.3), (45.4, 0), (50, 0)], 0.16)
drone('D1', [(0, 0), (45.3, 0), (45.5, 1.4), (48.5, 1.0), (50, 0)], 0.17)

# ---- opening: above the water ---------------------------------------------
pad(['D2', 'A2', 'D3', 'F3', 'A3', 'E4'], 0.0, 6.8, 0.42, (1.6, 2.6), attack=2.5)
pad(['D2', 'Bb2', 'D3', 'F3', 'A3', 'D4'], 6.3, 12.6, 0.50, (2.4, 4.2), attack=1.5, release=1.2)
for i, (tm, nt) in enumerate([(1.0, 'A4'), (2.5, 'D5'), (4.0, 'F5'), (5.5, 'E5'), (7.0, 'D5'), (8.5, 'F5'), (10.0, 'A5'), (11.2, 'G5'), (11.9, 'A5')]):
    bell(nt, tm, 0.20 + 0.012 * i, pan=(-0.35 if i % 2 else 0.35))
boom(0.25, 0.45)
sweep(10.9, 12.7, 0.10)
# ---- the dive and the long zoom -------------------------------------------
boom(12.7, 0.9)
sweep(12.7, 15.2, 0.16, up=False)
pad(['D2', 'A2', 'E3', 'A3'], 12.7, 20.1, 0.55, (1.0, 5.5), attack=1.2, release=0.5)
for k, tm in enumerate(np.arange(13.7, 19.9, 0.75)):          # sonar-like pings, one per decade
    bell(['A5', 'E6'][k % 2], tm, 0.07 + 0.012 * k, dur=1.6, pan=(-0.6 if k % 2 else 0.6))
sweep(16.6, 20.2, 0.30, power=3.0)
# ---- molecules -------------------------------------------------------------
boom(20.2, 1.15, braam=['D1', 'D2', 'A2'])
CH = [(20.2, 27.2, ['D2', 'A2', 'D3', 'F3', 'A3', 'D4', 'F4', 'A4'], [62, 69, 74, 77, 74, 69, 65, 69], 'D2'),
      (27.2, 33.6, ['Bb1', 'F2', 'Bb2', 'D3', 'F3', 'A3', 'D4', 'F4'], [58, 65, 70, 74, 70, 65, 62, 65], 'Bb1'),
      (33.6, 36.0, ['G1', 'D2', 'G2', 'Bb2', 'D3', 'G3', 'Bb3', 'D4'], [55, 62, 67, 70, 67, 62, 58, 62], 'G1'),
      (36.0, 38.0, ['A1', 'E2', 'A2', 'C#3', 'E3', 'A3', 'C#4', 'E4'], [57, 64, 69, 73, 69, 64, 61, 64], 'A1')]
for t0, t1, notes, arp, bass in CH:
    pad(notes, t0, t1, 0.62, (5.0, 6.5), attack=0.5, release=1.6)
step = 0
for tm in np.arange(20.2, 45.3, 0.25):
    ch = next((c for c in CH if c[0] <= tm < c[1]), CH[-1])
    prog = (tm - 20.2) / 25.1
    vel = (0.10 + 0.16 * prog) * (1.25 if step % 4 == 0 else 1.0) * (0.55 if 33.6 <= tm < 35.0 else 1.0)
    pluck(ch[3][step % 8] + (12 if tm >= 41.0 else 0), tm, vel, -0.55 if step % 2 else 0.55)
    if tm >= 38.0: pluck(ch[3][(step + 4) % 8] + 12, tm + 0.125, vel * 0.6, 0.55 if step % 2 else -0.55)
    if step % 2 == 0 and tm < 38.0:                                  # heartbeat bass on the beat
        n = int(0.45 * SR); t = np.arange(n) / SR
        add(np.sin(2 * np.pi * hz(m(ch[4])) * 2 * t) * np.exp(-t * 7) * np.clip(t / 0.005, 0, 1), tm, 0, 0.20)
    step += 1
boom(27.2, 0.55); boom(33.6, 0.7)
# ---- the way back ----------------------------------------------------------
boom(38.0, 0.8)
pad(['A1', 'E2', 'A2', 'E3', 'A3', 'C#4', 'E4', 'A4'], 38.0, 45.3, 0.70, (3.0, 10.0), attack=3.5, release=0.4)
sweep(40.2, 45.4, 0.40, power=2.6)
for k, tm in enumerate(np.arange(42.4, 45.3, 0.5)):                 # timpani-like run-up
    boom(tm, 0.28 + 0.07 * k)
# ---- surface, resolution in D major ---------------------------------------
boom(45.4, 1.3, braam=['D1', 'D2', 'A2', 'F#3'])
pad(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 45.4, 48.4, 0.95, (9.0, 4.0), attack=0.08, release=1.8)
for tm, nt in [(45.4, 'D5'), (45.9, 'F#5'), (46.4, 'A5'), (46.9, 'D6'), (47.9, 'A5')]:
    bell(nt, tm, 0.26, pan=0.0)

# ---- reverb + master -------------------------------------------------------
def reverb(x, seed):
    r = np.random.RandomState(seed); n = int(3.6 * SR); t = np.arange(n) / SR
    ir = r.randn(n) * np.exp(-t / 0.95) * np.clip(t / 0.02, 0, 1)
    ir = signal.sosfilt(signal.butter(2, [180, 6500], 'band', fs=SR, output='sos'), ir)
    w = signal.fftconvolve(x, ir)[:N]
    return w / np.sqrt(np.sum(ir ** 2))
wetL, wetR = reverb(L, 1), reverb(R, 2)
L = L + 0.30 * wetL; R = R + 0.30 * wetR
hp = signal.butter(2, 24, 'high', fs=SR, output='sos')
L = signal.sosfilt(hp, L); R = signal.sosfilt(hp, R)
fade = np.clip(T / 0.25, 0, 1) * np.clip((DUR - 0.05 - T) / 1.3, 0, 1)
peak = np.percentile(np.abs(np.concatenate([L, R])), 99.9)
L = np.tanh(L / peak * 1.15) * fade; R = np.tanh(R / peak * 1.15) * fade
g = 0.89 / max(np.abs(L).max(), np.abs(R).max())
out = (np.stack([L, R], 1) * g * 32767).astype('<i2')
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', sys.argv[1])
