/**
 * AudioWorklet Processor for PCM Audio Conversion
 * Replaces deprecated ScriptProcessorNode with modern AudioWorklet API
 */

class PCMProcessor extends AudioWorkletProcessor {
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0]?.[0];
    if (input && input.length > 0) {
      const pcmData = this.float32ToInt16(input);
      this.port.postMessage({ pcmData });
    }
    return true;
  }

  private float32ToInt16(float32: Float32Array): Int16Array {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16;
  }
}

registerProcessor('pcm-processor', PCMProcessor);

