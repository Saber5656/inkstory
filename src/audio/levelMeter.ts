export function createLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void,
): () => void {
  if (typeof AudioContext === 'undefined') return () => undefined;
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const samples = new Uint8Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getByteTimeDomainData(samples);
    let power = 0;
    for (const sample of samples) power += ((sample - 128) / 128) ** 2;
    onLevel(Math.min(1, Math.sqrt(power / samples.length) * 4));
  }, 1000 / 12);
  return () => {
    clearInterval(timer);
    source.disconnect();
    analyser.disconnect();
    void context.close();
  };
}
