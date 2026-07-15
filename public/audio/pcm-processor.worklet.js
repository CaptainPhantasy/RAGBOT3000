/**
 * Authoritative AudioWorklet processor for PCM audio conversion.
 *
 * This file is loaded directly at runtime by LiveSession. Keep the processor
 * implementation here rather than maintaining a second TypeScript copy that
 * is not part of the public build output.
 */

class PCMProcessor extends AudioWorkletProcessor {
	process(inputs) {
		const input = inputs[0]?.[0];
		if (input && input.length > 0) {
			const pcmData = this.float32ToInt16(input);
			this.port.postMessage({ pcmData });
		}
		return true;
	}

	float32ToInt16(float32) {
		const int16 = new Int16Array(float32.length);
		for (let i = 0; i < float32.length; i++) {
			const s = Math.max(-1, Math.min(1, float32[i]));
			int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
		}
		return int16;
	}
}

registerProcessor("pcm-processor", PCMProcessor);
