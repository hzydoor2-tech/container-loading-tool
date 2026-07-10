const containers = {
  "20GP": {
    label: "20GP 20尺小柜",
    innerLength: 5898,
    innerWidth: 2352,
    innerHeight: 2393,
    doorWidth: 2340,
    doorHeight: 2280,
    maxWeight: 28200
  },
  "40GP": {
    label: "40GP 40尺平柜",
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2393,
    doorWidth: 2340,
    doorHeight: 2280,
    maxWeight: 26500
  },
  "40HQ": {
    label: "40HQ 40尺高柜",
    innerLength: 12032,
    innerWidth: 2352,
    innerHeight: 2698,
    doorWidth: 2340,
    doorHeight: 2670,
    maxWeight: 26500
  }
};

const colors = ["#99f6e4", "#bfdbfe", "#fde68a", "#fecaca", "#ddd6fe", "#bbf7d0", "#fed7aa", "#c7d2fe", "#bae6fd"];
const draftKey = "door-window-container-loading-v1";
const loginSessionKey = "huzhiyi-container-login";

const $ = (selector) => document.querySelector(selector);
const crateBody = $("#crateBody");
const crateTemplate = $("#crateTemplate");
let threeState = null;

function showApplication() {
  $("#loginScreen").hidden = true;
  $("#appShell").hidden = false;
}

function showLogin() {
  $("#appShell").hidden = true;
  $("#loginScreen").hidden = false;
  $("#loginPassword").value = "";
  $("#loginError").textContent = "";
  $("#loginUsername").focus();
}

function handleLogin(event) {
  event.preventDefault();
  const username = $("#loginUsername").value.trim();
  const password = $("#loginPassword").value;
  if (username === "huzhiyi" && password === "huzhiyi123") {
    sessionStorage.setItem(loginSessionKey, "ok");
    showApplication();
    return;
  }
  $("#loginError").textContent = "账号或密码错误，请重新输入。";
  $("#loginPassword").value = "";
  $("#loginPassword").focus();
}

function setContainer(type) {
  if (!containers[type]) return;
  const data = containers[type];
  $("#innerLength").value = data.innerLength;
  $("#innerWidth").value = data.innerWidth;
  $("#innerHeight").value = data.innerHeight;
  $("#doorWidth").value = data.doorWidth;
  $("#doorHeight").value = data.doorHeight;
  $("#maxWeight").value = data.maxWeight;
}

function addCrate(crate = {}) {
  const row = crateTemplate.content.firstElementChild.cloneNode(true);
  field(row, "name").value = crate.name || "";
  field(row, "length").value = crate.length || "";
  field(row, "width").value = crate.width || "";
  field(row, "height").value = crate.height || "";
  field(row, "quantity").value = crate.quantity || 1;
  field(row, "weight").value = crate.weight ?? 0;
  field(row, "rotatable").checked = crate.rotatable !== false;
  row.querySelector("[data-remove]").addEventListener("click", () => {
    row.remove();
    if (!crateBody.children.length) addCrate();
    saveDraft();
  });
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", saveDraft));
  crateBody.appendChild(row);
}

function field(row, name) {
  return row.querySelector(`[data-field="${name}"]`);
}

function readContainer() {
  return {
    innerLength: number("#innerLength"),
    innerWidth: number("#innerWidth"),
    innerHeight: number("#innerHeight"),
    doorWidth: number("#doorWidth"),
    doorHeight: number("#doorHeight"),
    maxWeight: number("#maxWeight"),
    allowStacking: $("#allowStacking").checked
  };
}

function number(selector) {
  return Number($(selector).value || 0);
}

function readCrates() {
  return [...crateBody.querySelectorAll("tr")].map((row, index) => ({
    name: field(row, "name").value.trim() || `木箱${index + 1}`,
    length: Number(field(row, "length").value || 0),
    width: Number(field(row, "width").value || 0),
    height: Number(field(row, "height").value || 0),
    quantity: Number(field(row, "quantity").value || 0),
    weight: Number(field(row, "weight").value || 0),
    rotatable: field(row, "rotatable").checked
  }));
}

