/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converts a Float32Array of audio samples (-1.0 to 1.0) to a 16-bit signed PCM Int16Array.
 */
export function float32ToInt16(floatBuffer: Float32Array): Int16Array {
  const pcmBuffer = new Int16Array(floatBuffer.length);
  for (let i = 0; i < floatBuffer.length; i++) {
    const s = Math.max(-1, Math.min(1, floatBuffer[i]));
    pcmBuffer[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcmBuffer;
}

/**
 * Converts a 16-bit signed PCM Int16Array (or ArrayBuffer) to a Float32Array (-1.0 to 1.0).
 */
export function int16ToFloat32(int16Buffer: Int16Array | ArrayBuffer): Float32Array {
  const pcm = int16Buffer instanceof Int16Array ? int16Buffer : new Int16Array(int16Buffer);
  const floatBuffer = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) {
    floatBuffer[i] = pcm[i] / 32768.0;
  }
  return floatBuffer;
}

/**
 * Encodes an ArrayBuffer or TypedArray into a base64 string.
 */
export function bufferToBase64(buffer: ArrayBuffer | ArrayBufferView): string {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decodes a base64 string into an ArrayBuffer.
 */
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
