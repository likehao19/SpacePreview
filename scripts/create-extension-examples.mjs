import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, strToU8, zipSync, zlibSync } from 'fflate';
import initSqlJs from 'sql.js';
import { ImageMagick, MagickFormat, initializeImageMagick } from '@imagemagick/magick-wasm';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destination = join(root, 'example');
const text = (value) => Buffer.from(value, 'utf8');
const zip = (entries) => Buffer.from(zipSync(entries));
const stores = ['滨江店', '湖滨店', '城西店', '大学城店'];
const goods = [
  ['速写本', 28],
  ['钢笔', 68],
  ['牛皮纸袋', 16],
  ['便签贴', 9],
  ['帆布袋', 46],
  ['墨水', 22],
];
const orders = Array.from({ length: 180 }, (_, index) => {
  const item = goods[index % goods.length];
  const qty = (index % 5) + 1;
  return {
    id: 24001 + index,
    date: `2026-0${7 + (index % 3)}-${String((index % 27) + 1).padStart(2, '0')}`,
    store: stores[index % stores.length],
    goods: item[0],
    qty,
    price: item[1],
    amount: qty * item[1],
  };
});
const totalAmount = orders.reduce((sum, order) => sum + order.amount, 0);
const storeTotals = stores.map((store) => ({
  store,
  count: orders.filter((order) => order.store === store).length,
  amount: orders
    .filter((order) => order.store === store)
    .reduce((sum, order) => sum + order.amount, 0),
}));

function enginesFromSource(source, sourceLanguages) {
  let body = source.slice(
    source.indexOf('export const engines'),
    source.indexOf('export const extension'),
  );
  body = body.replace(/export const engines[^=]*=/, '').replace(/;\s*$/, '');
  body = body.replace(
    '...Object.keys(sourceLanguages)',
    JSON.stringify(Object.keys(sourceLanguages)).slice(1, -1),
  );
  return Function(`return (${body})`)();
}

function sourceLanguagesFromSource(source) {
  const body = source.slice(
    source.indexOf('{', source.indexOf('const groups')),
    source.indexOf('export const sourceLanguages'),
  );
  const groups = Function(`return (${body.replace(/;\s*$/, '')})`)();
  return Object.fromEntries(
    Object.entries(groups).flatMap(([language, aliases]) =>
      aliases.split(' ').map((ext) => [ext, language]),
    ),
  );
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value;
}
function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1)
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}
function scenePng() {
  const width = 640;
  const height = 360;
  const pixels = Buffer.alloc(width * height * 4, 255);
  const paint = (x, y, red, green, blue) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * 4;
    pixels[offset] = red;
    pixels[offset + 1] = green;
    pixels[offset + 2] = blue;
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sky = y / height;
      let red = 214 - sky * 28;
      let green = 196 - sky * 18;
      let blue = 168 - sky * 8;
      const sunX = x - 470;
      const sunY = y - 78;
      if (sunX * sunX + sunY * sunY < 34 * 34) {
        red = 236;
        green = 196;
        blue = 122;
      }
      const far = 168 + Math.sin(x * 0.012) * 16 + Math.sin(x * 0.004) * 22;
      if (y > far) {
        red = 126;
        green = 148;
        blue = 132;
      }
      const near = 230 + Math.sin(x * 0.02 + 1.2) * 14;
      if (y > near) {
        red = 62;
        green = 96;
        blue = 84;
      }
      if (y > 312) {
        red = 214;
        green = 206;
        blue = 190;
      }
      if (x > 86 && x < 214 && y > 176 && y < 292) {
        red = 228;
        green = 220;
        blue = 206;
      }
      if (x > 108 && x < 132 && y > 214 && y < 292) {
        red = 92;
        green = 78;
        blue = 64;
      }
      if (
        (x > 128 && x < 168 && y > 196 && y < 220) ||
        (x > 128 && x < 168 && y > 232 && y < 256)
      ) {
        red = 168;
        green = 188;
        blue = 186;
      }
      paint(x, y, red, green, blue);
    }
  }
  return png(width, height, pixels);
}

function xml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const report = [
  '# 2026 年第三季度销售简报',
  '',
  '滨江文具在 7 月到 9 月记录了 180 笔门店订单。这份简报只汇总已经入账的零售单，不包含内部调拨和退货草稿。',
  '',
  `四个门店合计销售额 ${totalAmount.toLocaleString('zh-CN')} 元。湖滨店的客单更高，大学城店的订单更密，城西店在 8 月下旬有一次帆布袋补货。`,
  '',
  '## 门店对照',
  '',
  '| 门店 | 订单数 | 销售额 |',
  '| --- | ---: | ---: |',
  ...storeTotals.map((item) => `| ${item.store} | ${item.count} | ${item.amount} |`),
  '',
  '## 需要跟进',
  '',
  '- 滨江店的钢笔库存只够两周，下一批到货写在 10 月 8 日。',
  '- 便签贴毛利低，但大学城店每周都能走完一小箱。',
  '- 牛皮纸袋有 6 笔数量为 1 的订单，更像是搭配销售，不适合单独补很多货。',
  '',
  '## 摘录',
  '',
  '完整明细在同目录的销售清单里。下面是按订单号排序后的前 12 笔。',
  '',
  '| 单号 | 日期 | 门店 | 商品 | 数量 | 金额 |',
  '| --- | --- | --- | --- | ---: | ---: |',
  ...orders
    .slice(0, 12)
    .map(
      (order) =>
        `| ${order.id} | ${order.date} | ${order.store} | ${order.goods} | ${order.qty} | ${order.amount} |`,
    ),
  '',
  '查阅时以表格文件为准。如果某一行和收据不一致，先保留收据，再回来改这张清单。',
  '',
].join('\n');

function csvTable() {
  const lines = ['单号,日期,门店,商品,数量,单价,金额'];
  for (const order of orders)
    lines.push(
      [order.id, order.date, order.store, order.goods, order.qty, order.price, order.amount].join(
        ',',
      ),
    );
  return lines.join('\n') + '\n';
}
function delimited(ext) {
  const separator = ext === 'tsv' || ext === 'tab' ? '\t' : ext === 'psv' ? '|' : ',';
  return text(csvTable().replaceAll(',', separator));
}

