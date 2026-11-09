import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();
const mappings = [
  ["portraits/lin_jianwu.webp.b64", "client/src/assets/portraits/lin_jianwu.webp"],
  ["portraits/zhou.webp.b64", "client/src/assets/portraits/zhou.webp"],
  ["portraits/he.webp.b64", "client/src/assets/portraits/he.webp"],
  ["portraits/jiao.webp.b64", "client/src/assets/portraits/jiao.webp"],
  ["portraits/wen.webp.b64", "client/src/assets/portraits/wen.webp"],
  ["portraits/lin_wu.webp.b64", "client/src/assets/portraits/lin_wu.webp"],
  ["kenney-map/water.png.b64", "client/src/assets/kenney-map/water.png"],
  ["kenney-map/land.png.b64", "client/src/assets/kenney-map/land.png"],
  ["kenney-map/castle.png.b64", "client/src/assets/kenney-map/castle.png"],
  ["kenney-map/tower.png.b64", "client/src/assets/kenney-map/tower.png"],
  ["kenney-map/tree.png.b64", "client/src/assets/kenney-map/tree.png"],
  ["kenney-map/arch.png.b64", "client/src/assets/kenney-map/arch.png"],
];

let restored = 0;
for (const [encoded, target] of mappings) {
  const destination = join(root, target);
  if (existsSync(destination)) continue;

  const encodedDir = join(root, "assets-encoded", dirname(encoded));
  const partPrefix = `${encoded}.part`;
  const parts = existsSync(encodedDir)
    ? readdirSync(encodedDir)
        .filter((file) => file.startsWith(partPrefix))
        .sort()
    : [];

  let contents = "";
  if (parts.length > 0) {
    contents = parts
      .map((file) => readFileSync(join(encodedDir, file), "utf8"))
      .join("");
  } else {
    const source = join(root, "assets-encoded", encoded);
    if (!existsSync(source)) {
      console.warn(`缺少图片编码文件：${encoded}`);
      continue;
    }
    contents = readFileSync(source, "utf8");
  }

  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(
    destination,
    Buffer.from(contents.replace(/\s+/g, ""), "base64"),
  );
  restored += 1;
}
console.log(restored > 0 ? `已从 base64 还原 ${restored} 张图片资源。` : "图片资源已存在。");
