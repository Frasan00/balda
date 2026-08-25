import { crc32 } from "node:zlib";

/**
 * Builds a minimal, valid single-entry ZIP archive (STORE method - uncompressed) for one file,
 * using only `node:zlib`'s `crc32`. Test-only: real Lambda deployments should compress, but
 * Lambda accepts an uncompressed entry just as well, and this avoids pulling in a zip library
 * for one test file.
 * @see https://en.wikipedia.org/wiki/ZIP_(file_format)
 */
export function zipSingleFile(fileName: string, content: Buffer): Buffer {
  const nameBuf = Buffer.from(fileName, "utf8");
  const crc = crc32(content) >>> 0;
  const size = content.length;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // local file header signature
  localHeader.writeUInt16LE(20, 4); // version needed
  localHeader.writeUInt16LE(0, 6); // flags
  localHeader.writeUInt16LE(0, 8); // compression: 0 = store
  localHeader.writeUInt16LE(0, 10); // mod time
  localHeader.writeUInt16LE(0, 12); // mod date
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(size, 18); // compressed size
  localHeader.writeUInt32LE(size, 22); // uncompressed size
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28); // extra length

  const localEntry = Buffer.concat([localHeader, nameBuf, content]);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
  centralHeader.writeUInt16LE(20, 4); // version made by
  centralHeader.writeUInt16LE(20, 6); // version needed
  centralHeader.writeUInt16LE(0, 8); // flags
  centralHeader.writeUInt16LE(0, 10); // compression
  centralHeader.writeUInt16LE(0, 12); // mod time
  centralHeader.writeUInt16LE(0, 14); // mod date
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(size, 20);
  centralHeader.writeUInt32LE(size, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30); // extra length
  centralHeader.writeUInt16LE(0, 32); // comment length
  centralHeader.writeUInt16LE(0, 34); // disk number start
  centralHeader.writeUInt16LE(0, 36); // internal attributes
  centralHeader.writeUInt32LE(0, 38); // external attributes
  centralHeader.writeUInt32LE(0, 42); // local header offset

  const centralEntry = Buffer.concat([centralHeader, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central directory
  eocd.writeUInt16LE(1, 8); // entries on this disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(centralEntry.length, 12); // central directory size
  eocd.writeUInt32LE(localEntry.length, 16); // central directory offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localEntry, centralEntry, eocd]);
}