function codeSample(language) {
  const rows = orders.slice(0, 18);
  if (['javascript', 'typescript'].includes(language)) {
    const body = rows
      .map(
        (order) =>
          `  { id: ${order.id}, store: "${order.store}", goods: "${order.goods}", amount: ${order.amount} },`,
      )
      .join('\n');
    return `/** 第三季度已入账订单摘录。 */\nexport interface Order {\n  id: number;\n  store: string;\n  goods: string;\n  amount: number;\n}\n\nconst orders: Order[] = [\n${body}\n];\n\nexport function total(rows: Order[]) {\n  return rows.reduce((sum, row) => sum + row.amount, 0);\n}\n\nconst byStore = new Map<string, number>();\nfor (const row of orders) byStore.set(row.store, (byStore.get(row.store) ?? 0) + row.amount);\n\nconsole.log("合计", total(orders));\nfor (const [store, amount] of byStore) console.log(store, amount);\n`;
  }
  if (language === 'python') {
    const body = rows
      .map(
        (order) =>
          `    {"id": ${order.id}, "store": "${order.store}", "goods": "${order.goods}", "amount": ${order.amount}},`,
      )
      .join('\n');
    return `# 第三季度已入账订单摘录\norders = [\n${body}\n]\n\ndef total(rows):\n    return sum(row["amount"] for row in rows)\n\nby_store = {}\nfor row in orders:\n    by_store[row["store"]] = by_store.get(row["store"], 0) + row["amount"]\n\nprint("合计", total(orders))\nfor store, amount in by_store.items():\n    print(store, amount)\n`;
  }
  if (language === 'sql') {
    return (
      'CREATE TABLE orders (id INTEGER PRIMARY KEY, sold_on TEXT, store TEXT, goods TEXT, qty INTEGER, price INTEGER, amount INTEGER);\n' +
      orders
        .map(
          (order) =>
            `INSERT INTO orders VALUES (${order.id}, '${order.date}', '${order.store}', '${order.goods}', ${order.qty}, ${order.price}, ${order.amount});`,
        )
        .join('\n') +
      '\n'
    );
  }
  if (['json', 'jsonc'].includes(language) || language === 'plaintext') return '';
  if (language === 'yaml') {
    return (
      orders
        .slice(0, 24)
        .map(
          (order) =>
            `- id: ${order.id}\n  date: ${order.date}\n  store: ${order.store}\n  goods: ${order.goods}\n  qty: ${order.qty}\n  amount: ${order.amount}`,
        )
        .join('\n') + '\n'
    );
  }
  if (language === 'xml') {
    const body = orders
      .slice(0, 24)
      .map(
        (order) =>
          `  <order id="${order.id}" date="${order.date}" store="${xml(order.store)}" goods="${xml(order.goods)}" qty="${order.qty}" amount="${order.amount}"/>`,
      )
      .join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>\n<orders quarter="2026-Q3">\n${body}\n</orders>\n`;
  }
  if (language === 'ini') {
    return storeTotals
      .map(
        (item, index) =>
          `[${item.store}]\norders=${item.count}\namount=${item.amount}\nowner=门店${index + 1}\n`,
      )
      .join('\n');
  }
  if (language === 'toml') {
    return storeTotals
      .map(
        (item) =>
          `[[store]]\nname = "${item.store}"\norders = ${item.count}\namount = ${item.amount}\n`,
      )
      .join('\n');
  }
  if (language === 'css' || language === 'scss' || language === 'less') {
    return `:root {\n  --paper: #f4efe6;\n  --ink: #24312c;\n  --line: #d5cbbd;\n}\n\nbody {\n  margin: 0;\n  background: var(--paper);\n  color: var(--ink);\n  font-family: "Source Han Sans SC", sans-serif;\n}\n\n.report {\n  width: min(880px, calc(100% - 48px));\n  margin: 32px auto;\n}\n\n.report h1 {\n  font-size: 32px;\n  font-weight: 560;\n}\n\ntable {\n  width: 100%;\n  border-collapse: collapse;\n}\n\ntd, th {\n  border-bottom: 1px solid var(--line);\n  padding: 8px 0;\n  text-align: left;\n}\n`;
  }
  if (language === 'html') return '';
  const comment = [
    'ruby',
    'shell',
    'bash',
    'powershell',
    'perl',
    'r',
    'julia',
    'lua',
    'dockerfile',
  ].includes(language)
    ? '#'
    : '//';
  const literals = rows
    .map(
      (order) =>
        `${comment} ${order.id} ${order.date} ${order.store} ${order.goods} ${order.amount}`,
    )
    .join('\n');
  return `${comment} 第三季度订单摘录，供预览语法高亮\n${literals}\n\n${comment} 合计 ${totalAmount}\n`;
}

function textFor(ext, language) {
  if (['json', 'jsonc', 'geojson', 'har'].includes(ext) || language === 'json') {
    if (ext === 'geojson') {
      return JSON.stringify(
        {
          type: 'FeatureCollection',
          features: stores.map((store, index) => ({
            type: 'Feature',
            properties: { name: store, amount: storeTotals[index].amount },
            geometry: { type: 'Point', coordinates: [120.1 + index * 0.03, 30.2 + index * 0.01] },
          })),
        },
        null,
        2,
      );
    }
    if (ext === 'har') {
      return JSON.stringify(
        {
          log: {
            version: '1.2',
            creator: { name: 'SpacePreview', version: '0.10.18' },
            entries: orders.slice(0, 8).map((order) => ({
              startedDateTime: `${order.date}T09:12:00+08:00`,
              request: { method: 'GET', url: `https://shop.local/orders/${order.id}` },
              response: {
                status: 200,
                content: { mimeType: 'application/json', text: JSON.stringify(order) },
              },
            })),
          },
        },
        null,
        2,
      );
    }
    return JSON.stringify(orders, null, 2) + '\n';
  }
  if (ext === 'jsonl' || ext === 'ndjson')
    return orders.map((order) => JSON.stringify(order)).join('\n') + '\n';
  if (ext === 'log') {
    return (
      orders
        .slice(0, 80)
        .map((order, index) => {
          const hour = String(8 + (index % 10)).padStart(2, '0');
          const minute = String((index * 7) % 60).padStart(2, '0');
          return `${order.date} ${hour}:${minute}:18 INFO 入账 ${order.id} ${order.store} ${order.goods} x${order.qty} ${order.amount}元`;
        })
        .join('\n') + '\n'
    );
  }
  if (['txt', 'text', 'readme', 'mdtxt', 'mdtext'].includes(ext)) return report + '\n';
  if (ext === 'license') {
    return 'MIT License\n\nCopyright (c) 2026 滨江文具\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, subject to the conditions in the full license text.\n';
  }
  const sample = codeSample(language);
  if (sample) return sample;
  return report + '\n';
}

function pdf() {
  const lines = [
    'Q3 2026 store report',
    '',
    `180 posted orders. Total ${totalAmount} CNY.`,
    ...storeTotals.map((item) => `${item.store}  ${item.count} orders  ${item.amount} CNY`),
    '',
    'Follow-up',
    'Binjiang needs more pens before 8 October.',
    'Campus store sells sticky notes every week.',
    'Paper bags are usually sold together with other goods.',
    '',
    'First posted orders',
    ...orders
      .slice(0, 28)
      .map((order) => `${order.id}  ${order.date}  ${order.goods}  ${order.amount}`),
  ];
  const stream = lines
    .map((line, index) => {
      const y = 760 - index * 16;
      return `BT /F1 11 Tf 48 ${y} Td (${line.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)')}) Tj ET`;
    })
    .join('\n');
  const objects = [
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n',
    '2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n',
    `4 0 obj<</Length ${Buffer.byteLength(stream) + 1}>>stream\n${stream}\nendstream\nendobj\n`,
    '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(body));
    body += object;
  }
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1)
    body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  body += `trailer<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return text(body);
}

function paragraphs(source) {
  return source
    .split(/\n{2,}/)
    .map((block) => block.replace(/^#+\s*/gm, '').trim())
    .filter((block) => block && !block.startsWith('|') && !block.startsWith('- '));
}
function docx() {
  const blocks = paragraphs(report)
    .map((paragraph) => `<w:p><w:r><w:t xml:space="preserve">${xml(paragraph)}</w:t></w:r></w:p>`)
    .join('');
  const table = storeTotals
    .map(
      (item) =>
        `<w:tr><w:tc><w:p><w:r><w:t>${xml(item.store)}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${item.count}</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>${item.amount}</w:t></w:r></w:p></w:tc></w:tr>`,
    )
    .join('');
  return zip({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    ),
    'word/document.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${blocks}<w:tbl>${table}</w:tbl></w:body></w:document>`,
    ),
  });
}
function slide(title, lines) {
  const paragraphsXml = [title, ...lines]
    .map((line) => `<a:p><a:r><a:t>${xml(line)}</a:t></a:r></a:p>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${paragraphsXml}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
}
function pptx() {
  const slides = [
    slide('第三季度销售简报', [
      `180 笔已入账订单`,
      `合计 ${totalAmount} 元`,
      '范围：7 月到 9 月的零售单',
    ]),
    slide(
      '门店对照',
      storeTotals.map((item) => `${item.store}：${item.count} 笔，${item.amount} 元`),
    ),
    slide('跟进', [
      '钢笔要在 10 月 8 日前补到滨江店',
      '便签贴按大学城店的周销量补',
      '纸袋不单独压货',
    ]),
  ];
  const entries = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join('')}</Types>`,
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/></Relationships>',
    ),
    'ppt/presentation.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst>${slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 1}"/>`).join('')}</p:sldIdLst></p:presentation>`,
    ),
    'ppt/_rels/presentation.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join('')}</Relationships>`,
    ),
  };
  slides.forEach((value, index) => {
    entries[`ppt/slides/slide${index + 1}.xml`] = strToU8(value);
  });
  return zip(entries);
}
function odt() {
  const body = paragraphs(report)
    .map((paragraph) => `<text:p>${xml(paragraph)}</text:p>`)
    .join('');
  return zip({
    'content.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text>${body}</office:text></office:body></office:document-content>`,
    ),
  });
}
function odp() {
  const pages = storeTotals
    .map(
      (item) =>
        `<draw:page draw:name="${xml(item.store)}"><draw:frame><draw:text-box><text:p>${xml(item.store)}</text:p><text:p>${item.count} 笔，${item.amount} 元</text:p></draw:text-box></draw:frame></draw:page>`,
    )
    .join('');
  return zip({
    'content.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:presentation>${pages}</office:presentation></office:body></office:document-content>`,
    ),
  });
}
function epub() {
  const body = paragraphs(report)
    .map((paragraph) => `<p>${xml(paragraph)}</p>`)
    .join('');
  return zip({
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
    'META-INF/container.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    ),
    'OEBPS/package.opf': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book">urn:uuid:6f7b032e-fb24-4c49-a8e1-67dfc884cc52</dc:identifier><dc:title>第三季度销售简报</dc:title><dc:language>zh-CN</dc:language><meta property="dcterms:modified">2026-11-07T00:00:00Z</meta></metadata><manifest><item id="chapter" href="content.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/></manifest><spine><itemref idref="chapter"/></spine></package>',
    ),
    'OEBPS/nav.xhtml': strToU8(
      '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><ol><li><a href="content.xhtml">销售简报</a></li></ol></nav></body></html>',
    ),
    'OEBPS/content.xhtml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>第三季度销售简报</title></head><body><h1>第三季度销售简报</h1>${body}</body></html>`,
    ),
  });
}
function ofd() {
  const lines = [
    `180 笔订单，合计 ${totalAmount} 元`,
    ...storeTotals.map((item) => `${item.store} ${item.amount} 元`),
  ];
  const textObjects = lines
    .map(
      (line, index) =>
        `<TextObject ID="${index + 1}" Boundary="18 ${24 + index * 12} 160 10"><TextCode>${xml(line)}</TextCode></TextObject>`,
    )
    .join('');
  return zip({
    'OFD.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><OFD><DocBody><DocInfo><Title>第三季度销售简报</Title></DocInfo><DocRoot>Doc_0/Document.xml</DocRoot></DocBody></OFD>',
    ),
    'Doc_0/Document.xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Document><CommonData><PageArea><PhysicalBox>0 0 210 297</PhysicalBox></PageArea></CommonData><Pages><Page ID="1" BaseLoc="Pages/Page_0/Content.xml"/></Pages></Document>',
    ),
    'Doc_0/Pages/Page_0/Content.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><Page><Content><Layer>${textObjects}</Layer></Content></Page>`,
    ),
  });
}
function fb2() {
  const sections = paragraphs(report)
    .map(
      (paragraph) =>
        `<section><title><p>${xml(paragraph.slice(0, 24))}</p></title><p>${xml(paragraph)}</p></section>`,
    )
    .join('');
  return text(
    `<?xml version="1.0" encoding="utf-8"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><book-title>第三季度销售简报</book-title><author><first-name>滨江</first-name><last-name>文具</last-name></author></title-info></description><body>${sections}</body></FictionBook>\n`,
  );
}
function rtf() {
  const body = paragraphs(report)
    .map((paragraph) =>
      [...paragraph]
        .map((char) => {
          const code = char.codePointAt(0);
          if (char === '\\' || char === '{' || char === '}') return `\\${char}`;
          if (code < 128) return char;
          return `\\u${code > 32767 ? code - 65536 : code}?`;
        })
        .join(''),
    )
    .join('\\par\n');
  return text(`{\\rtf1\\ansi\\ansicpg65001\\deff0\\pard ${body}\\par}\n`);
}
function htmlPage() {
  const rows = orders
    .slice(0, 20)
    .map(
      (order) =>
        `<tr><td>${order.id}</td><td>${order.date}</td><td>${xml(order.store)}</td><td>${xml(order.goods)}</td><td>${order.amount}</td></tr>`,
    )
    .join('');
  return text(
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>第三季度销售简报</title><style>body{margin:32px;font-family:"Source Han Sans SC",sans-serif;background:#f4efe6;color:#24312c}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #d5cbbd;padding:8px;text-align:left}</style><body><h1>第三季度销售简报</h1><p>180 笔已入账订单，合计 ${totalAmount} 元。</p><table><tr><th>单号</th><th>日期</th><th>门店</th><th>商品</th><th>金额</th></tr>${rows}</table></body></html>\n`,
  );
}
function eml() {
  return text(
    [
      'From: 店长 <shop@binjiang.local>',
      'To: 采购 <buy@binjiang.local>',
      'Subject: 第三季度销售简报',
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      '',
      report,
      '',
    ].join('\r\n'),
  );
}
function mhtml() {
  return text(
    `From: <saved@binjiang.local>\r\nSubject: 第三季度销售简报\r\nMIME-Version: 1.0\r\nContent-Type: multipart/related; boundary="preview"\r\n\r\n--preview\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${htmlPage().toString('utf8')}\r\n--preview--\r\n`,
  );
}
function notebook() {
  return text(
    JSON.stringify(
      {
        nbformat: 4,
        nbformat_minor: 5,
        metadata: { kernelspec: { name: 'python3', display_name: 'Python 3' } },
        cells: [
          {
            cell_type: 'markdown',
            metadata: {},
            source: report.split('\n').map((line) => line + '\n'),
          },
          {
            cell_type: 'code',
            metadata: {},
            execution_count: 1,
            source: ['orders = 180\n', `total = ${totalAmount}\n`, 'print(total / orders)\n'],
            outputs: [
              {
                output_type: 'stream',
                name: 'stdout',
                text: [`${(totalAmount / orders.length).toFixed(2)}\n`],
              },
            ],
          },
        ],
      },
      null,
      2,
    ) + '\n',
  );
}

const box = {
  vertices: [
    [0, 0, 0],
    [40, 0, 0],
    [40, 24, 0],
    [0, 24, 0],
    [0, 0, 30],
    [40, 0, 30],
    [40, 24, 30],
    [0, 24, 30],
  ],
  faces: [
    [0, 1, 2],
    [0, 2, 3],
    [4, 6, 5],
    [4, 7, 6],
    [0, 4, 5],
    [0, 5, 1],
    [1, 5, 6],
    [1, 6, 2],
    [2, 6, 7],
    [2, 7, 3],
    [3, 7, 4],
    [3, 4, 0],
  ],
};
function stl() {
  const facets = box.faces
    .map((face) => {
      const points = face.map((index) => box.vertices[index].join(' '));
      return `facet normal 0 0 0\nouter loop\n${points.map((point) => `vertex ${point}`).join('\n')}\nendloop\nendfacet`;
    })
    .join('\n');
  return text(`solid shop\n${facets}\nendsolid shop\n`);
}
function obj() {
  return text(
    box.vertices.map((vertex) => `v ${vertex.join(' ')}`).join('\n') +
      '\n' +
      box.faces.map((face) => `f ${face.map((index) => index + 1).join(' ')}`).join('\n') +
      '\n',
  );
}
function ply() {
  return text(
    `ply\nformat ascii 1.0\nelement vertex ${box.vertices.length}\nproperty float x\nproperty float y\nproperty float z\nelement face ${box.faces.length}\nproperty list uchar int vertex_indices\nend_header\n` +
      box.vertices.map((vertex) => vertex.join(' ')).join('\n') +
      '\n' +
      box.faces.map((face) => `3 ${face.join(' ')}`).join('\n') +
      '\n',
  );
}
function gltfDocument() {
  const positions = Buffer.from(new Float32Array(box.vertices.flat()).buffer).toString('base64');
  const indices = Buffer.from(new Uint16Array(box.faces.flat()).buffer).toString('base64');
  const positionBytes = box.vertices.length * 12;
  return JSON.stringify(
    {
      asset: { version: '2.0' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: '柜台' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      buffers: [
        { uri: `data:application/octet-stream;base64,${positions}`, byteLength: positionBytes },
        {
          uri: `data:application/octet-stream;base64,${indices}`,
          byteLength: box.faces.length * 6,
        },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positionBytes, target: 34962 },
        { buffer: 1, byteOffset: 0, byteLength: box.faces.length * 6, target: 34963 },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: box.vertices.length,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [40, 24, 30],
        },
        { bufferView: 1, componentType: 5123, count: box.faces.length * 3, type: 'SCALAR' },
      ],
    },
    null,
    2,
  );
}
function glb() {
  const positions = new Float32Array(box.vertices.flat());
  const indices = new Uint16Array(box.faces.flat());
  const bin = Buffer.concat([Buffer.from(positions.buffer), Buffer.from(indices.buffer)]);
  const pad = (length) => (4 - (length % 4)) % 4;
  const json = Buffer.from(
    JSON.stringify({
      asset: { version: '2.0', generator: 'SpacePreview examples' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ mesh: 0, name: '柜台' }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
      buffers: [{ byteLength: bin.length }],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
        {
          buffer: 0,
          byteOffset: positions.byteLength,
          byteLength: indices.byteLength,
          target: 34963,
        },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: box.vertices.length,
          type: 'VEC3',
          min: [0, 0, 0],
          max: [40, 24, 30],
        },
        { bufferView: 1, componentType: 5123, count: indices.length, type: 'SCALAR' },
      ],
    }),
  );
  const jsonPad = Buffer.alloc(pad(json.length), 0x20);
  const binPad = Buffer.alloc(pad(bin.length));
  const jsonChunk = Buffer.concat([Buffer.alloc(8), json, jsonPad]);
  jsonChunk.writeUInt32LE(json.length + jsonPad.length, 0);
  jsonChunk.write('JSON', 4);
  const binChunk = Buffer.concat([Buffer.alloc(8), bin, binPad]);
  binChunk.writeUInt32LE(bin.length + binPad.length, 0);
  binChunk.write('BIN\0', 4);
  const header = Buffer.alloc(12);
  header.write('glTF', 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + jsonChunk.length + binChunk.length, 8);
  return Buffer.concat([header, jsonChunk, binChunk]);
}
function dae() {
  const positions = box.vertices.flat().join(' ');
  const triangles = box.faces.flat().join(' ');
  return text(
    `<?xml version="1.0" encoding="UTF-8"?><COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><unit meter="0.001" name="millimeter"/><up_axis>Z_UP</up_axis></asset><library_geometries><geometry id="counter" name="柜台"><mesh><source id="positions"><float_array id="positions-array" count="${box.vertices.length * 3}">${positions}</float_array><technique_common><accessor source="#positions-array" count="${box.vertices.length}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="vertices"><input semantic="POSITION" source="#positions"/></vertices><triangles count="${box.faces.length}"><input semantic="VERTEX" source="#vertices" offset="0"/><p>${triangles}</p></triangles></mesh></geometry></library_geometries><library_visual_scenes><visual_scene id="scene"><node name="柜台"><instance_geometry url="#counter"/></node></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#scene"/></scene></COLLADA>\n`,
  );
}
function threeMf() {
  const vertices = box.vertices
    .map((vertex) => `<vertex x="${vertex[0]}" y="${vertex[1]}" z="${vertex[2]}"/>`)
    .join('');
  const triangles = box.faces
    .map((face) => `<triangle v1="${face[0]}" v2="${face[1]}" v3="${face[2]}"/>`)
    .join('');
  return zip({
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/></Relationships>',
    ),
    '3D/3dmodel.model': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="zh-CN" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model" name="柜台"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`,
    ),
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Override PartName="/3D/3dmodel.model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
    ),
  });
}
function pcd() {
  const points = [];
  for (let index = 0; index < 240; index += 1) {
    const angle = (index / 240) * Math.PI * 2;
    points.push(
      `${(Math.cos(angle) * 20).toFixed(3)} ${(Math.sin(angle) * 12).toFixed(3)} ${((index % 12) * 1.5).toFixed(3)}`,
    );
  }
  return text(
    `# .PCD v0.7 - Point Cloud Data file format\nVERSION 0.7\nFIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH ${points.length}\nHEIGHT 1\nVIEWPOINT 0 0 0 1 0 0 0\nPOINTS ${points.length}\nDATA ascii\n${points.join('\n')}\n`,
  );
}
function dxf() {
  const lines = ['0', 'SECTION', '2', 'ENTITIES'];
  const segments = [
    [0, 0, 8000, 0],
    [8000, 0, 8000, 6000],
    [8000, 6000, 0, 6000],
    [0, 6000, 0, 0],
    [2000, 0, 2000, 4000],
    [2000, 4000, 6000, 4000],
  ];
  for (const [x1, y1, x2, y2] of segments)
    lines.push(
      '0',
      'LINE',
      '8',
      'Walls',
      '10',
      String(x1),
      '20',
      String(y1),
      '11',
      String(x2),
      '21',
      String(y2),
    );
  lines.push(
    '0',
    'TEXT',
    '8',
    'Labels',
    '10',
    '3000',
    '20',
    '2500',
    '40',
    '250',
    '1',
    'Demo floor plan',
    '0',
    'ENDSEC',
    '0',
    'EOF',
  );
  return text(lines.join('\n') + '\n');
}

