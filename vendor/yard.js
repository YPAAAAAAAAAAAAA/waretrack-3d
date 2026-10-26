(function () {
  "use strict";

  var canvas = document.getElementById("canvas");
  var ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  var GRASS = [86, 114, 74];
  var GRASS2 = [70, 98, 62];
  var PAD = [206, 198, 182];
  var ROAD = [62, 68, 76];
  var STRIPE = [214, 186, 96];
  var WALL = [232, 226, 214];
  var CAB = [236, 232, 224];
  var WOOD = [158, 118, 74];

  var LX = -0.38, LY = 0.84, LZ = 0.39;
  var llen = Math.hypot(LX, LY, LZ);
  LX /= llen; LY /= llen; LZ /= llen;

  var HOME = { x: 0, y: 2.1, z: 0.6 };
  var look = { x: HOME.x, y: HOME.y, z: HOME.z };
  var want = { x: HOME.x, y: HOME.y, z: HOME.z };
  var yaw = 0.58;
  var pitch = 0.72;
  var userZoom = 1;
  var frameMul = 1;
  var wantMul = 1;
  var zoom = 8;
  var cx = 0;
  var cy = 0;
  var sim = 0;
  var last = 0;
  var uiAcc = 1;
  var cosY = 1, sinY = 0, cosP = 1, sinP = 0;
  var camVX = 0, camVY = 1, camVZ = 0;
  var sky = null;

  var FRAME = [
    [-42, 0, -42], [40, 0, -42], [40, 0, 48], [-42, 0, 48],
    [-36, 14, -32], [0, 8, -29], [32, 7, 1], [-32, 8, -1], [0, 4, 42]
  ];

  var halls = [
    { id: "NS-1", name: "North Span", role: "Crossdock", x: 0, z: -29, w: 28, d: 8, h: 5.7, face: "s", doors: 6, roof: [32, 114, 132], wall: WALL, ink: "light" },
    { id: "IH-2", name: "Icehouse", role: "Cold store", x: -31, z: -1, w: 8, d: 18, h: 6.6, face: "e", doors: 5, roof: [64, 132, 168], wall: [206, 216, 222], ink: "light" },
    { id: "KY-3", name: "Kiln Yard", role: "Bulk", x: 31, z: 1, w: 8, d: 20, h: 5.4, face: "w", doors: 5, roof: [176, 92, 54], wall: [226, 212, 196], ink: "light" },
    { id: "SB-4", name: "Swift Bay", role: "Parcels", x: -13, z: 29, w: 16, d: 8, h: 4.8, face: "n", doors: 4, roof: [214, 156, 64], wall: WALL, ink: "dark" },
    { id: "LG-5", name: "Loop Gate", role: "Returns", x: 13, z: 29, w: 16, d: 8, h: 5.1, face: "n", doors: 4, roof: [124, 70, 112], wall: [228, 220, 214], ink: "light" }
  ];

  var carriers = [
    { id: "NV-14", name: "Northline", period: 22, phase: 0.03, body: [26, 128, 132], order: "SO-1902", sku: "Mailers", dest: "Swift Bay" },
    { id: "HB-07", name: "Harbor", period: 26, phase: 0.28, body: [184, 62, 52], order: "SO-1760", sku: "Crates", dest: "North Span" },
    { id: "KL-22", name: "Kiln", period: 19, phase: 0.52, body: [212, 144, 46], order: "SO-1844", sku: "Coil wrap", dest: "Kiln Yard" },
    { id: "MS-11", name: "Moss", period: 24, phase: 0.76, body: [62, 122, 76], order: "SO-2011", sku: "Drums", dest: "Loop Gate" }
  ];

  var forks = [
    { id: "FK-2", hall: "NS-1", ax: -6, az: -5, bx: -6, bz: -23.2, period: 8.2, phase: 0.15 },
    { id: "FK-5", hall: "IH-2", ax: -10, az: 3, bx: -24.6, bz: 3, period: 9.4, phase: 0.45 },
    { id: "FK-8", hall: "KY-3", ax: 4, az: -0.8, bx: 24.6, bz: -0.8, period: 7.6, phase: 0.05 },
    { id: "FK-11", hall: "SB-4", ax: -8, az: 10, bx: -8, bz: 23.4, period: 8.8, phase: 0.55 },
    { id: "FK-14", hall: "LG-5", ax: 6, az: 10, bx: 6, bz: 23.4, period: 10.2, phase: 0.3 }
  ];

  var orders = [
    { id: "SO-1902", sku: "Mailers", truck: "NV-14", p: 0.34 },
    { id: "SO-1760", sku: "Crates", truck: "HB-07", p: 0.61 },
    { id: "SO-1844", sku: "Coil wrap", truck: "KL-22", p: 0.22 },
    { id: "SO-2011", sku: "Drums", truck: "MS-11", p: 0.78 }
  ];

  var slabs = [];
  var staticBoxes = [];
  var stillTrucks = [];
  var doorSpots = [];
  var book = {};
  var picks = [];
  var sel = null;
  var facePool = [];
  var faceN = 0;
  var orderIdx = [];
  var corn = new Float32Array(24);
  var audioOn = false;

  var FACE = {
    s: { ox: 0, oz: 1, ax: 1, az: 0 },
    n: { ox: 0, oz: -1, ax: 1, az: 0 },
    e: { ox: 1, oz: 0, ax: 0, az: 1 },
    w: { ox: -1, oz: 0, ax: 0, az: 1 }
  };
  var QUADS = [
    { nx: 0, ny: 1, nz: 0, q: [3, 2, 6, 7] },
    { nx: 0, ny: -1, nz: 0, q: [0, 4, 5, 1] },
    { nx: 1, ny: 0, nz: 0, q: [1, 5, 6, 2] },
    { nx: -1, ny: 0, nz: 0, q: [4, 0, 3, 7] },
    { nx: 0, ny: 0, nz: 1, q: [4, 5, 6, 7] },
    { nx: 0, ny: 0, nz: -1, q: [1, 0, 3, 2] }
  ];

  function slab(x, z, w, d, y, rgb) {
    slabs.push({ x: x, z: z, w: w, d: d, y: y, rgb: rgb });
  }

  function box(x, y, z, yaw, w, h, d, rgb, em, hot, pick) {
    staticBoxes.push({ x: x, y: y, z: z, yaw: yaw, w: w, h: h, d: d, rgb: rgb, em: em || 0, hot: hot || 0, pick: pick || null });
  }

  function prepCam() {
    cosY = Math.cos(yaw);
    sinY = Math.sin(yaw);
    cosP = Math.cos(pitch);
    sinP = Math.sin(pitch);
    camVX = sinY * cosP;
    camVY = sinP;
    camVZ = cosY * cosP;
  }

  function project(x, y, z) {
    var X = x - look.x;
    var Y = y - look.y;
    var Z = z - look.z;
    var x1 = X * cosY - Z * sinY;
    var z1 = X * sinY + Z * cosY;
    var y2 = Y * cosP - z1 * sinP;
    var z2 = Y * sinP + z1 * cosP;
    return [cx + x1 * zoom, cy - y2 * zoom, z2];
  }

  function shade(nx, ny, nz, rgb, em) {
    var L;
    if (em === 2) L = 0.8 + 0.2 * Math.sin(sim * 2.3 + nx + nz);
    else if (em === 1) L = 0.94;
    else L = 0.3 + 0.58 * Math.max(0, nx * LX + ny * LY + nz * LZ) + 0.18 * ny;
    if (L < 0.2) L = 0.2;
    if (L > 1.35) L = 1.35;
    return [rgb[0] * L, rgb[1] * L, rgb[2] * L];
  }

  function emitBox(x, y, z, yaw, w, h, d, rgb, em, hot) {
    var hx = w * 0.5, hy = h * 0.5, hz = d * 0.5;
    var c = Math.cos(yaw), s = Math.sin(yaw);
    var loc = [
      -hx, -hy, -hz, hx, -hy, -hz, hx, hy, -hz, -hx, hy, -hz,
      -hx, -hy, hz, hx, -hy, hz, hx, hy, hz, -hx, hy, hz
    ];
    var i, xr, zr;
    for (i = 0; i < 8; i++) {
      xr = loc[i * 3] * c + loc[i * 3 + 2] * s;
      zr = -loc[i * 3] * s + loc[i * 3 + 2] * c;
      corn[i * 3] = x + xr;
      corn[i * 3 + 1] = y + loc[i * 3 + 1];
      corn[i * 3 + 2] = z + zr;
    }
    for (i = 0; i < 6; i++) {
      var q = QUADS[i];
      var nx = q.nx * c + q.nz * s;
      var ny = q.ny;
      var nz = -q.nx * s + q.nz * c;
      if (nx * camVX + ny * camVY + nz * camVZ <= 0.015) continue;
      var col = shade(nx, ny, nz, rgb, em);
      var f = facePool[faceN];
      if (!f) {
        f = { p: new Float32Array(12), depth: 0, r: 0, g: 0, b: 0, hot: 0 };
        facePool.push(f);
      }
      var depth = 0;
      var k;
      for (k = 0; k < 4; k++) {
        var vi = q.q[k] * 3;
        var pr = project(corn[vi], corn[vi + 1], corn[vi + 2]);
        f.p[k * 3] = pr[0];
        f.p[k * 3 + 1] = pr[1];
        depth += pr[2];
      }
      f.depth = depth * 0.25;
      f.r = col[0];
      f.g = col[1];
      f.b = col[2];
      f.hot = hot ? 1 : 0;
      faceN++;
    }
  }

  function loopPoint(t) {
    var x0 = -20, x1 = 20, z0 = -18, z1 = 18, r = 6;
    var sx = x1 - x0 - 2 * r;
    var sz = z1 - z0 - 2 * r;
    var arc = Math.PI * r * 0.5;
    var per = 2 * (sx + sz) + 4 * arc;
    var d = ((t % 1) + 1) % 1 * per;
    var a;
    if (d < sx) return { x: x0 + r + d, z: z1 };
    d -= sx;
    if (d < arc) {
      a = d / r;
      return { x: x1 - r + Math.sin(a) * r, z: z1 - r + Math.cos(a) * r };
    }
    d -= arc;
    if (d < sz) return { x: x1, z: z1 - r - d };
    d -= sz;
    if (d < arc) {
      a = d / r;
      return { x: x1 - r + Math.cos(a) * r, z: z0 + r - Math.sin(a) * r };
    }
    d -= arc;
    if (d < sx) return { x: x1 - r - d, z: z0 };
    d -= sx;
    if (d < arc) {
      a = d / r;
      return { x: x0 + r - Math.sin(a) * r, z: z0 + r - Math.cos(a) * r };
    }
    d -= arc;
    if (d < sz) return { x: x0, z: z0 + r + d };
    d -= sz;
    a = d / r;
    return { x: x0 + r - Math.cos(a) * r, z: z1 - r + Math.sin(a) * r };
  }

  function shuttle(t, period) {
    var u = ((t % period) + period) % period / period;
    var s;
    if (u < 0.12) s = 0;
    else if (u < 0.42) s = (u - 0.12) / 0.3;
    else if (u < 0.62) s = 1;
    else if (u < 0.92) s = 1 - (u - 0.62) / 0.3;
    else s = 0;
    return { s: s, u: u };
  }

  function addHall(h) {
    var f = FACE[h.face];
    var along = (h.face === "n" || h.face === "s") ? h.w : h.d;
    var depth = (h.face === "n" || h.face === "s") ? h.d : h.w;
    var sign = (h.face === "n" || h.face === "w") ? -1 : 1;
    box(h.x, h.h * 0.5, h.z, 0, h.w, h.h, h.d, h.wall, 0, 0, { kind: "hall", id: h.id, y: h.h * 0.55 });
    box(h.x, h.h + 0.18, h.z, 0, h.w + 0.55, 0.36, h.d + 0.55, h.roof, 0);
    var hw = Math.min(1.5, Math.min(h.w, h.d) * 0.22);
    box(h.x - h.w * 0.18, h.h + 0.58, h.z - h.d * 0.12, 0, hw, 0.5, hw * 0.8, [168, 164, 156], 0);
    slab(h.x, h.z, h.w + 1.4, h.d + 1.4, 0.02, PAD);
    if (h.face === "s" || h.face === "n") {
      slab(h.x, h.z + sign * (h.d * 0.5 + 3.1), h.w + 0.8, 6.2, 0.03, PAD);
      box(h.x, 3.15, h.z + sign * (h.d * 0.5 + 0.9), 0, h.w * 0.92, 0.16, 1.8, h.roof, 0);
      box(h.x, h.h * 0.62, h.z + sign * (h.d * 0.5 + 0.08), 0, h.w * 0.62, 0.5, 0.1, [255, 214, 156], 1);
    } else {
      slab(h.x + sign * (h.w * 0.5 + 3.1), h.z, 6.2, h.d + 0.8, 0.03, PAD);
      box(h.x + sign * (h.w * 0.5 + 0.9), 3.15, h.z, 0, 1.8, 0.16, h.d * 0.9, h.roof, 0);
      box(h.x + sign * (h.w * 0.5 + 0.08), h.h * 0.62, h.z, 0, 0.1, 0.5, h.d * 0.62, [255, 214, 156], 1);
    }
    var n = h.doors;
    var i;
    for (i = 0; i < n; i++) {
      var t = (i + 0.5) / n - 0.5;
      var dist = t * (along - 2.4);
      var px = h.x + f.ax * dist + f.ox * (depth * 0.5 + 0.08);
      var pz = h.z + f.az * dist + f.oz * (depth * 0.5 + 0.08);
      var dw = (h.face === "n" || h.face === "s") ? 1.45 : 0.12;
      var dd = (h.face === "n" || h.face === "s") ? 0.12 : 1.45;
      box(px, 1.25, pz, 0, dw, 2.5, dd, [42, 46, 52], 0);
      box(px + f.ox * 0.25, 2.72, pz + f.oz * 0.25, 0, 0.26, 0.18, 0.26, [255, 206, 120], 2);
      doorSpots.push({ hall: h.id, i: i, x: px + f.ox * 4.4, z: pz + f.oz * 4.4, face: h.face });
    }
    book[h.id] = { kind: "hall", id: h.id, name: h.name, role: h.role, doors: h.doors, x: h.x, y: h.h * 0.4, z: h.z };
  }

  function emitTruck(x, z, heading, body, hot) {
    var c = Math.cos(heading), s = Math.sin(heading);
    function part(lx, ly, lz, w, h, d, rgb, em) {
      var X = lx * c + lz * s;
      var Z = -lx * s + lz * c;
      emitBox(x + X, ly, z + Z, heading, w, h, d, rgb, em || 0, hot);
    }
    part(0, 1.15, -0.65, 2.35, 1.9, 6.2, body, 0);
    part(0, 1.02, 3.1, 2.05, 1.7, 2.15, CAB, 0);
    part(0, 1.28, 3.95, 1.55, 0.62, 0.12, [176, 214, 222], 1);
    part(-0.72, 0.32, -2.5, 0.32, 0.64, 0.64, [38, 40, 44], 0);
    part(0.72, 0.32, -2.5, 0.32, 0.64, 0.64, [38, 40, 44], 0);
    part(-0.72, 0.32, 2.35, 0.32, 0.64, 0.64, [38, 40, 44], 0);
    part(0.72, 0.32, 2.35, 0.32, 0.64, 0.64, [38, 40, 44], 0);
    part(-0.7, 0.95, -3.7, 0.24, 0.22, 0.1, [255, 64, 54], 1);
    part(0.7, 0.95, -3.7, 0.24, 0.22, 0.1, [255, 64, 54], 1);
  }

  function emitFork(x, z, heading, hot, loaded) {
    var c = Math.cos(heading), s = Math.sin(heading);
    function part(lx, ly, lz, w, h, d, rgb, em) {
      var X = lx * c + lz * s;
      var Z = -lx * s + lz * c;
      emitBox(x + X, ly, z + Z, heading, w, h, d, rgb, em || 0, hot);
    }
    part(0, 0.7, -0.15, 1.45, 0.95, 2.15, [232, 168, 42], 0);
    part(0, 1.55, 0.78, 1.15, 1.45, 0.22, [68, 72, 76], 0);
    part(0, 0.28, 1.45, 1.05, 0.1, 1.1, [88, 92, 96], 0);
    part(0, 1.55, -0.25, 1.3, 0.12, 1.1, [48, 50, 54], 0);
    if (loaded) {
      part(0, 0.64, 1.5, 1.15, 0.5, 0.9, [198, 90, 72], 0);
      part(0, 0.28, 1.5, 1.2, 0.18, 0.95, WOOD, 0);
    }
  }

  function buildWorld() {
    slab(0, 70, 640, 560, 0, GRASS);
    slab(-36, -8, 90, 70, 0.004, GRASS2);
    slab(28, 36, 80, 64, 0.004, [78, 108, 68]);
    slab(-20, -70, 5.4, 130, 0.05, ROAD);
    slab(0, 92, 5.4, 120, 0.05, ROAD);
    slab(0, 0, 34.6, 30.6, 0.028, PAD);
    slab(0, -18, 46, 5.4, 0.05, ROAD);
    slab(0, 18, 46, 5.4, 0.05, ROAD);
    slab(-20, 0, 5.4, 41.4, 0.05, ROAD);
    slab(20, 0, 5.4, 41.4, 0.05, ROAD);
    slab(0, 33, 5.2, 24, 0.05, ROAD);

    var x, z, i;
    for (x = -12; x <= 12; x += 3.3) {
      slab(x, -18, 1.45, 0.22, 0.08, STRIPE);
      slab(x, 18, 1.45, 0.22, 0.08, STRIPE);
    }
    for (z = -12; z <= 12; z += 3.3) {
      slab(-20, z, 0.22, 1.45, 0.08, STRIPE);
      slab(20, z, 0.22, 1.45, 0.08, STRIPE);
    }
    for (z = 24; z <= 42; z += 3.1) slab(0, z, 0.2, 1.3, 0.08, STRIPE);

    for (i = 0; i < halls.length; i++) addHall(halls[i]);

    for (i = 0; i < 6; i++) {
      x = -9.5 + i * 3.5;
      slab(x, -21.8, 1.2, 4.4, 0.06, i % 2 ? STRIPE : [196, 188, 170]);
    }

    var wraps = [[214, 84, 70], [58, 138, 168], [228, 176, 70], [86, 150, 96], [232, 228, 220], [168, 112, 72]];
    for (var ix = 0; ix < 4; ix++) {
      for (var iz = 0; iz < 3; iz++) {
        x = -13.2 + ix * 2.05;
        z = -8.2 + iz * 2.35;
        var layers = 2 + ((ix + iz) % 3);
        box(x, layers * 0.2, z, 0, 1.12, layers * 0.4, 0.92, WOOD, 0);
        box(x, layers * 0.4 + 0.1, z, 0, 1.02, 0.2, 0.82, wraps[(ix * 3 + iz) % wraps.length], 0);
      }
    }

    var cols = [[176, 62, 54], [44, 108, 158], [214, 148, 56], [68, 128, 88]];
    var czs = [-12.2, -5.4, 3.8, 11.2];
    for (i = 0; i < czs.length; i++) {
      box(11.6, 1.25, czs[i], 0, 2.4, 2.5, 5.3, cols[i], 0);
    }
    box(11.6, 3.75, czs[0], 0, 2.4, 2.45, 5.3, [196, 192, 184], 0);

    for (i = 0; i < 4; i++) {
      x = -4.5 + i * 3;
      slab(x, 11.4, 1.7, 1.25, 0.045, [64, 72, 78]);
      box(x, 0.85, 11.75, 0, 0.16, 1.6, 0.16, [78, 84, 90], 0, 0, { kind: "charger", id: "CH-" + (i + 1), y: 1.2 });
      box(x, 1.7, 11.75, 0, 0.34, 0.2, 0.34, [116, 214, 146], 2);
      book["CH-" + (i + 1)] = { kind: "charger", id: "CH-" + (i + 1), x: x, y: 1.2, z: 11.75 };
    }

    var poles = [[-15.2, -12.2], [15.2, -12.2], [-15.2, 12.2], [15.2, 12.2]];
    for (i = 0; i < poles.length; i++) {
      box(poles[i][0], 2.7, poles[i][1], 0, 0.18, 5.4, 0.18, [92, 94, 98], 0);
      box(poles[i][0], 5.25, poles[i][1], 0, 0.85, 0.16, 0.85, [255, 220, 160], 1);
    }

    box(-36, 6.3, -32, 0, 4.3, 12.6, 4.3, [184, 196, 206], 0, 0, { kind: "tower", id: "CT-1", y: 8 });
    box(-36, 12.75, -32, 0, 4.9, 0.32, 4.9, [36, 48, 60], 0);
    box(-36, 4.2, -29.8, 0, 2.5, 0.42, 0.1, [255, 214, 150], 1);
    box(-36, 8.1, -29.8, 0, 2.5, 0.42, 0.1, [255, 214, 150], 1);
    box(-36, 11.1, -29.8, 0, 3.0, 0.85, 0.1, [186, 220, 230], 1);
    book["CT-1"] = { kind: "tower", id: "CT-1", name: "Yard tower", x: -36, y: 8, z: -32 };

    box(-2.3, 1.35, 41, 0, 0.4, 2.7, 0.4, [72, 76, 80], 0);
    box(2.3, 1.35, 41, 0, 0.4, 2.7, 0.4, [72, 76, 80], 0);
    box(0, 2.55, 41, 0, 4.4, 0.16, 0.22, [214, 176, 72], 0);
    box(-3.6, 1.05, 39.2, 0, 1.8, 2.1, 1.6, WALL, 0);
    box(-3.6, 1.35, 38.35, 0, 0.7, 0.45, 0.08, [186, 216, 224], 1);

    box(-8, 1.15, -38.2, 0, 6.4, 2.3, 2.45, [44, 108, 158], 0);
    box(4, 1.15, -38.2, 0, 6.4, 2.3, 2.45, [176, 62, 54], 0);
    box(14, 2.4, -38.2, 0, 6.2, 2.2, 2.4, [214, 148, 56], 0);
    box(14, 1.15, -38.2, 0, 6.4, 2.3, 2.45, [68, 128, 88], 0);
    var queue = [
      [-27.2, -58, 0.4, [44, 108, 158]],
      [-27.2, -74, 0.15, [176, 62, 54]],
      [-27.2, -92, -0.1, [214, 148, 56]],
      [0, 64, Math.PI, [96, 110, 122]],
      [0, 82, Math.PI, [26, 128, 132]],
      [0, 102, Math.PI, [184, 62, 52]]
    ];
    for (i = 0; i < queue.length; i++) {
      stillTrucks.push({ x: queue[i][0], z: queue[i][1], heading: queue[i][2], body: queue[i][3] });
    }

    var trees = [
      [-24, -37], [20, -37.5], [-40, 6], [40, 8], [-24, 40], [6, 44], [38, 32], [-40, -18],
      [-28, -52], [-14, -56], [-28, -70], [-12, -74], [-27, -90], [-13, -96], [-26, -112],
      [8, 58], [-8, 64], [8, 78], [-8, 86], [9, 104], [-9, 112], [8, 128], [-8, 136]
    ];
    for (i = 0; i < trees.length; i++) {
      box(trees[i][0], 0.7, trees[i][1], 0, 0.35, 1.4, 0.35, [102, 76, 50], 0);
      box(trees[i][0], 2.15, trees[i][1], 0, 1.7, 1.5, 1.7, [62, 112, 70], 0);
    }

    var ns = doorSpots.filter(function (d) { return d.hall === "NS-1"; })[1];
    var ih = doorSpots.filter(function (d) { return d.hall === "IH-2"; })[2];
    book["PW-03"] = {
      kind: "truck", id: "PW-03", name: "Paper", sku: "Cartons", order: "SO-2118",
      dest: "North Span dock", parked: true, x: ns.x, y: 1.4, z: ns.z,
      heading: Math.PI, body: [96, 110, 122]
    };
    book["NV-21"] = {
      kind: "truck", id: "NV-21", name: "Northline", sku: "Chillers", order: "SO-1688",
      dest: "Icehouse dock", parked: true, x: ih.x, y: 1.4, z: ih.z,
      heading: -Math.PI / 2, body: [26, 128, 132]
    };

    carriers.forEach(function (c) {
      book[c.id] = {
        kind: "truck", id: c.id, name: c.name, sku: c.sku, order: c.order,
        dest: c.dest, parked: false, x: 0, y: 1.5, z: 0, heading: 0, body: c.body,
        period: c.period, phase: c.phase
      };
    });
    book["HB-19"] = {
      kind: "truck", id: "HB-19", name: "Harbor", sku: "Totes", order: "SO-2220",
      dest: "Gate lane", parked: false, gate: true, x: 0, y: 1.5, z: 40, heading: Math.PI,
      body: [184, 62, 52], period: 16, phase: 0.2
    };
    forks.forEach(function (f) {
      book[f.id] = {
        kind: "fork", id: f.id, hall: f.hall, x: f.ax, y: 0.8, z: f.az,
        heading: 0, loaded: false, period: f.period, phase: f.phase,
        ax: f.ax, az: f.az, bx: f.bx, bz: f.bz
      };
    });
  }

  function moveAll() {
    var i, rec, t, p0, p1, sh;
    for (i = 0; i < carriers.length; i++) {
      rec = book[carriers[i].id];
      t = rec.phase + sim / rec.period;
      p0 = loopPoint(t);
      p1 = loopPoint(t + 0.005);
      rec.x = p0.x;
      rec.z = p0.z;
      rec.heading = Math.atan2(p1.x - p0.x, p1.z - p0.z);
    }
    rec = book["HB-19"];
    sh = shuttle(sim + rec.phase * rec.period, rec.period);
    rec.z = 44 + (22 - 44) * sh.s;
    rec.x = 0;
    rec.heading = sh.u < 0.62 ? Math.PI : 0;
    for (i = 0; i < forks.length; i++) {
      rec = book[forks[i].id];
      sh = shuttle(sim + rec.phase * rec.period, rec.period);
      rec.x = rec.ax + (rec.bx - rec.ax) * sh.s;
      rec.z = rec.az + (rec.bz - rec.az) * sh.s;
      var dx = rec.bx - rec.ax;
      var dz = rec.bz - rec.az;
      rec.heading = sh.u < 0.62 ? Math.atan2(dx, dz) : Math.atan2(-dx, -dz);
      rec.loaded = sh.u > 0.08 && sh.u < 0.62;
    }
  }

  function followWant() {
    if (!sel || !book[sel.id]) {
      want.x = HOME.x;
      want.y = HOME.y;
      want.z = HOME.z;
      wantMul = 1;
      return;
    }
    var rec = book[sel.id];
    want.x = rec.x;
    want.y = (rec.y || 1.6) + 0.4;
    want.z = rec.z;
    wantMul = rec.kind === "hall" || rec.kind === "tower" ? 1.28 : 1.5;
  }

  function computeFit() {
    var saved = zoom;
    var lx = look.x, ly = look.y, lz = look.z;
    zoom = 1;
    look.x = HOME.x;
    look.y = HOME.y;
    look.z = HOME.z;
    prepCam();
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    var i, p;
    for (i = 0; i < FRAME.length; i++) {
      p = project(FRAME[i][0], FRAME[i][1], FRAME[i][2]);
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    }
    look.x = lx;
    look.y = ly;
    look.z = lz;
    zoom = saved;
    var pw = Math.max(1, maxX - minX);
    var ph = Math.max(1, maxY - minY);
    return Math.min((canvas.width * 0.92) / pw, (canvas.height * 0.92) / ph);
  }

  function drawSlab(s) {
    var x0 = s.x - s.w * 0.5, x1 = s.x + s.w * 0.5;
    var z0 = s.z - s.d * 0.5, z1 = s.z + s.d * 0.5;
    var a = project(x0, s.y, z0);
    var b = project(x1, s.y, z0);
    var c = project(x1, s.y, z1);
    var d = project(x0, s.y, z1);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.lineTo(d[0], d[1]);
    ctx.closePath();
    ctx.fillStyle = "rgb(" + s.rgb[0] + "," + s.rgb[1] + "," + s.rgb[2] + ")";
    ctx.fill();
  }

  function blob(x, z, rx, rz, alpha) {
    var p = project(x, 0.09, z);
    var qx = project(x + rx, 0.09, z);
    var qz = project(x, 0.09, z + rz);
    ctx.fillStyle = "rgba(32,26,20," + alpha + ")";
    ctx.beginPath();
    ctx.ellipse(
      p[0], p[1],
      Math.max(1.5, Math.hypot(qx[0] - p[0], qx[1] - p[1])),
      Math.max(1.5, Math.hypot(qz[0] - p[0], qz[1] - p[1])),
      0, 0, 6.2832
    );
    ctx.fill();
  }

  function mark(pick, x, y, z) {
    if (!pick) return;
    var p = project(x, y, z);
    picks.push({ kind: pick.kind, id: pick.id, sx: p[0], sy: p[1], r: Math.max(30, zoom * 1.15) });
  }

  function drawWorld() {
    var w = canvas.width, h = canvas.height;
    if (!sky) {
      sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#1b3046");
      sky.addColorStop(0.38, "#7c96a6");
      sky.addColorStop(1, "#d2bea0");
    }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    var i;
    for (i = 0; i < slabs.length; i++) drawSlab(slabs[i]);

    for (i = 0; i < halls.length; i++) blob(halls[i].x - LX * 1.4, halls[i].z - LZ * 1.4, halls[i].w * 0.46, halls[i].d * 0.46, 0.14);
    blob(book["PW-03"].x, book["PW-03"].z, 2.2, 3.4, 0.18);
    blob(book["NV-21"].x, book["NV-21"].z, 2.2, 3.4, 0.18);

    faceN = 0;
    picks.length = 0;
    for (i = 0; i < staticBoxes.length; i++) {
      var b = staticBoxes[i];
      var hot = sel && b.pick && sel.id === b.pick.id;
      emitBox(b.x, b.y, b.z, b.yaw, b.w, b.h, b.d, b.rgb, b.em, hot);
      if (b.pick) mark(b.pick, b.x, b.pick.y || b.y, b.z);
    }

    var ids = ["NV-14", "HB-07", "KL-22", "MS-11", "HB-19", "PW-03", "NV-21"];
    for (i = 0; i < ids.length; i++) {
      var rec = book[ids[i]];
      var thot = sel && sel.id === rec.id;
      emitTruck(rec.x, rec.z, rec.heading, rec.body, thot);
      blob(rec.x, rec.z, 1.8, 2.8, 0.16);
      mark({ kind: "truck", id: rec.id }, rec.x, 1.6, rec.z);
    }
    for (i = 0; i < stillTrucks.length; i++) {
      emitTruck(stillTrucks[i].x, stillTrucks[i].z, stillTrucks[i].heading, stillTrucks[i].body, 0);
      blob(stillTrucks[i].x, stillTrucks[i].z, 1.8, 2.8, 0.14);
    }
    for (i = 0; i < forks.length; i++) {
      rec = book[forks[i].id];
      emitFork(rec.x, rec.z, rec.heading, sel && sel.id === rec.id, rec.loaded);
      blob(rec.x, rec.z, 1.1, 1.3, 0.16);
      mark({ kind: "fork", id: rec.id }, rec.x, 1.1, rec.z);
    }

    var workers = [
      { x: -8.2, z: -1.5, axis: "x", span: 1.8, period: 6.5, phase: 0.2, rgb: [224, 110, 48] },
      { x: -3.2, z: 5.5, axis: "z", span: 1.5, period: 5.4, phase: 1.2, rgb: [236, 196, 64] },
      { x: 1.5, z: -1.2, axis: "x", span: 1.6, period: 7.2, phase: 0.6, rgb: [72, 156, 112] }
    ];
    for (i = 0; i < workers.length; i++) {
      var wk = workers[i];
      var u = Math.sin((sim + wk.phase) / wk.period * 6.2832);
      var wx = wk.x + (wk.axis === "x" ? u * wk.span : 0);
      var wz = wk.z + (wk.axis === "z" ? u * wk.span : 0);
      emitBox(wx, 0.52, wz, 0, 0.34, 1.02, 0.28, wk.rgb, 0, 0);
      emitBox(wx, 1.12, wz, 0, 0.22, 0.22, 0.22, [236, 206, 176], 0, 0);
    }

    var spin = sim * 1.7;
    emitBox(-36, 13.15, -32, spin, 1.7, 0.12, 0.16, [255, 176, 46], 2, 0);

    orderIdx.length = faceN;
    for (i = 0; i < faceN; i++) orderIdx[i] = i;
    orderIdx.sort(function (a, b) { return facePool[a].depth - facePool[b].depth; });
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(28,22,16,0.2)";
    ctx.lineWidth = 1;
    for (i = 0; i < faceN; i++) {
      var f = facePool[orderIdx[i]];
      ctx.beginPath();
      ctx.moveTo(f.p[0], f.p[1]);
      ctx.lineTo(f.p[3], f.p[4]);
      ctx.lineTo(f.p[6], f.p[7]);
      ctx.lineTo(f.p[9], f.p[10]);
      ctx.closePath();
      ctx.fillStyle = "rgb(" + (f.r | 0) + "," + (f.g | 0) + "," + (f.b | 0) + ")";
      ctx.fill();
      ctx.stroke();
      if (f.hot) {
        ctx.strokeStyle = "rgba(255,190,72,0.95)";
        ctx.lineWidth = Math.max(1.6, zoom * 0.035);
        ctx.stroke();
        ctx.strokeStyle = "rgba(28,22,16,0.2)";
        ctx.lineWidth = 1;
      }
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (i = 0; i < halls.length; i++) {
      var hall = halls[i];
      var lp = project(hall.x, hall.h + 0.7, hall.z);
      var size = Math.max(10, Math.min(16, zoom * 0.22));
      ctx.font = "700 " + size.toFixed(0) + "px system-ui,sans-serif";
      ctx.fillStyle = hall.ink === "light" ? "rgba(255,248,236,0.92)" : "rgba(32,28,22,0.78)";
      ctx.fillText(hall.id, lp[0], lp[1]);
    }

    if (sel && book[sel.id]) {
      var srec = book[sel.id];
      var gp = project(srec.x, 0.12, srec.z);
      var gx = project(srec.x + 1.8, 0.12, srec.z);
      var gz = project(srec.x, 0.12, srec.z + 1.8);
      ctx.beginPath();
      ctx.ellipse(gp[0], gp[1], Math.max(4, Math.hypot(gx[0] - gp[0], gx[1] - gp[1])), Math.max(3, Math.hypot(gz[0] - gp[0], gz[1] - gp[1])), 0, 0, 6.2832);
      ctx.strokeStyle = "rgba(255,198,84,0.95)";
      ctx.lineWidth = 2;
      ctx.stroke();
      var title = srec.id + (srec.name ? " · " + srec.name : srec.hall ? " · " + srec.hall : "");
      var tp = project(srec.x, (srec.y || 1.2) + 2.4, srec.z);
      ctx.font = "600 12px system-ui,sans-serif";
      var tw = ctx.measureText(title).width + 14;
      ctx.fillStyle = "rgba(18,16,14,0.78)";
      ctx.fillRect(tp[0] - tw * 0.5, tp[1] - 18, tw, 18);
      ctx.fillStyle = "#fff8ee";
      ctx.fillText(title, tp[0], tp[1] - 9);
    }

    var vg = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.3, w * 0.5, h * 0.5, h * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(18,14,10,0.28)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var W = Math.max(2, Math.round((r.width || 390) * dpr));
    var H = Math.max(2, Math.round((r.height || 468) * dpr));
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      sky = null;
    }
    cx = W * 0.5;
    cy = H * 0.5;
  }

  function drawFrame(now) {
    if (!last) last = now;
    var dt = (now - last) / 1000;
    if (dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;
    last = now;
    sim += dt;
    moveAll();
    followWant();
    var k = Math.min(1, dt * 4.4);
    look.x += (want.x - look.x) * k;
    look.y += (want.y - look.y) * k;
    look.z += (want.z - look.z) * k;
    frameMul += (wantMul - frameMul) * k;
    resize();
    zoom = computeFit() * userZoom * frameMul;
    prepCam();
    drawWorld();
    uiAcc += dt;
    if (uiAcc > 0.3) {
      uiAcc = 0;
      refreshUi();
    }
  }

  var clockEl = document.getElementById("clock");
  var kOut = document.getElementById("kOut");
  var kDock = document.getElementById("kDock");
  var kFleet = document.getElementById("kFleet");
  var kTime = document.getElementById("kTime");
  var cardTitle = document.getElementById("cardTitle");
  var cardBody = document.getElementById("cardBody");
  var siteHost = document.getElementById("sites");
  var orderHost = document.getElementById("orders");
  var corner = document.getElementById("corner");
  var panel = document.getElementById("panel");

  function refreshUi() {
    var mins = Math.floor(6 * 60 + 40 + sim * 7);
    var hh = Math.floor(mins / 60) % 24;
    var mm = mins % 60;
    clockEl.textContent = (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm;
    kOut.textContent = String(128 + Math.floor(sim * 0.7));
    var busy = 2;
    var fi;
    for (fi = 0; fi < forks.length; fi++) if (book[forks[fi].id].loaded) busy++;
    kDock.textContent = busy + "/18";
    kFleet.textContent = "11";
    kTime.textContent = String(Math.round(96 + Math.sin(sim * 0.17) * 1.4)) + "%";
    var rec = sel && book[sel.id];
    if (!rec) {
      cardTitle.textContent = "Yard overview";
      cardBody.textContent = "Tap a truck, forklift or hall.";
    } else if (rec.kind === "hall") {
      cardTitle.textContent = rec.id + " · " + rec.name;
      cardBody.textContent = rec.role + " · " + rec.doors + " dock doors";
    } else if (rec.kind === "truck") {
      cardTitle.textContent = rec.id + " · " + rec.name;
      cardBody.textContent = (rec.parked ? "At dock" : rec.gate ? "On the gate lane" : "On the ring") + " · " + rec.sku + " · " + rec.order;
    } else if (rec.kind === "fork") {
      cardTitle.textContent = rec.id + " · " + rec.hall;
      cardBody.textContent = rec.loaded ? "Carrying a pallet to the dock" : "Heading back empty";
    } else if (rec.kind === "charger") {
      cardTitle.textContent = rec.id + " · Charger";
      cardBody.textContent = "Pad open · 48V bay";
    } else {
      cardTitle.textContent = "CT-1 · Yard tower";
      cardBody.textContent = "Floor staffed · beacon live";
    }
    for (fi = 0; fi < orders.length; fi++) {
      var p = (orders[fi].p + sim * 0.012) % 1;
      orders[fi].bar.style.width = Math.round(18 + p * 78) + "%";
    }
  }

  function paintSites() {
    var buttons = siteHost.querySelectorAll("button");
    var i;
    for (i = 0; i < buttons.length; i++) {
      var id = buttons[i].getAttribute("data-site");
      var on = (!sel && id === "all") || (sel && sel.kind === "hall" && sel.id === id);
      buttons[i].className = on ? "on" : "";
    }
  }

  function select(next) {
    sel = next;
    paintSites();
    uiAcc = 1;
  }

  function bindUi() {
    var all = document.createElement("button");
    all.type = "button";
    all.textContent = "All";
    all.setAttribute("data-site", "all");
    all.className = "on";
    siteHost.appendChild(all);
    var i;
    for (i = 0; i < halls.length; i++) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = halls[i].id;
      b.setAttribute("data-site", halls[i].id);
      siteHost.appendChild(b);
    }
    for (i = 0; i < orders.length; i++) {
      var li = document.createElement("li");
      var row = document.createElement("div");
      row.className = "id";
      var strong = document.createElement("b");
      strong.textContent = orders[i].id + " " + orders[i].sku;
      var span = document.createElement("span");
      span.textContent = orders[i].truck;
      row.appendChild(strong);
      row.appendChild(span);
      var bar = document.createElement("div");
      bar.className = "bar";
      var fill = document.createElement("i");
      bar.appendChild(fill);
      li.appendChild(row);
      li.appendChild(bar);
      orderHost.appendChild(li);
      orders[i].bar = fill;
    }
    siteHost.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest("button") : null;
      if (!btn) return;
      e.stopPropagation();
      var id = btn.getAttribute("data-site");
      if (id === "all") select(null);
      else select({ kind: "hall", id: id });
    });
    function stop(e) { e.stopPropagation(); }
    var evs = ["pointerdown", "pointerup", "pointermove", "touchstart", "touchend", "touchmove", "mousedown", "mouseup", "wheel", "click"];
    for (i = 0; i < evs.length; i++) {
      corner.addEventListener(evs[i], stop);
      panel.addEventListener(evs[i], stop);
    }
    corner.addEventListener("click", function (e) {
      e.stopPropagation();
      var on = document.documentElement.classList.toggle("ui-open");
      corner.setAttribute("aria-expanded", on ? "true" : "false");
    });
  }

  function cssPoint(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    var sx = r.width ? (clientX - r.left) * (canvas.width / r.width) : clientX;
    var sy = r.height ? (clientY - r.top) * (canvas.height / r.height) : clientY;
    return [sx, sy];
  }

  function bindInput() {
    var ptr = new Map();
    var pinch = 0;
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("pointerdown", function (e) {
      armAudio();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      ptr.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (ptr.size === 2) {
        var both = Array.from(ptr.values());
        pinch = Math.hypot(both[0].x - both[1].x, both[0].y - both[1].y) || 1;
      }
    });
    canvas.addEventListener("pointermove", function (e) {
      var p = ptr.get(e.pointerId);
      if (!p) return;
      e.preventDefault();
      var dx = e.clientX - p.x;
      var dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (ptr.size >= 2 && pinch > 0) {
        var both = Array.from(ptr.values());
        var dist = Math.hypot(both[0].x - both[1].x, both[0].y - both[1].y) || pinch;
        userZoom = clamp(userZoom * (dist / pinch), 0.72, 2.6);
        pinch = dist;
        return;
      }
      yaw += dx * 0.0075;
      pitch = clamp(pitch + dy * 0.0045, 0.46, 1.12);
    }, { passive: false });
    function endPtr(e) {
      var p = ptr.get(e.pointerId);
      ptr.delete(e.pointerId);
      if (!p || ptr.size > 0) return;
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 12) return;
      var pt = cssPoint(e.clientX, e.clientY);
      var hit = null;
      var best = 1e9;
      var i;
      for (i = 0; i < picks.length; i++) {
        var d = Math.hypot(picks[i].sx - pt[0], picks[i].sy - pt[1]);
        if (d < picks[i].r && d < best) {
          best = d;
          hit = picks[i];
        }
      }
      if (hit) select({ kind: hit.kind, id: hit.id });
      else select(null);
    }
    canvas.addEventListener("pointerup", endPtr);
    canvas.addEventListener("pointercancel", function (e) { ptr.delete(e.pointerId); });
    canvas.addEventListener("wheel", function (e) {
      if (ptr.size >= 2) return;
      e.preventDefault();
      userZoom = clamp(userZoom * (e.deltaY > 0 ? 0.92 : 1.08), 0.72, 2.6);
    }, { passive: false });
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function armAudio() {
    if (audioOn) return;
    audioOn = true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ac = new AC();
      window.__gbAudioContexts = window.__gbAudioContexts || [];
      window.__gbAudioContexts.push(ac);
      var master = ac.createGain();
      master.gain.value = 0.028;
      master.connect(ac.destination);
      var a = ac.createOscillator();
      a.type = "sine";
      a.frequency.value = 78;
      var b = ac.createOscillator();
      b.type = "triangle";
      b.frequency.value = 156;
      var bg = ac.createGain();
      bg.gain.value = 0.22;
      a.connect(master);
      b.connect(bg);
      bg.connect(master);
      a.start();
      b.start();
      if (ac.state === "suspended") ac.resume();
    } catch (err) {}
  }

  function signalReady() {
    var gb = window.__gbSandbox;
    if (gb && typeof gb.ready === "function") {
      gb.ready();
      return true;
    }
    return false;
  }

  buildWorld();
  bindUi();
  bindInput();

  function kick() {
    resize();
    if (canvas.width < 2 || canvas.height < 2) {
      requestAnimationFrame(kick);
      return;
    }
    drawFrame(performance.now());
    requestAnimationFrame(function () {
      drawFrame(performance.now());
      if (!signalReady()) {
        var retry = function () {
          if (!signalReady()) requestAnimationFrame(retry);
        };
        requestAnimationFrame(retry);
      }
      requestAnimationFrame(loop);
    });
  }

  function loop(now) {
    drawFrame(now);
    requestAnimationFrame(loop);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", kick);
  else kick();
})();