function validate(container, crates) {
  const messages = [];
  if (!container.innerLength || !container.innerWidth || !container.innerHeight) {
    messages.push({ type: "bad", text: "请填写完整的货柜内部长、宽、高。" });
  }
  if (!container.doorWidth || !container.doorHeight) {
    messages.push({ type: "bad", text: "请填写柜门开口宽度和高度。" });
  }
  if (!container.maxWeight) {
    messages.push({ type: "bad", text: "请填写货柜最大载重。" });
  }
  crates.forEach((crate) => {
    if (!crate.length || !crate.width || !crate.height || !crate.quantity) {
      messages.push({ type: "bad", text: `${crate.name} 的长、宽、高、数量都需要大于 0。` });
    }
  });
  return messages;
}

function getOrientations(item) {
  const values = [
    { length: item.length, width: item.width, height: item.height, note: "原方向" }
  ];

  if (item.rotatable) {
    [
      [item.length, item.height, item.width],
      [item.width, item.length, item.height],
      [item.width, item.height, item.length],
      [item.height, item.length, item.width],
      [item.height, item.width, item.length]
    ].forEach(([length, width, height]) => {
      if (!values.some((v) => v.length === length && v.width === width && v.height === height)) {
        values.push({ length, width, height, note: "旋转" });
      }
    });
  }

  return values;
}

function canPassDoor(item, container) {
  return getOrientations(item).some((o) => o.width <= container.doorWidth && o.height <= container.doorHeight);
}

function canFitInsideSingle(item, container) {
  return getOrientations(item).some((o) =>
    o.length <= container.innerLength &&
    o.width <= container.innerWidth &&
    o.height <= container.innerHeight
  );
}

function expandCrates(crates, container) {
  const blocked = [];
  const ready = [];

  crates.forEach((crate, crateIndex) => {
    const doorOk = canPassDoor(crate, container);
    const insideOk = canFitInsideSingle(crate, container);
    for (let i = 0; i < crate.quantity; i += 1) {
      const item = {
        ...crate,
        crateIndex,
        pieceNo: i + 1,
        volume: crate.length * crate.width * crate.height
      };
      if (!doorOk) {
        blocked.push({ ...item, reason: "无法通过柜门开口" });
      } else if (!insideOk) {
        blocked.push({ ...item, reason: "单件尺寸超过柜内空间" });
      } else {
        ready.push(item);
      }
    }
  });

  return { ready, blocked };
}

function pack(container, crates) {
  const { ready, blocked } = expandCrates(crates, container);
  if (container.allowStacking) {
    return packStacking(container, ready, blocked);
  }

  const candidateOrders = [
    [...ready].sort((a, b) => b.volume - a.volume),
    [...ready].sort((a, b) => b.length * b.width - a.length * a.width),
    [...ready].sort((a, b) => Math.max(b.length, b.width) - Math.max(a.length, a.width)),
    [...ready].sort((a, b) => b.height - a.height),
    [...ready].sort((a, b) => a.length * a.width - b.length * b.width)
  ];

  const best = candidateOrders
    .map((items) => packGroundMaxRects(container, items, blocked))
    .sort((a, b) => {
      const aVolume = a.placed.reduce((sum, item) => sum + item.length * item.width * item.height, 0);
      const bVolume = b.placed.reduce((sum, item) => sum + item.length * item.width * item.height, 0);
      if (bVolume !== aVolume) return bVolume - aVolume;
      return b.placed.length - a.placed.length;
    })[0];

  return best;
}

function packStacking(container, ready, blocked) {
  const candidateOrders = [
    [...ready].sort((a, b) => b.volume - a.volume),
    [...ready].sort((a, b) => b.height - a.height),
    [...ready].sort((a, b) => Math.min(a.length, a.width, a.height) - Math.min(b.length, b.width, b.height)),
    [...ready].sort((a, b) => Math.max(b.length, b.width, b.height) - Math.max(a.length, a.width, a.height)),
    [...ready].sort((a, b) => a.volume - b.volume)
  ];

  return candidateOrders
    .map((items) => pack3dMaxSpaces(container, items, blocked))
    .sort((a, b) => {
      const aVolume = a.placed.reduce((sum, item) => sum + item.length * item.width * item.height, 0);
      const bVolume = b.placed.reduce((sum, item) => sum + item.length * item.width * item.height, 0);
      if (b.placed.length !== a.placed.length) return b.placed.length - a.placed.length;
      return bVolume - aVolume;
    })[0];
}