function wav() {
  const rate = 22050;
  const seconds = 2;
  const count = rate * seconds;
  const data = Buffer.alloc(count * 2);
  for (let index = 0; index < count; index += 1) {
    const envelope = Math.min(1, index / 800, (count - index) / 800);
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * index) / rate) * 9000 * envelope);
    data.writeInt16LE(sample, index * 2);
  }
  const bytes = Buffer.alloc(44 + data.length);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(36 + data.length, 4);
  bytes.write('WAVE', 8);
  bytes.write('fmt ', 12);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(data.length, 40);
  data.copy(bytes, 44);
  return bytes;
}
function lottie() {
  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 90,
    w: 640,
    h: 360,
    nm: '门店标记',
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: '标记',
        sr: 1,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: {
            a: 1,
            k: [
              { t: 0, s: [80, 180, 0], i: { x: [0.4], y: [1] }, o: { x: [0.4], y: [0] } },
              { t: 90, s: [520, 180, 0] },
            ],
          },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ao: 0,
        shapes: [
          {
            ty: 'rc',
            p: { a: 0, k: [0, 0] },
            s: { a: 0, k: [72, 48] },
            r: { a: 0, k: 6 },
            nm: '牌',
          },
          { ty: 'fl', c: { a: 0, k: [0.24, 0.45, 0.4, 1] }, o: { a: 0, k: 100 }, nm: '填充' },
        ],
        ip: 0,
        op: 90,
        st: 0,
      },
    ],
  };
}

