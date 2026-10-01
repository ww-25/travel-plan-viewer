const STORAGE_PREFIX = "travel-plan-progress:v2:";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const DEFAULT_PLAN_URL = "./trip.md";
const MAP_COLORS = { pending: "#f05a28", completed: "#8aa0a3" };

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
  progress: {},
  storageKey: "",
  mapFilter: "all",
  routeMap: null,
  routeLayer: null
};

const els = {
  tripTitle: document.querySelector("#trip-title"),
  tripMeta: document.querySelector("#trip-meta"),
  upload: document.querySelector("#upload-card"),
  dropZone: document.querySelector("#drop-zone"),
  fileInput: document.querySelector("#file-input"),
  fileName: document.querySelector("#file-name"),
  changeFile: document.querySelector("#change-file"),
  replaceFile: document.querySelector("#replace-file"),
  progressCard: document.querySelector("#progress-card"),
  routeMapPanel: document.querySelector("#route-map-panel"),
  routeMap: document.querySelector("#route-map"),
  mapDayFilter: document.querySelector("#map-day-filter"),
  mapEmpty: document.querySelector("#map-empty"),
  mapStatus: document.querySelector("#map-status"),
  timelinePanel: document.querySelector("#timeline-panel"),
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
  errorMessage: document.querySelector("#error-message"),
  dialog: document.querySelector("#map-dialog"),
  closeMap: document.querySelector("#close-map"),
  mapPlace: document.querySelector("#map-place"),
  mapAddress: document.querySelector("#map-address"),
  amap: document.querySelector("#amap-link"),
  baidu: document.querySelector("#baidu-link"),
  apple: document.querySelector("#apple-link")
};

function loadProgress(storageKey) {
  if (!storageKey) return {};
  try { return JSON.parse(localStorage.getItem(storageKey) || "{}"); }
  catch { return {}; }
}