function pack3dMaxSpaces(container, items, blocked) {
  const spaces = [{
    x: 0,
    y: 0,
    z: 0,
    length: container.innerLength,
    width: container.innerWidth,
    height: container.innerHeight
  }];
  const placed = [];
  const unpacked = [...blocked];

  items.forEach((item) => {
    const placement = findBest3dPlacement(container, item, spaces, placed);
    if (!placement) {
      unpacked.push({ ...item, reason: "柜内剩余空间不足" });
      return;
    }

    const placedItem = {
      ...item,
      length: placement.length,
      width: placement.width,
      height: placement.height,
      x: placement.x,
      y: placement.y,
      z: placement.z
    };
    placed.push(placedItem);
    splitSpaces3d(spaces, placedItem);
    pruneSpaces3d(spaces);
  });

  return { placed, unpacked };
}

function findBest3dPlacement(container, item, spaces, placed) {
  const options = getOrientations(item)
    .filter((o) =>
      o.width <= container.doorWidth &&
      o.height <= container.doorHeight &&
      o.length <= container.innerLength &&
      o.width <= container.innerWidth &&
      o.height <= container.innerHeight
    );
  let best = null;

  spaces.forEach((space) => {
    options.forEach((option) => {
      if (option.length > space.length || option.width > space.width || option.height > space.height) return;
      const candidate = {
        ...option,
        x: space.x,
        y: space.y,
        z: space.z
      };
      if (collidesAny(candidate, placed)) return;

      const score = {
        z: candidate.z,
        y: candidate.y,
        x: candidate.x,
        volumeWaste: space.length * space.width * space.height - option.length * option.width * option.height,
        shortSide: Math.min(space.length - option.length, space.width - option.width, space.height - option.height),
        longSide: Math.max(space.length - option.length, space.width - option.width, space.height - option.height)
      };
      if (!best || compare3dScore(score, best.score) < 0) {
        best = { ...candidate, score };
      }
    });
  });

  return best;
}

function compare3dScore(a, b) {
  return (
    a.z - b.z ||
    a.y - b.y ||
    a.x - b.x ||
    a.volumeWaste - b.volumeWaste ||
    a.shortSide - b.shortSide ||
    a.longSide - b.longSide
  );
}

function splitSpaces3d(spaces, used) {
  for (let i = spaces.length - 1; i >= 0; i -= 1) {
    const space = spaces[i];
    if (!boxesOverlap(space, used)) continue;
    spaces.splice(i, 1);

    const sx2 = space.x + space.length;
    const sy2 = space.y + space.width;
    const sz2 = space.z + space.height;
    const ux2 = used.x + used.length;
    const uy2 = used.y + used.width;
    const uz2 = used.z + used.height;

    if (used.x > space.x) {
      spaces.push({ x: space.x, y: space.y, z: space.z, length: used.x - space.x, width: space.width, height: space.height });
    }
    if (ux2 < sx2) {
      spaces.push({ x: ux2, y: space.y, z: space.z, length: sx2 - ux2, width: space.width, height: space.height });
    }
    if (used.y > space.y) {
      spaces.push({ x: space.x, y: space.y, z: space.z, length: space.length, width: used.y - space.y, height: space.height });
    }
    if (uy2 < sy2) {
      spaces.push({ x: space.x, y: uy2, z: space.z, length: space.length, width: sy2 - uy2, height: space.height });
    }
    if (used.z > space.z) {
      spaces.push({ x: space.x, y: space.y, z: space.z, length: space.length, width: space.width, height: used.z - space.z });
    }
    if (uz2 < sz2) {
      spaces.push({ x: space.x, y: space.y, z: uz2, length: space.length, width: space.width, height: sz2 - uz2 });
    }
  }
}

