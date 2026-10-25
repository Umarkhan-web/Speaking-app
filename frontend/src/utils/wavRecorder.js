/**
 * 16-bit PCM Mono WAV Encoder
 */
function encodeWav(samples, sampleRate = 16000) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  // RIFF identifier
  writeString(0, "RIFF");
  // File length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(8, "WAVE");

  // format chunk identifier
  writeString(12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 1 channel * 2 bytes)
  view.setUint32(28, sampleRate * 2, true);
  // block align (1 channel * 2 bytes)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);

  // data chunk identifier
  writeString(36, "data");
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples (16-bit signed integer)
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * Clean Web Audio PCM Recorder for Whisper
 * Generates pristine 16kHz Mono WAV files compatible with faster-whisper on all platforms.
 */
export class AudioRecorder {
  constructor() {
    this.stream = null;
    this.audioCtx = null;
    this.source = null;
    this.processor = null;
    this.analyser = null;
    this.recordedChunks = [];
    this.sampleRate = 16000;
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    try {
      this.audioCtx = new AudioContextClass({ sampleRate: 16000 });
    } catch {
      this.audioCtx = new AudioContextClass();
    }
    this.sampleRate = this.audioCtx.sampleRate || 44100;

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 64;
    this.source.connect(this.analyser);

    // Buffer size 4096, 1 input channel, 1 output channel
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
    this.recordedChunks = [];

    this.processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0);
      this.recordedChunks.push(new Float32Array(input));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
  }

  getAudioLevel() {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
  }

  stop() {
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {}
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }

    if (this.audioCtx && this.audioCtx.state !== "closed") {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    const totalLength = this.recordedChunks.reduce((acc, c) => acc + c.length, 0);
    const samples = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }

    // Downsample to 16kHz for Whisper if needed
    let finalSamples = samples;
    let targetRate = this.sampleRate;
    if (this.sampleRate !== 16000 && this.sampleRate > 16000 && samples.length > 0) {
      const ratio = this.sampleRate / 16000;
      const newLength = Math.max(1, Math.round(samples.length / ratio));
      finalSamples = new Float32Array(newLength);
      for (let i = 0; i < newLength; i++) {
        const srcIdx = Math.min(samples.length - 1, Math.round(i * ratio));
        finalSamples[i] = samples[srcIdx] || 0;
      }
      targetRate = 16000;
    }

    return encodeWav(finalSamples, targetRate);
  }
}
