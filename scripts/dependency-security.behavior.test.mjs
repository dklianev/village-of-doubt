import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { crc32 } from "node:zlib";

const require = createRequire(import.meta.url);
const lhciRequire = createRequire(require.resolve("@lhci/cli/package.json"));
const proxyRequire = createRequire(lhciRequire.resolve("proxy-agent"));
const pacRequire = createRequire(proxyRequire.resolve("pac-proxy-agent"));
const uriRequire = createRequire(pacRequire.resolve("get-uri"));

test("FTP listing parser rejects pathological input within a bounded subprocess", () => {
  const parser = uriRequire.resolve("basic-ftp/dist/parseListUnix.js");
  execFileSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const parser = require(${JSON.stringify(parser)});
    assert.equal(parser.parseLine('-rw-r--r-- 1 ' + 'a '.repeat(65536) + '!'), undefined);
    const file = parser.parseLine('-rw-r--r-- 1 owner group 42 Jan 1 2020 file.txt');
    assert.equal(file.name, 'file.txt');
    assert.equal(file.size, 42);
  `], { timeout: 5000, windowsHide: true, stdio: "pipe" });
});

test("get-uri reads FTP content through the patched client", { timeout: 10000 }, async () => {
  const sockets = new Set();
  const servers = [];
  const track = (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    return socket;
  };
  const listen = async (server) => {
    servers.push(server);
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    return server.address().port;
  };
  const server = net.createServer((socket) => {
    track(socket).setEncoding("utf8");
    socket.write("220 Local synthetic fixture\r\n");
    let pending = "";
    let dataSocket;
    socket.on("data", async (chunk) => {
      pending += chunk;
      let end;
      while ((end = pending.indexOf("\r\n")) >= 0) {
        const command = pending.slice(0, end).split(" ")[0];
        pending = pending.slice(end + 2);
        if (command === "USER") socket.write("331 Password\r\n");
        else if (command === "PASS") socket.write("230 Logged in\r\n");
        else if (command === "FEAT") socket.write("211 End\r\n");
        else if (command === "MDTM") socket.write("213 20261016000000\r\n");
        else if (command === "EPSV") {
          const port = await listen(net.createServer((data) => { dataSocket = track(data); }));
          socket.write(`229 Entering Extended Passive Mode (|||${port}|)\r\n`);
        } else if (command === "RETR") {
          socket.write("150 Opening data\r\n");
          dataSocket.end("synthetic ftp content", () => socket.write("226 Transfer complete\r\n"));
        } else if (command === "QUIT") socket.end("221 Goodbye\r\n");
        else socket.write("200 OK\r\n");
      }
    });
  });
  try {
    const port = await listen(server);
    const { getUri } = pacRequire("get-uri");
    const stream = await getUri(`ftp://127.0.0.1:${port}/fixture.txt`);
    let content = "";
    for await (const chunk of stream) content += chunk;
    assert.equal(content, "synthetic ftp content");
    assert.equal(stream.lastModified.toISOString(), "2026-10-16T00:00:00.000Z");
  } finally {
    for (const socket of sockets) socket.destroy();
    for (const server of servers) await new Promise((resolve) => server.close(resolve));
  }
});

test("patched extraction refuses escaping symlinks before duplicate-file writes", async () => {
  const launcherRequire = createRequire(lhciRequire.resolve("chrome-launcher"));
  // Puppeteer's browser installer and LHCI share extract-zip 2.0.1.
  let extract;
  try { extract = launcherRequire("extract-zip"); }
  catch { extract = createRequire(lhciRequire.resolve("@lhci/utils"))("extract-zip"); }
  const root = await mkdtemp(path.join(os.tmpdir(), "senkite-zip-fixture-"));
  try {
    const outside = path.join(root, "outside.txt");
    await writeFile(outside, "untouched");
    const archive = path.join(root, "attack.zip");
    for (const target of ["../outside.txt", outside]) {
      await writeFile(archive, zipFixture([
        { name: "entry", value: target, mode: 0o120777 },
        { name: "entry", value: "overwritten", mode: 0o100644 },
      ]));
      await assert.rejects(extract(archive, { dir: path.join(root, "output") }), /Out of bound symlink/);
      assert.equal(await readFile(outside, "utf8"), "untouched");
    }
    await writeFile(archive, zipFixture([{ name: "file.txt", value: "normal", mode: 0o100644 }]));
    await extract(archive, { dir: path.join(root, "safe") });
    assert.equal(await readFile(path.join(root, "safe/file.txt"), "utf8"), "normal");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// Minimal stored ZIP fixture, including Unix file modes and duplicate names.
function zipFixture(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), value = Buffer.from(entry.value);
    const header = Buffer.alloc(30), directory = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4);
    header.writeUInt32LE(crc32(value), 14);
    header.writeUInt32LE(value.length, 18); header.writeUInt32LE(value.length, 22);
    header.writeUInt16LE(name.length, 26);
    directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(0x0314, 4);
    header.copy(directory, 6, 4, 30);
    directory.writeUInt32LE((entry.mode << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    local.push(header, name, value); central.push(directory, name);
    offset += header.length + name.length + value.length;
  }
  const end = Buffer.alloc(22), index = Buffer.concat(central);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}