function boxesOverlap(a, b) {
  return (
    a.x < b.x + b.length &&
    a.x + a.length > b.x &&
    a.y < b.y + b.width &&
    a.y + a.width > b.y &&
    a.z < b.z + b.height &&
    a.z + a.height > b.z
  );
}

function collidesAny(candidate, placed) {
  return placed.some((item) => boxesOverlap(candidate, item));
}

function pruneSpaces3d(spaces) {
  for (let i = spaces.length - 1; i >= 0; i -= 1) {
    if (spaces[i].length <= 0 || spaces[i].width <= 0 || spaces[i].height <= 0) {
      spaces.splice(i, 1);
    }
  }

  for (let i = 0; i < spaces.length; i += 1) {
    for (let j = i + 1; j < spaces.length; j += 1) {
      if (containsBox(spaces[i], spaces[j])) {
        spaces.splice(j, 1);
        j -= 1;
      } else if (containsBox(spaces[j], spaces[i])) {
        spaces.splice(i, 1);
        i -= 1;
        break;
      }
    }
  }
}

function containsBox(a, b) {
  return (
    b.x >= a.x &&
    b.y >= a.y &&
    b.z >= a.z &&
    b.x + b.length <= a.x + a.length &&
    b.y + b.width <= a.y + a.width &&
    b.z + b.height <= a.z + a.height
  );
}

function packGroundMaxRects(container, items, blocked) {
  const freeRects = [{ x: 0, y: 0, length: container.innerLength, width: container.innerWidth }];
  const placed = [];
  const unpacked = [...blocked];

  items.forEach((item) => {
    const placement = findBestGroundPlacement(container, item, freeRects);
    if (!placement) {
      unpacked.push({ ...item, reason: "柜内剩余空间不足" });
      return;
    }

    const placedItem = {
      ...item,
      length: placement.length,
      width: placement.width,
      height: placement.height,
      x: placement.x,
      y: placement.y,
      z: 0
    };
    placed.push(placedItem);
    splitFreeRects(freeRects, placedItem);
    pruneFreeRects(freeRects);
  });

  return { placed, unpacked };
}

function findBestGroundPlacement(container, item, freeRects) {
  const options = getOrientations(item)
    .filter((o) =>
      o.width <= container.doorWidth &&
      o.height <= container.doorHeight &&
      o.height <= container.innerHeight
    );
  let best = null;

  freeRects.forEach((rect, rectIndex) => {
    options.forEach((option) => {
      if (option.length > rect.length || option.width > rect.width) return;
      const leftoverLength = rect.length - option.length;
      const leftoverWidth = rect.width - option.width;
      const score = {
        areaWaste: rect.length * rect.width - option.length * option.width,
        shortSide: Math.min(leftoverLength, leftoverWidth),
        longSide: Math.max(leftoverLength, leftoverWidth),
        y: rect.y,
        x: rect.x
      };
      if (!best || compareScore(score, best.score) < 0) {
        best = { ...option, x: rect.x, y: rect.y, rectIndex, score };
      }
    });
  });

  return best;
}

function compareScore(a, b) {
  return (
    a.areaWaste - b.areaWaste ||
    a.shortSide - b.shortSide ||
    a.longSide - b.longSide ||
    a.y - b.y ||
    a.x - b.x
  );
}

function splitFreeRects(freeRects, used) {
  for (let i = freeRects.length - 1; i >= 0; i -= 1) {
    const rect = freeRects[i];
    if (!rectsOverlap(rect, used)) continue;
    freeRects.splice(i, 1);

    const rectRight = rect.x + rect.length;
    const rectBottom = rect.y + rect.width;
    const usedRight = used.x + used.length;
    const usedBottom = used.y + used.width;

    if (used.x > rect.x) {
      freeRects.push({ x: rect.x, y: rect.y, length: used.x - rect.x, width: rect.width });
    }
    if (usedRight < rectRight) {
      freeRects.push({ x: usedRight, y: rect.y, length: rectRight - usedRight, width: rect.width });
    }
    if (used.y > rect.y) {
      freeRects.push({ x: rect.x, y: rect.y, length: rect.length, width: used.y - rect.y });
    }
    if (usedBottom < rectBottom) {
      freeRects.push({ x: rect.x, y: usedBottom, length: rect.length, width: rectBottom - usedBottom });
    }
  }
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.length &&
    a.x + a.length > b.x &&
    a.y < b.y + b.width &&
    a.y + a.width > b.y
  );
}

