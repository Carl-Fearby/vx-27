#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  throw new Error("Usage: prepare-px27-enemy.cjs <input.glb> <output.glb>");
}

function pad4(buffer, fill = 0) {
  const remainder = buffer.length % 4;
  if (!remainder) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder, fill)]);
}

function readGlb(source) {
  if (source.toString("ascii", 0, 4) !== "glTF") {
    throw new Error("Input is not a binary glTF file");
  }
  let offset = 12;
  let json = null;
  let binary = null;
  while (offset < source.length) {
    const length = source.readUInt32LE(offset);
    const type = source.toString("ascii", offset + 4, offset + 8);
    const data = source.subarray(offset + 8, offset + 8 + length);
    if (type === "JSON") {
      json = JSON.parse(data.toString("utf8").replace(/[\u0000 ]+$/, ""));
    } else if (type.startsWith("BIN")) {
      binary = data;
    }
    offset += 8 + length;
  }
  if (!json || !binary) throw new Error("GLB is missing JSON or BIN data");
  return { json, binary };
}

function writeGlb(json, binary, destination) {
  const jsonChunk = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const binaryChunk = pad4(binary);
  const output = Buffer.alloc(12 + 8 + jsonChunk.length + 8 + binaryChunk.length);
  output.write("glTF", 0, "ascii");
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(jsonChunk.length, 12);
  output.write("JSON", 16, "ascii");
  jsonChunk.copy(output, 20);
  const binaryHeader = 20 + jsonChunk.length;
  output.writeUInt32LE(binaryChunk.length, binaryHeader);
  output.write("BIN\0", binaryHeader + 4, "ascii");
  binaryChunk.copy(output, binaryHeader + 8);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, output);
}

async function main() {
  const { json, binary } = readGlb(fs.readFileSync(inputPath));
  const firstImage = json.images?.[0];
  const duplicateImage = json.images?.[1];
  if (!firstImage || !duplicateImage) {
    throw new Error("Expected the PX-27 merged file to contain two images");
  }
  const firstViewIndex = firstImage.bufferView;
  const duplicateViewIndex = duplicateImage.bufferView;
  const firstView = json.bufferViews[firstViewIndex];
  const duplicateView = json.bufferViews[duplicateViewIndex];
  const sourcePng = binary.subarray(
    firstView.byteOffset ?? 0,
    (firstView.byteOffset ?? 0) + firstView.byteLength,
  );
  const optimizedPng = pad4(await sharp(sourcePng)
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer());

  const prefix = binary.subarray(0, firstView.byteOffset ?? 0);
  const suffixStart = (duplicateView.byteOffset ?? 0) + duplicateView.byteLength;
  const suffix = binary.subarray(suffixStart);
  const compactBinary = Buffer.concat([prefix, optimizedPng, suffix]);
  const offsetShift = suffixStart - (prefix.length + optimizedPng.length);

  firstView.byteOffset = prefix.length;
  firstView.byteLength = optimizedPng.length;
  json.bufferViews.splice(duplicateViewIndex, 1);
  for (let index = duplicateViewIndex; index < json.bufferViews.length; index += 1) {
    const view = json.bufferViews[index];
    view.byteOffset = (view.byteOffset ?? 0) - offsetShift;
  }
  for (const accessor of json.accessors ?? []) {
    if (accessor.bufferView > duplicateViewIndex) accessor.bufferView -= 1;
  }
  json.images = [{ ...firstImage, bufferView: firstViewIndex }];
  json.textures = [{ ...json.textures[0], source: 0 }];
  for (const material of json.materials ?? []) {
    if (material.emissiveTexture) material.emissiveTexture.index = 0;
    if (material.pbrMetallicRoughness?.baseColorTexture) {
      material.pbrMetallicRoughness.baseColorTexture.index = 0;
    }
  }
  json.buffers[0].byteLength = compactBinary.length;
  writeGlb(json, compactBinary, outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