function tar(entries) {
  const parts = [];
  for (const [name, payload] of entries) {
    const header = Buffer.alloc(512);
    const field = (offset, length, value) => header.write(value.slice(0, length), offset, 'latin1');
    field(0, 100, name);
    field(100, 8, '0000644');
    field(108, 8, '0000000');
    field(116, 8, '0000000');
    field(124, 12, payload.length.toString(8).padStart(11, '0'));
    field(136, 12, '00000000000');
    field(148, 8, '        ');
    field(156, 1, '0');
    field(257, 6, 'ustar');
    field(263, 2, '00');
    const checksum = [...header]
      .reduce((sum, value) => sum + value, 0)
      .toString(8)
      .padStart(6, '0');
    field(148, 8, `${checksum}\0 `);
    parts.push(header, payload, Buffer.alloc((512 - (payload.length % 512)) % 512));
  }
  parts.push(Buffer.alloc(1024));
  return Buffer.concat(parts);
}
function asar(payload, name) {
  const json = Buffer.from(
    JSON.stringify({ files: { [name]: { size: payload.length, offset: '0' } } }),
  );
  const header = Buffer.alloc(16 + json.length);
  header.writeUInt32LE(4, 0);
  header.writeUInt32LE(8 + json.length, 4);
  header.writeUInt32LE(json.length, 8);
  header.writeUInt32LE(json.length, 12);
  json.copy(header, 16);
  return Buffer.concat([header, payload]);
}
function crx(zipBytes) {
  const header = Buffer.alloc(12);
  header.write('Cr24', 0);
  header.writeUInt32LE(3, 4);
  header.writeUInt32LE(0, 8);
  return Buffer.concat([header, zipBytes]);
}
function pak(payload) {
  const headerSize = 21;
  const bytes = Buffer.alloc(headerSize + payload.length);
  bytes.writeUInt32LE(4, 0);
  bytes.writeUInt32LE(1, 4);
  bytes.writeUInt16LE(1, 9);
  bytes.writeUInt32LE(headerSize, 11);
  bytes.writeUInt16LE(0, 15);
  bytes.writeUInt32LE(headerSize + payload.length, 17);
  payload.copy(bytes, headerSize);
  return bytes;
}
function xar(payload) {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><xar><toc><file><name>简报.md</name><type>file</type><data><offset>0</offset><size>${payload.length}</size><length>${payload.length}</length><encoding style="application/octet-stream"/></data></file></toc></xar>`;
  const raw = strToU8(xml);
  const compressed = Buffer.from(zlibSync(raw));
  const bytes = Buffer.alloc(28 + compressed.length + payload.length);
  bytes.write('xar!', 0);
  bytes.writeUInt16BE(28, 4);
  bytes.writeUInt16BE(1, 6);
  bytes.writeBigUInt64BE(BigInt(compressed.length), 8);
  bytes.writeBigUInt64BE(BigInt(raw.length), 16);
  compressed.copy(bytes, 28);
  payload.copy(bytes, 28 + compressed.length);
  return bytes;
}
function ar(name, payload) {
  const header = Buffer.alloc(60, 0x20);
  header.write(name.padEnd(16, ' ').slice(0, 16), 0, 'latin1');
  header.write('0'.padEnd(12, ' '), 16, 'latin1');
  header.write('0'.padEnd(6, ' '), 28, 'latin1');
  header.write('0'.padEnd(6, ' '), 34, 'latin1');
  header.write('100644'.padEnd(8, ' '), 40, 'latin1');
  header.write(String(payload.length).padStart(10, ' '), 48, 'latin1');
  header.write('`\n', 58, 'latin1');
  return Buffer.concat([
    Buffer.from('!<arch>\n'),
    header,
    payload,
    payload.length % 2 ? Buffer.from([0x0a]) : Buffer.alloc(0),
  ]);
}
function cpio(name, payload) {
  const header = (fileName, file) => {
    const fields = [
      '070701',
      '00000001',
      '000081A4',
      '00000000',
      '00000000',
      '00000001',
      '00000000',
      file.length.toString(16).padStart(8, '0'),
      '00000000',
      '00000000',
      '00000000',
      '00000000',
      Buffer.byteLength(fileName).toString(16).padStart(8, '0'),
      '00000000',
    ].join('');
    const nameBytes = Buffer.from(fileName);
    const headerBytes = Buffer.concat([Buffer.from(fields), nameBytes]);
    return Buffer.concat([
      headerBytes,
      Buffer.alloc((4 - (headerBytes.length % 4)) % 4),
      file,
      Buffer.alloc((4 - (file.length % 4)) % 4),
    ]);
  };
  return Buffer.concat([header(`${name}\0`, payload), header('TRAILER!!!\0', Buffer.alloc(0))]);
}
function emf() {
  const width = 640;
  const height = 360;
  const bytes = Buffer.alloc(88 + 24 + 20);
  bytes.writeUInt32LE(1, 0);
  bytes.writeUInt32LE(88, 4);
  bytes.writeInt32LE(width, 16);
  bytes.writeInt32LE(height, 20);
  bytes.writeInt32LE(width * 26, 32);
  bytes.writeInt32LE(height * 26, 36);
  bytes.writeUInt32LE(0x464d4520, 40);
  bytes.writeUInt32LE(0x00010000, 44);
  bytes.writeUInt32LE(bytes.length, 48);
  bytes.writeUInt32LE(3, 52);
  bytes.writeUInt16LE(1, 56);
  bytes.writeUInt32LE(1920, 72);
  bytes.writeUInt32LE(1080, 76);
  bytes.writeUInt32LE(320, 80);
  bytes.writeUInt32LE(180, 84);
  bytes.writeUInt32LE(43, 88);
  bytes.writeUInt32LE(24, 92);
  bytes.writeInt32LE(80, 96);
  bytes.writeInt32LE(60, 100);
  bytes.writeInt32LE(420, 104);
  bytes.writeInt32LE(260, 108);
  bytes.writeUInt32LE(14, 112);
  bytes.writeUInt32LE(20, 116);
  bytes.writeUInt32LE(20, 128);
  return bytes;
}
function wmf() {
  const records = Buffer.alloc(18 + 14 + 6);
  records.writeUInt16LE(1, 0);
  records.writeUInt16LE(9, 2);
  records.writeUInt16LE(0x0300, 4);
  records.writeUInt32LE(records.length / 2, 6);
  records.writeUInt16LE(0, 10);
  records.writeUInt32LE(7, 12);
  records.writeUInt16LE(0, 16);
  records.writeUInt32LE(7, 18);
  records.writeUInt16LE(0x041b, 22);
  records.writeInt16LE(200, 24);
  records.writeInt16LE(320, 26);
  records.writeInt16LE(40, 28);
  records.writeInt16LE(40, 30);
  records.writeUInt32LE(3, 32);
  records.writeUInt16LE(0, 36);
  const placeable = Buffer.alloc(22);
  placeable.writeUInt32LE(0x9ac6cdd7, 0);
  placeable.writeInt16LE(0, 6);
  placeable.writeInt16LE(0, 8);
  placeable.writeInt16LE(320, 10);
  placeable.writeInt16LE(200, 12);
  placeable.writeUInt16LE(1440, 14);
  let checksum = 0;
  for (let offset = 0; offset < 20; offset += 2) checksum ^= placeable.readUInt16LE(offset);
  placeable.writeUInt16LE(checksum, 20);
  return Buffer.concat([placeable, records]);
}
function compress(kind, payload) {
  const result = spawnSync(
    'python',
    [
      '-c',
      'import sys,bz2,lzma; data=sys.stdin.buffer.read(); kind=sys.argv[1]; sys.stdout.buffer.write(bz2.compress(data) if kind=="bz2" else lzma.compress(data, format=lzma.FORMAT_XZ) if kind=="xz" else lzma.compress(data, format=lzma.FORMAT_ALONE))',
      kind,
    ],
    { input: payload },
  );
  return result.status === 0 ? result.stdout : null;
}