function pruneFreeRects(freeRects) {
  for (let i = 0; i < freeRects.length; i += 1) {
    for (let j = i + 1; j < freeRects.length; j += 1) {
      if (containsRect(freeRects[i], freeRects[j])) {
        freeRects.splice(j, 1);
        j -= 1;
      } else if (containsRect(freeRects[j], freeRects[i])) {
        freeRects.splice(i, 1);
        i -= 1;
        break;
      }
    }
  }
}

function containsRect(a, b) {
  return (
    b.x >= a.x &&
    b.y >= a.y &&
    b.x + b.length <= a.x + a.length &&
    b.y + b.width <= a.y + a.width
  );
}

function calculate() {
  const container = readContainer();
  const crates = readCrates();
  const validation = validate(container, crates);
  if (validation.length) {
    renderMessages(validation);
    resetResult();
    return;
  }

  const result = pack(container, crates);
  const totalPieces = crates.reduce((sum, crate) => sum + crate.quantity, 0);
  const loadedWeight = result.placed.reduce((sum, item) => sum + item.weight, 0);
  const totalWeight = crates.reduce((sum, item) => sum + item.quantity * item.weight, 0);
  const loadedVolume = result.placed.reduce((sum, item) => sum + item.length * item.width * item.height, 0);
  const cargoVolume = crates.reduce((sum, item) => sum + item.length * item.width * item.height * item.quantity, 0);
  const containerVolume = container.innerLength * container.innerWidth * container.innerHeight;
  const overweight = loadedWeight > container.maxWeight;
  const failed = result.unpacked.length > 0 || overweight;

  $("#resultStatus").textContent = failed ? "需要调整" : "可以装";
  $("#resultStatus").className = failed ? "status-bad" : "status-ok";
  $("#loadedPieces").textContent = `${result.placed.length} / ${totalPieces}`;
  $("#volumeUsage").textContent = `${formatPercent(loadedVolume / containerVolume)} / 货物 ${formatPercent(cargoVolume / containerVolume)}`;
  $("#weightUsage").textContent = `${formatPercent(loadedWeight / container.maxWeight)} / 货物 ${formatPercent(totalWeight / container.maxWeight)}`;

  const messages = [];
  if (result.unpacked.length) {
    const doorCount = result.unpacked.filter((item) => item.reason === "无法通过柜门开口").length;
    if (doorCount) messages.push({ type: "bad", text: `${doorCount} 件木箱无法通过柜门开口，请缩小包装或拆分木箱。` });
    messages.push({ type: "bad", text: `共有 ${result.unpacked.length} 件未能装入，明细见下方表格。` });
  }
  if (overweight) {
    messages.push({ type: "bad", text: `已装重量 ${loadedWeight.toFixed(1)} kg，超过最大载重 ${container.maxWeight.toFixed(1)} kg。` });
  }
  if (!messages.length) {
    messages.push({ type: "ok", text: "当前方案通过柜门开口、柜内空间和重量检查。" });
  }
  messages.push({
    type: "warn",
    text: container.allowStacking
      ? "本版采用3D空间优化算法，允许木箱任意旋转并向上堆叠；正式装柜前仍建议仓库确认承重、稳定性和作业空间。"
      : "本版采用地面空位优化算法，会优先填补可用空位且不自动悬空堆叠；正式装柜前仍建议仓库确认承重、吊装方向和作业空间。"
  });

  renderMessages(messages);
  renderViews(container, result.placed);
  renderDetails(result, loadedWeight);
  saveDraft();
}

