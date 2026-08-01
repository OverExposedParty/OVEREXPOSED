const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 44100;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const forceOverwrite = process.argv.includes('--force');

const sounds = {
  'public/sounds/ui/buttons/selections/select.wav': [
    { from: 500, to: 640, duration: 0.085, volume: 0.2 }
  ],
  'public/sounds/ui/buttons/selections/deselect.wav': [
    { from: 590, to: 390, duration: 0.095, volume: 0.18 }
  ],
  'public/sounds/ui/buttons/actions/confirm.wav': [
    { from: 440, to: 500, duration: 0.07, volume: 0.19 },
    { duration: 0.018 },
    { from: 620, to: 680, duration: 0.1, volume: 0.2 }
  ],
  'public/sounds/ui/buttons/actions/success.wav': [
    { from: 520, to: 540, duration: 0.065, volume: 0.17 },
    { from: 650, to: 675, duration: 0.07, volume: 0.18 },
    { from: 780, to: 820, duration: 0.11, volume: 0.19 }
  ],
  'public/sounds/ui/buttons/actions/error.wav': [
    { from: 270, to: 220, duration: 0.105, volume: 0.2 },
    { duration: 0.025 },
    { from: 205, to: 155, duration: 0.13, volume: 0.21 }
  ],
  'public/sounds/ui/buttons/actions/warning.wav': [
    { from: 350, to: 330, duration: 0.08, volume: 0.18 },
    { duration: 0.045 },
    { from: 350, to: 330, duration: 0.095, volume: 0.19 }
  ],
  'public/sounds/ui/buttons/adjustments/increase.wav': [
    { from: 560, to: 720, duration: 0.055, volume: 0.14 }
  ],
  'public/sounds/ui/buttons/adjustments/decrease.wav': [
    { from: 720, to: 560, duration: 0.055, volume: 0.14 }
  ],
  'public/sounds/ui/buttons/navigation/previous.wav': [
    { from: 540, to: 430, duration: 0.06, volume: 0.13 }
  ],
  'public/sounds/ui/buttons/navigation/next.wav': [
    { from: 430, to: 540, duration: 0.06, volume: 0.13 }
  ],
  'public/sounds/ui/buttons/navigation/scroll.wav': [
    { from: 380, to: 610, duration: 0.075, volume: 0.11 }
  ],
  'public/sounds/olings/lab/move.wav': [
    { from: 250, to: 330, duration: 0.075, volume: 0.16 },
    { duration: 0.018 },
    { from: 360, to: 300, duration: 0.065, volume: 0.13 }
  ]
};

function createWave(segments) {
  const sampleCount = segments.reduce(
    (total, segment) => total + Math.round(segment.duration * SAMPLE_RATE),
    0
  );
  const dataSize = sampleCount * CHANNELS * (BITS_PER_SAMPLE / 8);
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), 28);
  buffer.writeUInt16LE(CHANNELS * (BITS_PER_SAMPLE / 8), 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let sampleOffset = 0;
  let phase = 0;

  segments.forEach((segment) => {
    const length = Math.round(segment.duration * SAMPLE_RATE);
    const startFrequency = segment.from || 0;
    const endFrequency = segment.to ?? startFrequency;
    const volume = segment.volume || 0;

    for (let index = 0; index < length; index += 1) {
      const progress = length > 1 ? index / (length - 1) : 0;
      const frequency =
        startFrequency + (endFrequency - startFrequency) * progress;
      const attack = Math.min(1, index / (SAMPLE_RATE * 0.008));
      const release = Math.min(1, (length - index - 1) / (SAMPLE_RATE * 0.022));
      const envelope = Math.max(0, Math.min(attack, release));

      phase += (Math.PI * 2 * frequency) / SAMPLE_RATE;
      const fundamental = Math.sin(phase);
      const harmonic = Math.sin(phase * 2) * 0.12;
      const value = Math.max(
        -1,
        Math.min(1, (fundamental + harmonic) * volume * envelope)
      );

      buffer.writeInt16LE(Math.round(value * 32767), 44 + sampleOffset * 2);
      sampleOffset += 1;
    }
  });

  return buffer;
}

Object.entries(sounds).forEach(([relativePath, segments]) => {
  const outputPath = path.join(__dirname, '..', relativePath);
  if (!forceOverwrite && fs.existsSync(outputPath)) {
    console.log(`Skipped existing ${relativePath}`);
    return;
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, createWave(segments));
  console.log(`Generated ${relativePath}`);
});
