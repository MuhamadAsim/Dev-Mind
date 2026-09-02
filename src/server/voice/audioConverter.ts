// ============================================================
// Audio Converter & Local Audio Logger Utility
// Converts MP3 audio to OGG/Opus for WhatsApp Voice Notes (PTT)
// and saves copies locally for debugging / inspection.
// ============================================================

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const AUDIO_LOGS_DIR = path.resolve(process.cwd(), 'data', 'audio_logs');

/**
 * Ensures the audio logs directory exists.
 */
function ensureAudioLogsDir(): string {
  if (!fs.existsSync(AUDIO_LOGS_DIR)) {
    fs.mkdirSync(AUDIO_LOGS_DIR, { recursive: true });
  }
  return AUDIO_LOGS_DIR;
}

/**
 * Saves an audio buffer to a local debug/inspection folder.
 *
 * @param buffer - The raw audio buffer
 * @param prefix - Label prefix (e.g. 'uplift_raw', 'whatsapp_opus')
 * @param extension - File extension without dot (e.g. 'mp3', 'ogg')
 * @returns Saved file path or null if write failed
 */
export async function saveAudioFile(
  buffer: Buffer,
  prefix = 'audio',
  extension = 'mp3'
): Promise<string | null> {
  try {
    const dir = ensureAudioLogsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}_${timestamp}.${extension}`;
    const filePath = path.join(dir, filename);

    await fs.promises.writeFile(filePath, buffer);
    console.log(`[AudioLog] 💾 Saved audio file to: ${filePath} (${buffer.length} bytes)`);
    return filePath;
  } catch (err: any) {
    console.error(`[AudioLog] Failed to save audio file locally:`, err?.message || err);
    return null;
  }
}

/**
 * Converts an audio buffer (e.g., MP3) to OGG Opus format.
 * WhatsApp Voice Notes (sendAudioAsVoice: true) strictly require OGG Opus ('audio/ogg; codecs=opus').
 *
 * @param inputBuffer - Raw audio buffer (MP3/WAV/etc.)
 * @returns Converted OGG Opus buffer and MIME type, or null if conversion fails/ffmpeg is unavailable.
 */
export async function convertToOpusVoiceNote(
  inputBuffer: Buffer
): Promise<{ audioBuffer: Buffer; mimeType: string } | null> {
  return new Promise((resolve) => {
    try {
      // Spawn ffmpeg to convert from stdin pipe to stdout pipe in ogg opus format
      const ffmpeg = spawn(
        'ffmpeg',
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-i',
          'pipe:0',
          '-c:a',
          'libopus',
          '-b:a',
          '32k',
          '-vbr',
          'on',
          '-f',
          'ogg',
          'pipe:1',
        ],
        { stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];

      ffmpeg.stdout.on('data', (chunk) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      ffmpeg.stderr.on('data', (chunk) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      ffmpeg.on('error', (err: any) => {
        console.warn(
          `[AudioConverter] FFmpeg process error (${err?.message || err}). Falling back to regular MP3.`
        );
        resolve(null);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && stdoutChunks.length > 0) {
          const oggBuffer = Buffer.concat(stdoutChunks);
          console.log(
            `[AudioConverter] Successfully converted audio to OGG Opus (${oggBuffer.length} bytes).`
          );
          resolve({
            audioBuffer: oggBuffer,
            mimeType: 'audio/ogg; codecs=opus',
          });
        } else {
          const stderr = Buffer.concat(stderrChunks).toString();
          console.warn(
            `[AudioConverter] FFmpeg exited with code ${code}. Stderr: ${stderr}. Falling back to regular MP3.`
          );
          resolve(null);
        }
      });

      // Write input buffer to ffmpeg stdin
      ffmpeg.stdin.write(inputBuffer);
      ffmpeg.stdin.end();
    } catch (err: any) {
      console.warn(
        `[AudioConverter] Failed to execute FFmpeg conversion: ${err?.message || err}. Falling back to regular MP3.`
      );
      resolve(null);
    }
  });
}