function resetResult() {
  $("#resultStatus").textContent = "待计算";
  $("#resultStatus").className = "";
  $("#loadedPieces").textContent = "-";
  $("#volumeUsage").textContent = "-";
  $("#weightUsage").textContent = "-";
  $("#topView").innerHTML = "";
  $("#sideView").innerHTML = "";
  clear3dView("请先修正上方提示。");
  $("#detailArea").className = "empty";
  $("#detailArea").textContent = "请先修正上方提示。";
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${Math.round(value * 1000) / 10}%`;
}

function renderMessages(messages) {
  $("#messages").innerHTML = messages.map((message) => {
    const className = message.type === "bad" ? "msg bad" : message.type === "ok" ? "msg ok" : "msg";
    return `<div class="${className}">${escapeHtml(message.text)}</div>`;
  }).join("");
}

function renderViews(container, placed) {
  const topView = $("#topView");
  const sideView = $("#sideView");
  topView.innerHTML = "";
  sideView.innerHTML = "";
  $("#topViewLabel").textContent = `${container.innerLength} × ${container.innerWidth} mm`;
  $("#sideViewLabel").textContent = `${container.innerLength} × ${container.innerHeight} mm`;

  placed.forEach((item) => {
    const color = colors[item.crateIndex % colors.length];
    topView.appendChild(createBox(item, color, {
      left: item.x / container.innerLength,
      top: item.y / container.innerWidth,
      width: item.length / container.innerLength,
      height: item.width / container.innerWidth
    }));
    sideView.appendChild(createBox(item, color, {
      left: item.x / container.innerLength,
      top: 1 - (item.z + item.height) / container.innerHeight,
      width: item.length / container.innerLength,
      height: item.height / container.innerHeight
    }));
  });
  render3dView(container, placed);
}

function createBox(item, color, ratio) {
  const box = document.createElement("div");
  box.className = "box";
  box.style.left = `${ratio.left * 100}%`;
  box.style.top = `${ratio.top * 100}%`;
  box.style.width = `${ratio.width * 100}%`;
  box.style.height = `${ratio.height * 100}%`;
  box.style.background = color;
  box.title = `${item.name} #${item.pieceNo} ${item.length}×${item.width}×${item.height} mm`;
  box.textContent = item.name;
  return box;
}

function loadThree() {
  if (threeState?.THREE) return threeState;
  if (!window.THREE) throw new Error("Three.js 未加载");
  threeState = { THREE: window.THREE, renderer: null, scene: null, camera: null, cleanupControls: null, resizeObserver: null };
  return threeState;
}

async function render3dView(container, placed) {
  const host = $("#view3d");
  const hint = $("#view3dHint");
  hint.textContent = "3D 图加载中...";
  hint.style.display = "grid";
  $("#view3dLabel").textContent = `${container.innerLength} × ${container.innerWidth} × ${container.innerHeight} mm`;

  try {
    const state = loadThree();
    const { THREE } = state;
    host.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
    if (state.cleanupControls) state.cleanupControls();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.1, 5000);
    const root = new THREE.Group();
    scene.add(root);

    const scale = 1000;
    const length = container.innerLength / scale;
    const width = container.innerWidth / scale;
    const height = container.innerHeight / scale;
    const maxSide = Math.max(length, width, height);

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const light = new THREE.DirectionalLight(0xffffff, 1.4);
    light.position.set(maxSide * 0.8, maxSide * 1.2, maxSide * 0.9);
    scene.add(light);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(length, width),
      new THREE.MeshStandardMaterial({ color: 0xe5ecef, roughness: 0.9, metalness: 0 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    root.add(floor);

    const grid = new THREE.GridHelper(Math.max(length, width), 24, 0x7b8790, 0xc5ced4);
    grid.scale.z = width / Math.max(length, width);
    grid.position.y = 0.002;
    root.add(grid);

    const containerBox = new THREE.BoxGeometry(length, height, width);
    const edges = new THREE.EdgesGeometry(containerBox);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1f2933, linewidth: 1 }));
    line.position.y = height / 2;
    root.add(line);

    const door = new THREE.Mesh(
      new THREE.PlaneGeometry(container.doorWidth / scale, container.doorHeight / scale),
      new THREE.MeshBasicMaterial({ color: 0x0f766e, transparent: true, opacity: 0.12, side: THREE.DoubleSide })
    );
    door.position.set(-length / 2 - 0.01, container.doorHeight / scale / 2, 0);
    door.rotation.y = Math.PI / 2;
    root.add(door);

    placed.forEach((item) => {
      const geometry = new THREE.BoxGeometry(item.length / scale, item.height / scale, item.width / scale);
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colors[item.crateIndex % colors.length]),
        roughness: 0.7,
        metalness: 0,
        transparent: true,
        opacity: 0.96
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(
        -length / 2 + (item.x + item.length / 2) / scale,
        (item.z + item.height / 2) / scale,
        -width / 2 + (item.y + item.width / 2) / scale
      );
      mesh.userData.title = `${item.name} #${item.pieceNo}`;
      root.add(mesh);

      const itemEdges = new THREE.EdgesGeometry(geometry);
      const itemLine = new THREE.LineSegments(itemEdges, new THREE.LineBasicMaterial({ color: 0x26343c }));
      itemLine.position.copy(mesh.position);
      root.add(itemLine);
    });

    camera.position.set(length * 0.7, Math.max(height * 1.1, 3.2), width * 2.8);
    camera.lookAt(0, height / 2, 0);
    root.rotation.y = -0.32;
    root.rotation.x = -0.08;
    state.cleanupControls = setupDragControls(host, root, camera, maxSide);

    if (state.resizeObserver) state.resizeObserver.disconnect();
    state.resizeObserver = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    state.resizeObserver.observe(host);

    state.renderer = renderer;
    state.scene = scene;
    state.camera = camera;

    hint.style.display = placed.length ? "none" : "grid";
    if (!placed.length) hint.textContent = "没有已装入木箱可显示";

    const animate = () => {
      if (threeState?.renderer !== renderer) return;
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    };
    animate();
  } catch (error) {
    console.error(error);
    clear3dView("3D 图加载失败，请刷新页面后重试。");
  }
}