const magickNames = {
  jpg: 'Jpeg',
  jpeg: 'Jpeg',
  jfif: 'Jpeg',
  tif: 'Tiff',
  tiff: 'Tiff',
  fit: 'Fits',
  fits: 'Fits',
  dcm: 'Dcm',
  dicom: 'Dcm',
  heic: 'Heic',
  heif: 'Heif',
  j2k: 'J2k',
  jpc: 'J2k',
  jp2: 'Jp2',
  jpf: 'Jp2',
  jpx: 'Jp2',
  webp: 'WebP',
  ico: 'Ico',
  avif: 'Avif',
  apng: 'Png',
  arw: 'Arw',
  cr2: 'Cr2',
  cr3: 'Cr3',
  dng: 'Dng',
  nef: 'Nef',
  orf: 'Orf',
  pef: 'Pef',
  raf: 'Raf',
  xcf: 'Xcf',
  icns: 'Icns',
};
const encoded = new Map();
function magick(ext, source) {
  const key = magickNames[ext] ?? ext.charAt(0).toUpperCase() + ext.slice(1);
  if (encoded.has(key)) return encoded.get(key);
  const format = MagickFormat[key];
  if (format === undefined) {
    encoded.set(key, null);
    return null;
  }
  try {
    const bytes = Buffer.from(
      ImageMagick.read(source, MagickFormat.Png, (image) => {
        image.quality = 82;
        return image.write(format, (data) => Uint8Array.from(data));
      }),
    );
    encoded.set(key, bytes);
    return bytes;
  } catch {
    encoded.set(key, null);
    return null;
  }
}

