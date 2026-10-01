const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appPath = path.join(__dirname, "..", "docs", "app.js");
const examplePath = path.join(__dirname, "..", "..", "travel-plan-md-standard", "references", "example-valid.md");
const tripPath = path.join(__dirname, "..", "docs", "trip.md");
const source = fs.readFileSync(appPath, "utf8");
const parserSource = source.slice(0, source.indexOf("function renderTabs"));
const markdown = fs.readFileSync(examplePath, "utf8");

const context = {
  document: { querySelector: () => ({}) },
  localStorage: { getItem: () => null, setItem: () => {} },
  input: markdown
};
vm.createContext(context);
vm.runInContext(`${parserSource}\nglobalThis.result = parseItinerary(input);`, context);

assert.equal(context.result.length, 2, "应识别两个日期");
assert.equal(context.result[0].items.length, 3, "首日应识别三个时间块");
assert.deepEqual(
  JSON.parse(JSON.stringify(context.result[0].items[0].place)),
  {
    name: "示例酒店停车场",
    address: "山东省青岛市市南区示例路 1 号",
    label: "示例酒店"
  },
  "应从标准地点元数据生成地图信息"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(context.result[0].items[0].coordinates)),
  { longitude: 120.38264, latitude: 36.06711 },
  "应读取 WGS84 路线坐标"
);
assert.doesNotMatch(context.result[0].items[0].details, /类型：|地点：|地址：|导航关键词：/);

context.input = markdown.replaceAll("10 月", "1 月");
vm.runInContext("globalThis.januaryResult = parseItinerary(input);", context);
assert.equal(context.januaryResult[0].date, "1 月 10 日", "解析器不应限定为十月");

context.input = fs.readFileSync(tripPath, "utf8");
vm.runInContext("globalThis.tripResult = parseItinerary(input);", context);
assert.equal(context.tripResult.length, 3, "默认威海计划应识别三天");
assert.equal(
  context.tripResult.flatMap((day) => day.items).filter((item) => item.coordinates).length,
  7,
  "默认威海计划应提供七个路线地点"
);

console.log("Parser tests passed: upload-compatible Markdown, map coordinates, and generic months.");