function clear3dView(message) {
  const host = $("#view3d");
  if (!host) return;
  host.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
  if (threeState?.cleanupControls) {
    threeState.cleanupControls();
    threeState.cleanupControls = null;
  }
  const hint = $("#view3dHint");
  hint.textContent = message || "点击“计算装柜”后显示 3D 图";
  hint.style.display = "grid";
}

function setupDragControls(host, root, camera, maxSide) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const minDistance = Math.max(maxSide * 0.8, 4);
  const maxDistance = Math.max(maxSide * 5, 18);

  const pointerDown = (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    host.setPointerCapture?.(event.pointerId);
  };
  const pointerMove = (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    root.rotation.y += dx * 0.008;
    root.rotation.x += dy * 0.005;
    root.rotation.x = Math.max(-0.9, Math.min(0.35, root.rotation.x));
    lastX = event.clientX;
    lastY = event.clientY;
  };
  const pointerUp = (event) => {
    dragging = false;
    host.releasePointerCapture?.(event.pointerId);
  };
  const wheel = (event) => {
    event.preventDefault();
    const distance = Math.hypot(camera.position.x, camera.position.y, camera.position.z);
    const nextDistance = Math.max(minDistance, Math.min(maxDistance, distance + event.deltaY * 0.01));
    const ratio = nextDistance / distance;
    camera.position.multiplyScalar(ratio);
    camera.lookAt(0, 0, 0);
  };

  host.addEventListener("pointerdown", pointerDown);
  host.addEventListener("pointermove", pointerMove);
  host.addEventListener("pointerup", pointerUp);
  host.addEventListener("pointerleave", pointerUp);
  host.addEventListener("wheel", wheel, { passive: false });

  return () => {
    host.removeEventListener("pointerdown", pointerDown);
    host.removeEventListener("pointermove", pointerMove);
    host.removeEventListener("pointerup", pointerUp);
    host.removeEventListener("pointerleave", pointerUp);
    host.removeEventListener("wheel", wheel);
  };
}

function renderDetails(result, loadedWeight) {
  const rows = [
    ...result.placed.map((item, index) => detailRow(index + 1, item, "已装", `${item.x}, ${item.y}, ${item.z}`)),
    ...result.unpacked.map((item, index) => detailRow(result.placed.length + index + 1, item, item.reason, "-"))
  ].join("");

  $("#detailArea").className = "table-wrap";
  $("#detailArea").innerHTML = `
    <table class="detail-table">
      <thead>
        <tr>
          <th>序号</th>
          <th>木箱</th>
          <th>尺寸 mm</th>
          <th>位置 x,y,z mm</th>
          <th>重量 kg</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <th colspan="4">已装重量</th>
          <th colspan="2">${loadedWeight.toFixed(1)} kg</th>
        </tr>
      </tfoot>
    </table>
  `;
}

