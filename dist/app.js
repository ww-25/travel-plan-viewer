const MARKDOWN_FILE = "./威海国庆自驾计划_2026-10-03至10-05.md";
const STORAGE_KEY = "weihai-trip-progress:v1";

const placeRules = [
  { test: /入住、处理停车/, name: "麗枫酒店（威海幸福门威高广场店）", address: "山东省威海市环翠区昆明路16号" },
  { test: /幸福门滨海徒步/, name: "幸福门", address: "山东省威海市环翠区海滨北路48号" },
  { test: /晚餐：胶东海鲜/, name: "百姓海鲜烧烤家常菜", address: "山东省威海市环翠区纪念路22-4号" },
  { test: /早餐/, name: "麗枫酒店（威海幸福门威高广场店）", address: "山东省威海市环翠区昆明路16号" },
  { test: /酒店 → 半月湾/, name: "半月湾北岸停车场", address: "山东省威海市环翠区半月湾沙滩北岸" },
  { test: /半月湾—猫头山：巴士/, name: "猫头山3号观景平台", address: "山东省威海市环翠区环海路猫头山" },
  { test: /半月湾 → 海源公园/, name: "海源公园", address: "山东省威海市环翠区连林岛路9号" },
  { test: /午餐 \+ 返回酒店/, name: "船泊丽港（统一路店）", address: "山东省威海市环翠区统一路前进街18号" },
  { test: /威海市博物馆/, name: "威海市博物馆", address: "山东省威海市环翠区即墨路2A文化艺术中心3楼" },
  { test: /晚餐：韩餐/, name: "台北小城（财富广场总店）", address: "山东省威海市环翠区财富广场" },
  { test: /威海公园徒步/, name: "威海公园海慧停车场", address: "山东省威海市环翠区海滨中路58号" },
  { test: /威海公园 → 悦海公园/, name: "悦海公园灯塔停车场", address: "山东省威海市环翠区滨海大道悦海公园" }
];

const state = {
  days: [],
  activeDay: 0,
  progress: loadProgress()
};