function sheet(XLSX, bookType) {
  const rows = [
    ['单号', '日期', '门店', '商品', '数量', '单价', '金额'],
    ...orders.map((order) => [
      order.id,
      order.date,
      order.store,
      order.goods,
      order.qty,
      order.price,
      order.amount,
    ]),
  ];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), '第三季度');
  return Buffer.from(XLSX.write(book, { type: 'buffer', bookType }));
}

const source = await readFile(join(root, 'src/lib/files.ts'), 'utf8');
const languages = sourceLanguagesFromSource(
  await readFile(join(root, 'src/lib/source-languages.ts'), 'utf8'),
);
const engines = enginesFromSource(source, languages);
const selected = [];
const seen = new Set();
for (const engine of engines) {
  for (const ext of engine.extensions) {
    if (seen.has(ext)) continue;
    seen.add(ext);
    selected.push({ ext, kind: engine.kind });
  }
}

await mkdir(destination, { recursive: true });

await initializeImageMagick(
  await readFile(join(root, 'node_modules/@imagemagick/magick-wasm/dist/x86/magick.wasm')),
);
const picture = scenePng();
const XLSX = require('xlsx');
const sheets = {};
for (const bookType of ['xlsx', 'xls', 'xlsb', 'dbf', 'dif', 'sylk', 'ods']) {
  try {
    sheets[bookType] = sheet(XLSX, bookType);
  } catch {
    sheets[bookType] = null;
  }
}
const SQL = await initSqlJs();
const database = new SQL.Database();
database.run(
  'CREATE TABLE orders (id INTEGER PRIMARY KEY, sold_on TEXT, store TEXT, goods TEXT, qty INTEGER, price INTEGER, amount INTEGER)',
);
database.run('CREATE TABLE stores (name TEXT PRIMARY KEY, orders INTEGER, amount INTEGER)');
for (const order of orders)
  database.run('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)', [
    order.id,
    order.date,
    order.store,
    order.goods,
    order.qty,
    order.price,
    order.amount,
  ]);
