// Leitor de ZIP com suporte a HTTP Range (e a Buffer já baixado).
// Suporta ZIP64. Só usa built-ins do Node (fetch, zlib).
import { inflateRawSync } from "node:zlib";

export interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  size: number;
  offset: number;
}

/** Fonte de bytes: URL remota (Range) ou Buffer em memória. */
export interface ByteSource {
  size: number;
  read(start: number, endInclusive: number): Promise<Buffer>;
  lastModified?: string | null;
}

async function urlSource(url: string): Promise<ByteSource> {
  const head = await fetch(url, { method: "HEAD" });
  if (!head.ok) throw new Error(`HEAD ${url} -> ${head.status}`);
  const size = Number(head.headers.get("content-length"));
  return {
    size,
    lastModified: head.headers.get("last-modified"),
    async read(start, end) {
      for (let tentativa = 1; ; tentativa++) {
        try {
          const r = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } });
          if (r.status !== 206) throw new Error(`Range ${url} -> ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        } catch (e) {
          if (tentativa >= 3) throw e;
        }
      }
    },
  };
}

function bufferSource(buf: Buffer): ByteSource {
  return { size: buf.length, read: async (s, e) => buf.subarray(s, e + 1) };
}

function toSource(src: string | Buffer): Promise<ByteSource> {
  return typeof src === "string" ? urlSource(src) : Promise.resolve(bufferSource(src));
}

async function listFromSource(s: ByteSource): Promise<ZipEntry[]> {
  const tailLen = Math.min(s.size, 200_000);
  const tailStart = s.size - tailLen;
  const tail = await s.read(tailStart, s.size - 1);
  const eocd = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("EOCD não encontrado");
  let total = tail.readUInt16LE(eocd + 10);
  let cdSize = tail.readUInt32LE(eocd + 12);
  let cdOff = tail.readUInt32LE(eocd + 16);

  if (cdOff === 0xffffffff || total === 0xffff || cdSize === 0xffffffff) {
    // Localizador do EOCD64 fica logo antes do EOCD (20 bytes)
    const loc = eocd - 20;
    if (loc < 0 || tail.readUInt32LE(loc) !== 0x07064b50) throw new Error("Localizador ZIP64 ausente");
    const eocd64Off = Number(tail.readBigUInt64LE(loc + 8));
    const e64 = await s.read(eocd64Off, eocd64Off + 55);
    if (e64.readUInt32LE(0) !== 0x06064b50) throw new Error("EOCD64 inválido");
    total = Number(e64.readBigUInt64LE(32));
    cdSize = Number(e64.readBigUInt64LE(40));
    cdOff = Number(e64.readBigUInt64LE(48));
  }

  const cd = cdOff >= tailStart ? tail.subarray(cdOff - tailStart, cdOff - tailStart + cdSize) : await s.read(cdOff, cdOff + cdSize - 1);
  const out: ZipEntry[] = [];
  let p = 0;
  for (let i = 0; i < total; i++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) throw new Error("Diretório central corrompido");
    const method = cd.readUInt16LE(p + 10);
    let compSize = cd.readUInt32LE(p + 20);
    let size = cd.readUInt32LE(p + 24);
    const nl = cd.readUInt16LE(p + 28);
    const el = cd.readUInt16LE(p + 30);
    const cl = cd.readUInt16LE(p + 32);
    let offset = cd.readUInt32LE(p + 42);
    const name = cd.toString("utf8", p + 46, p + 46 + nl);
    const ex = cd.subarray(p + 46 + nl, p + 46 + nl + el);
    for (let q = 0; q + 4 <= ex.length; ) {
      const hid = ex.readUInt16LE(q);
      const hl = ex.readUInt16LE(q + 2);
      if (hid === 1) {
        let k = q + 4;
        if (size === 0xffffffff) { size = Number(ex.readBigUInt64LE(k)); k += 8; }
        if (compSize === 0xffffffff) { compSize = Number(ex.readBigUInt64LE(k)); k += 8; }
        if (offset === 0xffffffff) { offset = Number(ex.readBigUInt64LE(k)); k += 8; }
      }
      q += 4 + hl;
    }
    out.push({ name, method, compSize, size, offset });
    p += 46 + nl + el + cl;
  }
  return out;
}

async function readFromSource(s: ByteSource, e: ZipEntry): Promise<Buffer> {
  const lh = await s.read(e.offset, e.offset + 29);
  if (lh.readUInt32LE(0) !== 0x04034b50) throw new Error("Cabeçalho local inválido");
  const dataStart = e.offset + 30 + lh.readUInt16LE(26) + lh.readUInt16LE(28);
  const comp = await s.read(dataStart, dataStart + e.compSize - 1);
  if (e.method === 0) return comp;
  if (e.method !== 8) throw new Error(`Método de compressão ${e.method} não suportado`);
  return inflateRawSync(comp);
}

/** Lista as entradas do ZIP (URL via Range, ou Buffer). */
export async function listEntries(src: string | Buffer): Promise<ZipEntry[]> {
  return listFromSource(await toSource(src));
}

/** Lê e descompacta uma entrada pelo nome exato. */
export async function readEntry(src: string | Buffer, name: string): Promise<Buffer> {
  const s = await toSource(src);
  const entries = await listFromSource(s);
  const e = entries.find((x) => x.name === name);
  if (!e) throw new Error(`Entrada ${name} não encontrada`);
  return readFromSource(s, e);
}

/** Cabeçalho Last-Modified de uma URL (HEAD). */
export async function lastModified(url: string): Promise<string | null> {
  const r = await fetch(url, { method: "HEAD" });
  return r.headers.get("last-modified");
}
