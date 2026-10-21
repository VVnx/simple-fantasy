export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}
function crc32(bytes: Uint8Array) {
  let c = 0xFFFFFFFF;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// Stored ZIP, retaining the original rotation tool's dependency-free exporter.
export function zipFiles(entries: {name:string; bytes:Uint8Array<ArrayBuffer>}[]) {
  const local: BlobPart[] = [], central: BlobPart[] = [], encoder = new TextEncoder();
  let offset = 0, centralSize = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name), bytes = entry.bytes, crc = crc32(bytes);
    const head = new Uint8Array(30 + name.length), h = new DataView(head.buffer);
    h.setUint32(0,0x04034B50,true); h.setUint16(4,20,true); h.setUint16(6,0x0800,true);
    h.setUint16(12,0x0021,true); h.setUint32(14,crc,true); h.setUint32(18,bytes.length,true); h.setUint32(22,bytes.length,true); h.setUint16(26,name.length,true); head.set(name,30);
    local.push(head,bytes);
    const index = new Uint8Array(46 + name.length), c = new DataView(index.buffer);
    c.setUint32(0,0x02014B50,true); c.setUint16(4,20,true); c.setUint16(6,20,true); c.setUint16(8,0x0800,true);
    c.setUint16(14,0x0021,true); c.setUint32(16,crc,true); c.setUint32(20,bytes.length,true); c.setUint32(24,bytes.length,true); c.setUint16(28,name.length,true); c.setUint32(42,offset,true); index.set(name,46);
    central.push(index); offset += head.length + bytes.length; centralSize += index.length;
  }
  const end = new Uint8Array(22), e = new DataView(end.buffer);
  e.setUint32(0,0x06054B50,true); e.setUint16(8,entries.length,true); e.setUint16(10,entries.length,true); e.setUint32(12,centralSize,true); e.setUint32(16,offset,true);
  return new Blob([...local,...central,end],{type:'application/zip'});
}