for (const item of storeTotals)
  database.run('INSERT INTO stores VALUES (?, ?, ?)', [item.store, item.count, item.amount]);
const sqlite = Buffer.from(database.export());
database.close();
let font = null;
try {
  font = await readFile(
    join(root, 'node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf'),
  );
} catch {
  font = null;
}
let compound = null;
try {
  const container = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(container, '/简报.txt', text(report));
  compound = Buffer.from(XLSX.CFB.write(container));
} catch {
  compound = null;
}
const reportBytes = text(report);
const csvBytes = text(csvTable());
const bundle = [
  ['简报.md', reportBytes],
  ['销售清单.csv', csvBytes],
  ['封面.png', picture],
];
const zipBundle = zip(Object.fromEntries(bundle.map(([name, bytes]) => [name, bytes])));
const tarBundle = tar(bundle);
const gzBundle = Buffer.from(gzipSync(reportBytes));
const tgzBundle = Buffer.from(gzipSync(tarBundle));
const bz2Bundle = compress('bz2', reportBytes);
const xzBundle = compress('xz', reportBytes);
const lzmaBundle = compress('lzma', tarBundle);
let zstdBundle = null;
try {
  const zlib = require('node:zlib');
  if (typeof zlib.zstdCompressSync === 'function') zstdBundle = zlib.zstdCompressSync(reportBytes);
} catch {
  zstdBundle = null;
}
const animation = lottie();
const animationJson = text(JSON.stringify(animation));
const dotLottie = zip({
  'manifest.json': strToU8(JSON.stringify({ version: '1', animations: [{ id: 'mark' }] })),
  'animations/mark.json': strToU8(JSON.stringify(animation)),
});
const svg = text(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#d7c6ae"/><circle cx="470" cy="78" r="34" fill="#ecc47a"/><path d="M0 190 C140 150 220 210 340 176 C460 142 540 188 640 160 V360 H0 Z" fill="#7e9484"/><path d="M0 250 C160 220 250 280 420 246 C520 226 580 250 640 236 V360 H0 Z" fill="#3e6054"/><rect x="86" y="176" width="128" height="116" fill="#e4dccf"/><rect x="128" y="196" width="40" height="24" fill="#a8bcba"/><rect x="128" y="232" width="40" height="24" fill="#a8bcba"/><rect x="108" y="214" width="24" height="78" fill="#5c4e40"/><text x="36" y="332" font-size="18" fill="#24312c">滨江店 · 第三季度</text></svg>\n',
);
const categoryByKind = {
  text: '文本与代码',
  image: '图像',
  tiff: '图像',
  metafile: '图像',
  'decoded-image': '图像',
  archive: '压缩包与容器',
  pdf: '文档与电子书',
  ofd: '文档与电子书',
  docx: '文档与电子书',
  'legacy-doc': '文档与电子书',
  html: '文档与电子书',
  'web-archive': '文档与电子书',
  rtf: '文档与电子书',
  markdown: '文档与电子书',
  asciidoc: '文档与电子书',
  odt: '文档与电子书',
  epub: '文档与电子书',
  fb2: '文档与电子书',
  notebook: '文档与电子书',
  xlsx: '表格',
  'legacy-xlsx': '表格',
  csv: '表格',
  ods: '表格',
  model: '三维与图纸',
  dxf: '三维与图纸',
  pptx: '演示文稿',
  'legacy-ppt': '演示文稿',
  odp: '演示文稿',
  video: '音视频',
  audio: '音视频',
  database: '数据库',
  thumbnail: '设计文件预览图',
  font: '字体',
  diagram: '图表',
  mail: '邮件',
  animation: '动画',
};
const zipArchives = new Set([
  'zip',
  'jar',
  'apk',
  'ipa',
  'cbz',
  'whl',
  'nupkg',
  'snupkg',
  'vsix',
  'xpi',
  'egg',
  'pyz',
  'aab',
  'hap',
  'wgt',
  'wgtu',
  'qlplugin',
  'appx',
  'appxbundle',
  'msix',
  'msixbundle',
]);
for (const folder of new Set(Object.values(categoryByKind)))
  await mkdir(join(destination, folder), { recursive: true });
