import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import { assert, fail } from './core.mjs';
const run = promisify(execFile);
export const hash = data => createHash('sha256').update(data).digest('hex');
export function sniff(bytes) {
  if (bytes.length < 12) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.subarray(12,16).toString() === 'IHDR' && bytes.length > 32) return { mime: 'image/png', ext: 'png', kind: 'image', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 255) break;
      const marker = bytes[offset + 1];
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return { mime: 'image/jpeg', ext: 'jpg', kind: 'image', width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      const length = bytes.readUInt16BE(offset + 2); if (length < 2) break; offset += 2 + length;
    }
    return null;
  }
  if (bytes.subarray(4,8).toString() === 'ftyp') {
    const brands = bytes.subarray(8, Math.min(64, bytes.length)).toString();
    if (/heic|heix|hevc|hevx|mif1/.test(brands)) return { mime: 'image/heic', ext: 'heic', kind: 'image' };
    if (/M4A /.test(brands)) return { mime: 'audio/mp4', ext: 'm4a', kind: 'audio' };
    if (/qt  /.test(brands)) return { mime: 'video/quicktime', ext: 'mov', kind: 'video' };
    if (/isom|iso2|mp41|mp42|avc1|M4V /.test(brands)) return { mime: 'video/mp4', ext: 'mp4', kind: 'video' };
  }
  if (bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WAVE') return { mime: 'audio/wav', ext: 'wav', kind: 'audio' };
  if (bytes.subarray(0,3).toString() === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224)) return { mime: 'audio/mpeg', ext: 'mp3', kind: 'audio' };
  return null;
}
export async function validateMedia(bytes) {
  const info = sniff(bytes);
  assert(info, '文件内容无法识别，请选择 JPEG、PNG、HEIC、MP4、MOV、M4A、MP3 或 WAV');
  const max = { image: 20, audio: 50, video: 200 }[info.kind] * 1024 * 1024;
  assert(bytes.length <= max, `${info.kind === 'image' ? '照片' : info.kind === 'audio' ? '音频' : '视频'}超出单文件大小限制`);
  if (info.kind === 'image') {
    if (info.width !== undefined) assert(info.width > 0 && info.height > 0 && info.width * info.height <= 80_000_000, '图片尺寸无效或超过 8000 万像素');
    return info;
  }
  if (!process.env.FFPROBE_PATH) fail(503, 'MEDIA_VALIDATOR_UNAVAILABLE', '当前服务器暂未启用音视频校验，请先保存照片和文字');
  const dir = await mkdtemp(join(tmpdir(), 'anikind-media-'));
  try {
    const file = join(dir, `input.${info.ext}`); await writeFile(file, bytes);
    const { stdout } = await run(process.env.FFPROBE_PATH, ['-v','error','-show_entries','format=duration','-of','json',file], { timeout: 30_000, maxBuffer: 4096, windowsHide: true });
    const duration = Number(JSON.parse(stdout).format?.duration);
    assert(Number.isFinite(duration) && duration > 0 && duration <= (info.kind === 'audio' ? 300 : 180), '视频需在 3 分钟以内，音频需在 5 分钟以内');
    return { ...info, duration };
  } finally { await rm(dir, { recursive: true, force: true }); }
}
// USTAR archive with UTF-8 JSON metadata. Archive member paths are generated IDs only.
export function archive(entries) {
  const blocks = [];
  for (const { name, data } of entries) {
    const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100, 'utf8'); header.write('0000644\0',100); header.write('0000000\0',108); header.write('0000000\0',116);
    header.write(bytes.length.toString(8).padStart(11,'0')+'\0',124); header.write('00000000000\0',136);
    header.fill(32,148,156); header.write('0',156); header.write('ustar\0',257); header.write('00',263);
    const checksum = header.reduce((a,b)=>a+b,0); header.write(checksum.toString(8).padStart(6,'0')+'\0 ',148);
    blocks.push(header,bytes,Buffer.alloc((512-bytes.length%512)%512));
  }
  blocks.push(Buffer.alloc(1024)); return gzipSync(Buffer.concat(blocks));
}
const escapeXML = s => String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export function labeledImage(bytes, mime, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1280" viewBox="0 0 1200 1280"><rect width="1200" height="1280" fill="#f2f0fa"/><image x="0" y="0" width="1200" height="1200" preserveAspectRatio="xMidYMid meet" href="data:${mime};base64,${Buffer.from(bytes).toString('base64')}"/><rect y="1200" width="1200" height="80" fill="#fff"/><text x="32" y="1252" font-size="28" font-family="sans-serif" fill="#17131b">${escapeXML(label)} · AniKind</text></svg>`;
}
