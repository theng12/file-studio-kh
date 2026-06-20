import type { ScannedFile } from '../../shared/types/app';

export function detectMessiness(input: {
  filename: string;
  extension: string;
  fileType: ScannedFile['fileType'];
  sizeBytes: number;
}): string[] {
  const tags = new Set<string>();
  const name = input.filename.toLowerCase();
  const baseName = name.replace(/\.[^.]+$/, '');

  if (/^(img|dsc|pxl)[-_ ]?\d{3,}/i.test(baseName)) tags.add('camera_name');
  if (/\bcopy\b/.test(name)) tags.add('copy');
  if (/final[\s_-]*final/.test(name)) tags.add('final_final');
  if (/\b(new|large|small|edited)\b/.test(name)) tags.add('generic_modifier');
  if (input.filename === '.DS_Store') tags.add('system_file');
  if (input.sizeBytes > 25 * 1024 * 1024) tags.add('large_file');
  if (input.fileType === 'image' && input.sizeBytes < 20 * 1024) tags.add('small_image_file');

  return Array.from(tags);
}