const els = {
  tabs: document.querySelector("#day-tabs"),
  timeline: document.querySelector("#timeline"),
  activeDate: document.querySelector("#active-date"),
  activeTitle: document.querySelector("#active-title"),
  completed: document.querySelector("#completed-count"),
  total: document.querySelector("#total-count"),
  status: document.querySelector("#progress-status"),
  percent: document.querySelector("#progress-percent"),
  ring: document.querySelector(".progress-ring"),
  reset: document.querySelector("#reset-button"),
  error: document.querySelector("#error-state"),
  retry: document.querySelector("#retry-button"),
  dialog: document.querySelector("#map-dialog"),
  closeMap: document.querySelector("#close-map"),
  mapPlace: document.querySelector("#map-place"),
  mapAddress: document.querySelector("#map-address"),
  amap: document.querySelector("#amap-link"),
  baidu: document.querySelector("#baidu-link"),
  apple: document.querySelector("#apple-link")
};

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function hash(input) {
  let value = 2166136261;
  for (const char of input) {
    value ^= char.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return `item-${(value >>> 0).toString(36)}`;
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function inlineMarkdown(value) {
  let result = escapeHtml(value);
  result = result.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  result = result.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>");
  return result;
}

function detailsToHtml(lines) {
  const output = [];
  let list = [];
  const flushList = () => {
    if (!list.length) return;
    output.push(`<ul>${list.map((item) => `<li>${inlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("**步行路线：**") || line.startsWith("**滨海自驾路线：**") || line.startsWith("**建议动线：**")) {
      if (line) {
        flushList();
        output.push(`<p>${inlineMarkdown(line)}</p>`);
      }
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      list.push(line.replace(/^[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      list.push(line.replace(/^\d+\.\s+/, ""));
    } else if (!line.startsWith("|")) {
      flushList();
      output.push(`<p>${inlineMarkdown(line.replace(/^>\s*/, ""))}</p>`);
    }
  }
  flushList();
  return output.slice(0, 5).join("");
}

function parseItinerary(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const days = [];
  let day = null;
  let item = null;

  const closeItem = () => {
    if (!item || !day) return;
    item.details = detailsToHtml(item.lines);
    delete item.lines;
    item.place = placeRules.find((rule) => rule.test.test(item.title)) || null;
    day.items.push(item);
    item = null;
  };

  for (const line of lines) {
    const dayMatch = line.match(/^##\s+(10 月 \d+ 日)｜(.+)$/);
    const itemMatch = line.match(/^###\s+(\d{2}:\d{2})(?:—(\d{2}:\d{2}))?\s+(.+)$/);

    if (dayMatch) {
      closeItem();
      day = { date: dayMatch[1], title: dayMatch[2], items: [] };
      days.push(day);
      continue;
    }
    if (/^##\s+/.test(line) && !dayMatch) {
      closeItem();
      day = null;
      continue;
    }
    if (itemMatch && day) {
      closeItem();
      item = {
        id: hash(`${dayMatch?.[1] || day.date}-${itemMatch[1]}-${itemMatch[3]}`),
        start: itemMatch[1],
        end: itemMatch[2] || "",
        title: itemMatch[3],
        lines: []
      };
      continue;
    }
    if (item) item.lines.push(line);
  }
  closeItem();
  return days;
}

function renderTabs() {
  els.tabs.innerHTML = state.days.map((day, index) => {
    const completed = day.items.filter((item) => state.progress[item.id]).length;
    return `<button class="day-tab" type="button" role="tab" aria-selected="${index === state.activeDay}" data-day="${index}">
      <strong>${escapeHtml(day.date)}</strong>
      <small>${completed}/${day.items.length} 项完成</small>
    </button>`;
  }).join("");

  els.tabs.querySelectorAll(".day-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeDay = Number(tab.dataset.day);
      render();
    });
  });
}

function renderTimeline() {
  const day = state.days[state.activeDay];
  if (!day) return;
  els.activeDate.textContent = day.date;
  els.activeTitle.textContent = day.title;
  els.timeline.innerHTML = day.items.map((item) => {
    const checked = Boolean(state.progress[item.id]);
    return `<article class="timeline-item${checked ? " completed" : ""}" data-id="${item.id}">
      <div class="time"><span>${item.start}</span>${item.end ? `<span>${item.end}</span>` : ""}</div>
      <span class="timeline-dot" aria-hidden="true"></span>
      <div class="timeline-card">
        <div class="card-top">
          <label class="complete-control" aria-label="标记 ${escapeHtml(item.title)} 为${checked ? "未" : ""}完成">
            <input type="checkbox" ${checked ? "checked" : ""} data-action="complete" />
            <span aria-hidden="true"></span>
          </label>
          <div class="card-title"><h3>${escapeHtml(item.title)}</h3></div>
          ${item.place ? `<button type="button" class="map-button" data-action="map">地图</button>` : ""}
        </div>
        <div class="card-details">${item.details}</div>
      </div>
    </article>`;
  }).join("");

  els.timeline.querySelectorAll('[data-action="complete"]').forEach((checkbox) => {
    checkbox.addEventListener("change", (event) => {
      const id = event.target.closest(".timeline-item").dataset.id;
      state.progress[id] = event.target.checked;
      if (!event.target.checked) delete state.progress[id];
      saveProgress();
      render();
    });
  });

  els.timeline.querySelectorAll('[data-action="map"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      const id = event.target.closest(".timeline-item").dataset.id;
      const item = day.items.find((candidate) => candidate.id === id);
      openMap(item.place);
    });
  });
}

function updateProgress() {
  const items = state.days.flatMap((day) => day.items);
  const completed = items.filter((item) => state.progress[item.id]).length;
  const percent = items.length ? Math.round((completed / items.length) * 100) : 0;
  els.completed.textContent = completed;
  els.total.textContent = items.length;
  els.percent.textContent = `${percent}%`;
  els.ring.style.strokeDashoffset = String(314.16 * (1 - percent / 100));
  els.status.textContent = percent === 100 ? "全部完成，给这趟海岸旅行画上句号。" : percent ? `还剩 ${items.length - completed} 项，按自己的节奏出发。` : "勾选每段行程，进度会自动保存在这台设备。";
}

function openMap(place) {
  els.mapPlace.textContent = place.name;
  els.mapAddress.textContent = place.address;
  const keyword = encodeURIComponent(place.name);
  const address = encodeURIComponent(place.address);
  els.amap.href = `https://uri.amap.com/search?keyword=${keyword}&city=%E5%A8%81%E6%B5%B7&view=map&src=weihai-trip&callnative=1`;
  els.baidu.href = `https://api.map.baidu.com/geocoder?address=${address}&output=html&src=weihai-trip`;
  els.apple.href = `https://maps.apple.com/?q=${keyword}&address=${address}`;
  els.dialog.showModal();
}

function render() {
  renderTabs();
  renderTimeline();
  updateProgress();
}

async function loadItinerary() {
  els.error.hidden = true;
  els.timeline.hidden = false;
  try {
    const response = await fetch(encodeURI(MARKDOWN_FILE), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const markdown = await response.text();
    state.days = parseItinerary(markdown);
    if (!state.days.length) throw new Error("No itinerary days found");
    render();
    registerWebMcpTools();
  } catch (error) {
    console.error(error);
    els.timeline.hidden = true;
    els.error.hidden = false;
    els.status.textContent = "读取失败，请检查行程文件。";
  }
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool || registerWebMcpTools.done) return;
  registerWebMcpTools.done = true;

  void Promise.resolve(context.registerTool({
    name: "get_trip_progress",
    title: "读取旅行进度",
    description: "读取威海行程的所有项目及其完成状态。",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, untrustedContentHint: false },
    execute() {
      const items = state.days.flatMap((day) => day.items.map((item) => ({ id: item.id, day: day.date, time: item.start, title: item.title, completed: Boolean(state.progress[item.id]) })));
      return { items, completed: items.filter((item) => item.completed).length, total: items.length };
    }
  })).catch(console.error);

  void Promise.resolve(context.registerTool({
    name: "set_trip_items_completed",
    title: "更新旅行进度",
    description: "按行程项目 ID 批量设置完成或未完成，并同步更新页面。",
    inputSchema: {
      type: "object",
      properties: {
        itemIds: { type: "array", items: { type: "string" }, minItems: 1 },
        completed: { type: "boolean" }
      },
      required: ["itemIds", "completed"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || !Array.isArray(input.itemIds) || typeof input.completed !== "boolean") throw new Error("Invalid input");
      const known = new Set(state.days.flatMap((day) => day.items.map((item) => item.id)));
      const unknown = input.itemIds.filter((id) => !known.has(id));
      if (unknown.length) throw new Error(`Unknown item IDs: ${unknown.join(", ")}`);
      input.itemIds.forEach((id) => { if (input.completed) state.progress[id] = true; else delete state.progress[id]; });
      saveProgress();
      render();
      return { updated: input.itemIds.length, completed: input.completed };
    }
  })).catch(console.error);
}

els.reset.addEventListener("click", () => {
  if (!Object.keys(state.progress).length) return;
  if (window.confirm("确定清除所有已完成标记吗？")) {
    state.progress = {};
    saveProgress();
    render();
  }
});
els.retry.addEventListener("click", loadItinerary);
els.closeMap.addEventListener("click", () => els.dialog.close());
els.dialog.addEventListener("click", (event) => { if (event.target === els.dialog) els.dialog.close(); });

loadItinerary();