const realSources = {
  '3ds': 'sample.3ds',
  blend: 'sample.blend',
  brep: 'sample.brep',
  fbx: 'sample.fbx',
  iges: 'sample.iges',
  igs: 'sample.iges',
  step: 'sample.step',
  stp: 'sample.step',
  cr2: 'camera.cr2',
  kdc: 'camera.kdc',
  cur: 'sample.cur',
  heic: 'sample.heic',
  heif: 'sample.heic',
  epub: '阅读时光.epub',
  msg: 'sample.msg',
  wmf: 'sample.wmf',
  emf: 'sample.emf',
  '3mf': 'sample.3mf',
  '7z': 'archive.7z',
  cb7: 'archive.7z',
  rar: 'sample-rar5.rar',
  cbr: 'sample-rar5.rar',
  lz: 'archive.lz',
  lzma: 'archive.lzma',
  dwg: 'AC1032.dwg',
};
let structured = 0;
const weak = [];
for (const { ext, kind } of selected) {
  const language = languages[ext] ?? 'plaintext';
  let bytes = null;
  if (realSources[ext]) {
    try {
      bytes = await readFile(join(root, 'test-results/fixtures', realSources[ext]));
    } catch {
      /* Missing real fixture is listed below. */
    }
  }
  if (bytes) {
  } // Preserve verified input bytes.
  else if (ext === 'svgz') bytes = Buffer.from(gzipSync(svg));
  else if (kind === 'image' && ext !== 'svg') bytes = magick(ext, picture);
  else if (ext === 'svg') bytes = svg;
  else if (kind === 'metafile') bytes = ext === 'emf' ? emf() : wmf();
  else if (kind === 'tiff' || kind === 'decoded-image') bytes = magick(ext, picture);
  else if (kind === 'pdf') bytes = pdf();
  else if (kind === 'ofd') bytes = ofd();
  else if (kind === 'html') bytes = htmlPage();
  else if (kind === 'web-archive') bytes = mhtml();
  else if (kind === 'rtf') bytes = rtf();
  else if (kind === 'csv') bytes = delimited(ext);
  else if (kind === 'notebook') bytes = notebook();
  else if (kind === 'mail' && ext === 'eml') bytes = eml();
  else if (ext === 'lottie') bytes = dotLottie;
  else if (ext === 'tgs') bytes = Buffer.from(gzipSync(strToU8(JSON.stringify(animation))));
  else if (kind === 'fb2') bytes = fb2();
  else if (kind === 'dxf' && ext === 'dxf') bytes = dxf();
  else if (kind === 'docx') bytes = docx();
  else if (kind === 'xlsx') bytes = sheets.xlsx;
  else if (kind === 'pptx') bytes = pptx();
  else if (kind === 'odt') bytes = odt();
  else if (kind === 'ods') bytes = sheets.ods ?? null;
  else if (kind === 'odp') bytes = odp();
  else if (kind === 'epub') bytes = epub();
  else if (kind === 'database') bytes = sqlite;
  else if (kind === 'font' && ext === 'ttf' && font) bytes = font;
  else if (kind === 'audio' && ext === 'wav') bytes = wav();
  else if (ext === 'stl') bytes = stl();
  else if (ext === 'obj') bytes = obj();
  else if (ext === 'ply') bytes = ply();
  else if (ext === 'glb') bytes = glb();
  else if (ext === 'gltf') bytes = text(gltfDocument());
  else if (ext === 'dae') bytes = dae();
  else if (ext === '3mf') bytes = threeMf();
  else if (ext === 'pcd') bytes = pcd();
  else if (ext === 'xls' || ext === 'xlt' || ext === 'xlw') bytes = sheets.xls;
  else if (ext === 'xlsb') bytes = sheets.xlsb;
  else if (ext === 'dbf') bytes = sheets.dbf;
  else if (ext === 'dif') bytes = sheets.dif;
  else if (ext === 'sylk' || ext === 'slk') bytes = sheets.sylk;
  else if (ext === 'gz') bytes = gzBundle;
  else if ((ext === 'zst' || ext === 'zstd') && zstdBundle) bytes = zstdBundle;
  else if (ext === 'bz2') bytes = bz2Bundle;
  else if (ext === 'xz') bytes = xzBundle;
  else if (ext === 'lzma') bytes = lzmaBundle;
  else if (ext === 'tar' || ext === 'cbt') bytes = tarBundle;
  else if (ext === 'tgz') bytes = tgzBundle;
  else if (ext === 'cpio') bytes = cpio('简报.md', reportBytes);
  else if (ext === 'asar') bytes = asar(reportBytes, '简报.md');
  else if (ext === 'crx') bytes = crx(zipBundle);
  else if (ext === 'pak') bytes = pak(reportBytes);
  else if (ext === 'xar') bytes = xar(reportBytes);
  else if (ext === 'ar' || ext === 'deb') bytes = ar('readme.txt', reportBytes);
  else if (zipArchives.has(ext)) bytes = zipBundle;
  else if (compound && ['cfb', 'eif', 'msi', 'msp'].includes(ext)) bytes = compound;
  else if (kind === 'markdown') bytes = text(report);
  else if (kind === 'asciidoc')
    bytes = text(report.replace(/^# /gm, '= ').replace(/^## /gm, '== '));
  else if (kind === 'diagram') {
    bytes = text(
      ext === 'dot' || ext === 'gv'
        ? `digraph stores {\n  rankdir=LR;\n  ${storeTotals.map((item) => `"${item.store}" [label="${item.store}\\n${item.amount}"]`).join('\n  ')};\n  "滨江店" -> "湖滨店";\n  "湖滨店" -> "城西店";\n  "城西店" -> "大学城店";\n}\n`
        : `graph TD\n${storeTotals.map((item, index) => `  s${index}["${item.store} ${item.amount}元"]`).join('\n')}\n  s0 --> s1 --> s2 --> s3\n`,
    );
  } else if (kind === 'text') bytes = text(textFor(ext, language));
  if (!bytes) {
    weak.push(`.${ext}`);
    continue; // Never write explanatory text under a binary extension.
  }
  structured += 1;
  const folder = categoryByKind[kind];
  if (!folder) throw new Error(`未分类的预览类型: ${kind}`);
  await writeFile(join(destination, folder, `sample.${ext}`), bytes);
}

const sizes = selected.map((item) => item);
console.log(`files ${selected.length}`);
console.log(`structured ${structured}`);
await writeFile(
  join(destination, '生成器缺少样本.md'),
  '# 尚缺真实样本\n\n以下扩展名没有可用真实样本，未生成文件：\n\n' + weak.join('、') + '\n',
);
console.log(`missing real samples ${weak.length}`);
console.log(weak.join(' '));
console.log(`orders ${orders.length} total ${totalAmount}`);
console.log(`scene ${picture.length}`);
void sizes;
void animationJson;