function detailRow(index, item, status, position) {
  return `
    <tr>
      <td>${index}</td>
      <td>${escapeHtml(item.name)} #${item.pieceNo}</td>
      <td>${item.length} × ${item.width} × ${item.height}</td>
      <td>${position}</td>
      <td>${item.weight}</td>
      <td>${escapeHtml(status)}</td>
    </tr>
  `;
}

function loadSample() {
  loadData({
    containerType: "40HQ",
    container: containers["40HQ"],
    crates: [
      { name: "平开窗木箱 A", length: 2200, width: 760, height: 1450, quantity: 8, weight: 180, rotatable: true },
      { name: "推拉门木箱 B", length: 2600, width: 820, height: 1680, quantity: 6, weight: 240, rotatable: true },
      { name: "配件箱", length: 900, width: 700, height: 650, quantity: 4, weight: 120, rotatable: true }
    ]
  });
  calculate();
}

function saveDraft() {
  const data = {
    containerType: $("#containerType").value,
    container: readContainer(),
    crates: readCrates()
  };
  localStorage.setItem(draftKey, JSON.stringify(data));
}

function loadDraft() {
  const raw = localStorage.getItem(draftKey);
  if (!raw) return false;
  try {
    loadData(JSON.parse(raw));
    return true;
  } catch {
    return false;
  }
}

function loadData(data) {
  $("#containerType").value = data.containerType || "custom";
  const container = data.container || containers[data.containerType] || containers["40HQ"];
  $("#innerLength").value = container.innerLength || "";
  $("#innerWidth").value = container.innerWidth || "";
  $("#innerHeight").value = container.innerHeight || "";
  $("#doorWidth").value = container.doorWidth || "";
  $("#doorHeight").value = container.doorHeight || "";
  $("#maxWeight").value = container.maxWeight || "";
  $("#allowStacking").checked = container.allowStacking !== false;
  crateBody.innerHTML = "";
  (data.crates || []).forEach(addCrate);
  if (!crateBody.children.length) addCrate();
  saveDraft();
}

function exportData() {
  const data = {
    containerType: $("#containerType").value,
    container: readContainer(),
    crates: readCrates(),
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "装柜方案.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      loadData(JSON.parse(reader.result));
      calculate();
    } catch {
      renderMessages([{ type: "bad", text: "导入失败，请选择本工具导出的方案文件。" }]);
    }
  };
  reader.readAsText(file);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

$("#containerType").addEventListener("change", (event) => {
  if (event.target.value !== "custom") setContainer(event.target.value);
  saveDraft();
});

["#innerLength", "#innerWidth", "#innerHeight", "#doorWidth", "#doorHeight", "#maxWeight"].forEach((selector) => {
  $(selector).addEventListener("input", () => {
    $("#containerType").value = "custom";
    saveDraft();
  });
});
$("#allowStacking").addEventListener("change", saveDraft);

$("#addCrateBtn").addEventListener("click", () => {
  addCrate();
  saveDraft();
});
$("#calculateBtn").addEventListener("click", calculate);
$("#sampleBtn").addEventListener("click", loadSample);
$("#exportBtn").addEventListener("click", exportData);
$("#importFile").addEventListener("change", (event) => {
  if (event.target.files[0]) importData(event.target.files[0]);
  event.target.value = "";
});

$("#loginForm").addEventListener("submit", handleLogin);
$("#logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem(loginSessionKey);
  showLogin();
});

if (!loadDraft()) {
  setContainer("40HQ");
  addCrate({ name: "门窗木箱", quantity: 1, weight: 0, rotatable: true });
  saveDraft();
}

if (sessionStorage.getItem(loginSessionKey) === "ok") {
  showApplication();
} else {
  showLogin();
}