function saveProgress() {
  if (state.storageKey) localStorage.setItem(state.storageKey, JSON.stringify(state.progress));
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
    if (/^[-*]\s*(类型|地点|地址|导航关键词|坐标)：/.test(line)) continue;
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

function itemMetadata(lines) {
  const metadata = {};
  for (const raw of lines) {
    const match = raw.trim().match(/^[-*]\s*(类型|地点|地址|导航关键词|坐标|停车)：\s*(.+)$/);
    if (match) metadata[match[1]] = match[2].trim();
  }
  return metadata;
}

function parseCoordinates(value) {
  if (!value) return null;
  const match = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const longitude = Number(match[1]);
  const latitude = Number(match[2]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;
  return { longitude, latitude };
}

function parseItinerary(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const days = [];
  let day = null;
  let item = null;

  const closeItem = () => {
    if (!item || !day) return;
    const metadata = itemMetadata(item.lines);
    item.details = detailsToHtml(item.lines);
    delete item.lines;
    item.place = metadata["地点"] && metadata["地址"] && metadata["导航关键词"]
      ? { name: metadata["导航关键词"], address: metadata["地址"], label: metadata["地点"] }
      : placeRules.find((rule) => rule.test.test(item.title)) || null;
    item.coordinates = parseCoordinates(metadata["坐标"]);
    day.items.push(item);
    item = null;
  };

  for (const line of lines) {
    const dayMatch = line.match(/^##\s+(\d{1,2}\s+月\s+\d{1,2}\s+日)｜(.+)$/);
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

function populateMapFilter() {
  els.mapDayFilter.innerHTML = [
    '<option value="all">全部行程</option>',
    ...state.days.map((day, index) => `<option value="${index}">${escapeHtml(day.date)}</option>`)
  ].join("");
  state.mapFilter = "all";
  els.mapDayFilter.value = "all";
}

function ensureRouteMap() {
  if (state.routeMap) return true;
  if (typeof window.L === "undefined") {
    els.routeMap.hidden = true;
    els.mapEmpty.hidden = false;
    els.mapEmpty.querySelector("strong").textContent = "地图组件暂时无法加载";
    els.mapEmpty.querySelector("p").textContent = "时间轴和手机地图导航仍可正常使用，请稍后刷新重试。";
    els.mapStatus.textContent = "Leaflet 资源加载失败。";
    return false;
  }

  state.routeMap = window.L.map(els.routeMap, {
    scrollWheelZoom: false,
    zoomControl: true
  });
  const tiles = window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
  });
  let tileErrors = 0;
  tiles.on("tileerror", () => {
    tileErrors += 1;
    if (tileErrors >= 3) els.mapStatus.textContent = "底图加载不完整；时间轴和外部地图导航不受影响。";
  });
  tiles.addTo(state.routeMap);
  state.routeLayer = window.L.layerGroup().addTo(state.routeMap);
  return true;
}

function routeDays() {
  if (state.mapFilter === "all") return state.days;
  const index = Number(state.mapFilter);
  return Number.isInteger(index) && state.days[index] ? [state.days[index]] : state.days;
}

function renderRouteMap() {
  const days = routeDays();
  const points = days.flatMap((day) => day.items
    .filter((item) => item.coordinates)
    .map((item) => ({ day, item })));

  els.routeMapPanel.hidden = false;
  if (!points.length) {
    els.routeMap.hidden = true;
    els.mapEmpty.hidden = false;
    els.mapEmpty.querySelector("strong").textContent = "这份计划还没有路线坐标";
    els.mapEmpty.querySelector("p").textContent = "在行程元数据中加入“坐标：经度,纬度”即可显示路线。";
    els.mapStatus.textContent = "";
    return;
  }

  els.routeMap.hidden = false;
  els.mapEmpty.hidden = true;
  if (!ensureRouteMap()) return;
  state.routeLayer.clearLayers();

  const bounds = [];
  let sequence = 0;
  for (const day of days) {
    const dayPoints = day.items.filter((item) => item.coordinates);
    for (let index = 0; index < dayPoints.length; index += 1) {
      const item = dayPoints[index];
      const completed = Boolean(state.progress[item.id]);
      const status = completed ? "completed" : "pending";
      const latLng = [item.coordinates.latitude, item.coordinates.longitude];
      sequence += 1;
      bounds.push(latLng);

      const marker = window.L.marker(latLng, {
        icon: window.L.divIcon({
          className: "route-marker-icon",
          html: `<span class="route-marker ${status}" aria-hidden="true">${sequence}</span>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          popupAnchor: [0, -17]
        }),
        title: `${sequence}. ${item.place?.label || item.title}`
      });
      marker.bindPopup(`<div class="route-popup">
        <strong>${sequence}. ${escapeHtml(item.place?.label || item.title)}</strong>
        <span>${escapeHtml(day.date)} · ${escapeHtml(item.start)}${item.end ? `—${escapeHtml(item.end)}` : ""}</span>
        <span>${escapeHtml(item.place?.address || item.title)}</span>
        <span class="popup-status ${status}">${completed ? "已完成" : "待完成"}</span>
      </div>`);
      marker.addTo(state.routeLayer);

      if (index > 0) {
        const previous = dayPoints[index - 1];
        const previousLatLng = [previous.coordinates.latitude, previous.coordinates.longitude];
        window.L.polyline([previousLatLng, latLng], {
          color: MAP_COLORS[status],
          weight: completed ? 3 : 5,
          opacity: completed ? 0.55 : 0.9,
          dashArray: completed ? "7 7" : null,
          lineCap: "round"
        }).addTo(state.routeLayer);
      }
    }
  }

  const mapBounds = window.L.latLngBounds(bounds);
  state.routeMap.fitBounds(mapBounds, { padding: [34, 34], maxZoom: 14 });
  els.mapStatus.textContent = `显示 ${points.length} 个有坐标的行程地点；连线仅表示游览顺序。`;
  window.setTimeout(() => state.routeMap.invalidateSize(), 0);
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
  els.mapPlace.textContent = place.label || place.name;
  els.mapAddress.textContent = place.address;
  const keyword = encodeURIComponent(place.name);
  const address = encodeURIComponent(place.address);
  els.amap.href = `https://uri.amap.com/search?keyword=${keyword}&view=map&src=travel-plan&callnative=1`;
  els.baidu.href = `https://api.map.baidu.com/geocoder?address=${address}&output=html&src=travel-plan`;
  els.apple.href = `https://maps.apple.com/?q=${keyword}&address=${address}`;
  els.dialog.showModal();
}

function render() {
  renderTabs();
  renderTimeline();
  updateProgress();
  renderRouteMap();
}

function documentInfo(markdown, days, fileName) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || fileName.replace(/\.md$/i, "") || "旅行行程簿";
  const firstDay = days[0];
  const lastDay = days.at(-1);
  const firstItem = firstDay?.items[0];
  const lastItem = lastDay?.items.at(-1);
  const range = firstDay && lastDay
    ? `${firstDay.date}${firstItem ? ` ${firstItem.start}` : ""} — ${lastDay.date}${lastItem?.end ? ` ${lastItem.end}` : ""}`
    : "已读取行程";
  return { title, range };
}

function showFileError(message) {
  els.upload.hidden = false;
  els.errorMessage.textContent = message;
  els.error.hidden = false;
}

function loadItineraryText(markdown, sourceName) {
  const normalizedMarkdown = markdown.replace(/^\uFEFF/, "");
  if (!normalizedMarkdown.trim()) throw new Error("文件内容为空。");
  if (normalizedMarkdown.includes("\uFFFD")) throw new Error("文件可能不是 UTF-8 编码，请转换编码后重试。");

  const days = parseItinerary(normalizedMarkdown);
  const itemCount = days.reduce((sum, day) => sum + day.items.length, 0);
  if (!days.length || !itemCount) {
    throw new Error("没有找到可识别的日期和时间块。请使用“## M 月 D 日｜主题”与“### HH:MM—HH:MM 标题”。");
  }

  const info = documentInfo(normalizedMarkdown, days, sourceName);
  state.days = days;
  state.activeDay = 0;
  state.storageKey = `${STORAGE_PREFIX}${hash(normalizedMarkdown)}`;
  state.progress = loadProgress(state.storageKey);
  els.fileName.textContent = sourceName;
  els.tripTitle.textContent = info.title;
  els.tripMeta.textContent = info.range;
  document.title = `${info.title} · 旅行行程簿`;
  els.error.hidden = true;
  els.upload.hidden = true;
  els.progressCard.hidden = false;
  els.routeMapPanel.hidden = false;
  els.tabs.hidden = false;
  els.timelinePanel.hidden = false;
  populateMapFilter();
  render();
  registerWebMcpTools();
}

async function loadItineraryFile(file) {
  els.error.hidden = true;
  try {
    if (!file) return;
    if (!/\.md$/i.test(file.name)) throw new Error("请选择扩展名为 .md 的 Markdown 文件。");
    if (file.size > MAX_FILE_BYTES) throw new Error("文件超过 2 MB，请精简后重新选择。");
    loadItineraryText(await file.text(), file.name);
  } catch (error) {
    console.error(error);
    showFileError(error instanceof Error ? error.message : "读取失败，请检查文件。");
  } finally {
    els.fileInput.value = "";
  }
}

async function loadDefaultItinerary() {
  els.tripMeta.textContent = "正在检查默认行程…";
  try {
    const response = await fetch(DEFAULT_PLAN_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`默认行程不可用（HTTP ${response.status}）`);
    loadItineraryText(await response.text(), "trip.md");
  } catch (error) {
    console.info("默认行程加载失败，切换为本地文件模式。", error);
    els.tripMeta.textContent = "未找到可用的默认行程，请选择本地 Markdown 文件";
    els.fileName.textContent = "未加载默认 trip.md";
    showFileError(error instanceof Error ? `${error.message}，你可以改为上传本地文件。` : "无法加载默认行程，请上传本地文件。");
  }
}

function registerWebMcpTools() {
  const context = document.modelContext;
  if (!context?.registerTool || registerWebMcpTools.done) return;
  registerWebMcpTools.done = true;

  void Promise.resolve(context.registerTool({
    name: "get_trip_progress",
    title: "读取旅行进度",
    description: "读取当前导入行程的所有项目及其完成状态。",
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

els.changeFile.addEventListener("click", () => els.fileInput.click());
els.replaceFile.addEventListener("click", () => els.fileInput.click());
els.dropZone.addEventListener("click", () => els.fileInput.click());
els.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    els.fileInput.click();
  }
});
els.fileInput.addEventListener("change", () => loadItineraryFile(els.fileInput.files?.[0]));
els.mapDayFilter.addEventListener("change", () => {
  state.mapFilter = els.mapDayFilter.value;
  renderRouteMap();
});

for (const eventName of ["dragenter", "dragover"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.add("drag-active");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  els.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    els.dropZone.classList.remove("drag-active");
  });
}
els.dropZone.addEventListener("drop", (event) => loadItineraryFile(event.dataTransfer?.files?.[0]));

els.closeMap.addEventListener("click", () => els.dialog.close());
els.dialog.addEventListener("click", (event) => { if (event.target === els.dialog) els.dialog.close(); });

loadDefaultItinerary();
