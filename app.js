(function () {
  'use strict';

  var NA = '浏览器未提供';
  var report = [];

  function $(sel) { return document.querySelector(sel); }
  function txt(v) { return (v === undefined || v === null || v === '') ? NA : String(v); }
  function fmtBytes(n) {
    if (n === null || n === undefined || isNaN(n)) return NA;
    var u = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0, v = Number(n);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i === 0 ? v : v.toFixed(2)) + ' ' + u[i];
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function addSection(title, rows, open, atTop) {
    var details = el('details', 'section');
    details.open = !!open;
    var summary = el('summary');
    summary.appendChild(el('span', 'ttl', title));
    summary.appendChild(el('span', 'chev'));
    details.appendChild(summary);
    var box = el('div', 'rows');
    rows.forEach(function (r) {
      var row = el('div', 'row');
      row.appendChild(el('div', 'label', r[0]));
      row.appendChild(el('div', 'value', txt(r[1])));
      box.appendChild(row);
    });
    details.appendChild(box);
    var host = $('#sections');
    if (atTop && host.firstChild) host.insertBefore(details, host.firstChild);
    else host.appendChild(details);
    report.push({ title: title, rows: rows });
  }

  function addSummaryGrid(items, append) {
    var grid = $('#summary-grid');
    if (!append) grid.innerHTML = '';
    items.forEach(function (it) {
      var kv = el('div', 'kv');
      kv.appendChild(el('div', 'k', it[0]));
      kv.appendChild(el('div', 'v', txt(it[1])));
      grid.appendChild(kv);
    });
  }

  function loadNative() {
    fetch('api/native').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d) return;
      if (d.name) $('#device-name').textContent = d.name;
      if (d.sub) $('#device-sub').textContent = d.sub;
      if (d.summary) addSummaryGrid(d.summary, false);
      if (d.sections) {
        d.sections.forEach(function (s, i) { addSection(s.title, s.rows, i === 0, true); });
      }
    }).catch(function () { });
  }

  // ---------------- browser / OS ----------------
  function parseBrowser(ua) {
    var tests = [
      [/Edg\/([\d.]+)/, 'Edge'], [/OPR\/([\d.]+)/, 'Opera'], [/Chrome\/([\d.]+)/, 'Chrome'],
      [/Firefox\/([\d.]+)/, 'Firefox'], [/Version\/([\d.]+).*Safari/, 'Safari']
    ];
    for (var i = 0; i < tests.length; i++) {
      var m = ua.match(tests[i][0]);
      if (m) return tests[i][1] + ' ' + m[1];
    }
    return '未知浏览器';
  }
  function parseOS(ua) {
    if (/Windows NT 10/.test(ua)) return 'Windows 10/11';
    if (/Windows NT/.test(ua)) return 'Windows';
    if (/Mac OS X/.test(ua)) return 'macOS';
    if (/Android/.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
    if (/Linux/.test(ua)) return 'Linux';
    return navigator.platform || '未知系统';
  }

  function collectSystem() {
    var ua = navigator.userAgent;
    var browser = parseBrowser(ua);
    var os = parseOS(ua);
    addSummaryGrid([
      ['浏览器', browser],
      ['操作系统', os],
      ['逻辑核心', navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' 线程' : NA],
      ['设备内存', navigator.deviceMemory ? navigator.deviceMemory + ' GB (约)' : NA],
      ['屏幕', screen.width + ' x ' + screen.height],
      ['像素比', window.devicePixelRatio]
    ]);
    $('#device-name').textContent = os + ' · ' + browser;
    $('#device-sub').textContent = '以下为浏览器可读取的真实信息';

    addSection('系统与浏览器', [
      ['操作系统', os],
      ['浏览器', browser],
      ['User Agent', ua],
      ['平台', navigator.platform],
      ['语言', (navigator.languages || [navigator.language]).join(', ')],
      ['时区', tryTz()],
      ['在线状态', navigator.onLine ? '在线' : '离线'],
      ['Cookie 可用', navigator.cookieEnabled ? '是' : '否'],
      ['Do Not Track', navigator.doNotTrack || NA],
      ['PDF 查看器', navigator.pdfViewerEnabled === undefined ? NA : (navigator.pdfViewerEnabled ? '支持' : '不支持')],
      ['安全上下文', window.isSecureContext ? '是 (HTTPS)' : '否'],
      ['屏幕方向', (screen.orientation && screen.orientation.type) || NA]
    ], true);

    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      navigator.userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'model', 'uaFullVersion'])
        .then(function (d) {
          addSection('设备架构', [
            ['CPU 架构', d.architecture],
            ['系统位数', d.bitness ? d.bitness + ' 位' : NA],
            ['平台版本', d.platformVersion],
            ['设备型号', d.model],
            ['浏览器完整版本', d.uaFullVersion]
          ]);
        }).catch(function () { });
    }
  }

  function tryTz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return NA; }
  }

  // ---------------- CPU ----------------
  function collectCpu() {
    var rows = [
      ['逻辑处理器数', navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' 个' : NA],
      ['设备内存 (约)', navigator.deviceMemory ? navigator.deviceMemory + ' GB' : NA],
      ['CPU 型号', '受浏览器安全限制无法读取']
    ];
    if (performance && performance.memory) {
      rows.push(['JS 堆上限', fmtBytes(performance.memory.jsHeapSizeLimit)]);
      rows.push(['已用 JS 堆', fmtBytes(performance.memory.usedJSHeapSize)]);
    }
    addSection('CPU 与内存', rows);
  }

  // ---------------- GPU ----------------
  function collectGpu() {
    var rows = [];
    try {
      var canvas = document.createElement('canvas');
      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        rows.push(['WebGL', '不支持']);
      } else {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        rows.push(['显卡厂商', dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)]);
        rows.push(['显卡型号', dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)]);
        rows.push(['WebGL 版本', gl.getParameter(gl.VERSION)]);
        rows.push(['GLSL 版本', gl.getParameter(gl.SHADING_LANGUAGE_VERSION)]);
        rows.push(['最大纹理尺寸', gl.getParameter(gl.MAX_TEXTURE_SIZE) + ' px']);
        rows.push(['最大视口', (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || []).join(' x ')]);
        rows.push(['扩展数量', (gl.getSupportedExtensions() || []).length]);
      }
    } catch (e) {
      rows.push(['WebGL', '读取失败']);
    }
    rows.push(['WebGL 2', (function () { try { return document.createElement('canvas').getContext('webgl2') ? '支持' : '不支持'; } catch (e) { return NA; } })()]);
    addSection('GPU 图形', rows);

    if (navigator.gpu && navigator.gpu.requestAdapter) {
      navigator.gpu.requestAdapter().then(function (adapter) {
        if (!adapter) { addSection('WebGPU', [['适配器', '未获取到']]); return; }
        var info = adapter.info || {};
        var rows2 = [
          ['WebGPU', '支持'],
          ['厂商', info.vendor || NA],
          ['架构', info.architecture || NA],
          ['设备', info.device || NA],
          ['描述', info.description || NA]
        ];
        if (adapter.limits) rows2.push(['最大缓冲区', fmtBytes(adapter.limits.maxBufferSize)]);
        addSection('WebGPU', rows2);
      }).catch(function () { });
    } else {
      addSection('WebGPU', [['WebGPU', '不支持']]);
    }
  }

  // ---------------- display ----------------
  function collectDisplay() {
    var dpr = window.devicePixelRatio || 1;
    var gamut = media('(color-gamut: rec2020)') ? 'Rec.2020'
      : media('(color-gamut: p3)') ? 'Display P3'
      : media('(color-gamut: srgb)') ? 'sRGB' : NA;
    var rows = [
      ['屏幕分辨率', screen.width + ' x ' + screen.height + ' (CSS 像素)'],
      ['物理像素', Math.round(screen.width * dpr) + ' x ' + Math.round(screen.height * dpr)],
      ['可用区域', screen.availWidth + ' x ' + screen.availHeight],
      ['像素比', dpr],
      ['色深', screen.colorDepth + ' 位'],
      ['窗口内尺寸', window.innerWidth + ' x ' + window.innerHeight],
      ['色域', gamut],
      ['HDR', media('(dynamic-range: high)') ? '支持' : '不支持'],
      ['触摸点数', navigator.maxTouchPoints || 0]
    ];
    addSection('屏幕与显示', rows);
    measureRefreshRate().then(function (hz) {
      if (hz) addSection('刷新率', [['屏幕刷新率', hz + ' Hz (实测)']]);
    });
  }
  function media(q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } }

  function measureRefreshRate() {
    return new Promise(function (resolve) {
      var count = 0, start = 0, last = 0, deltas = [];
      function step(ts) {
        if (!start) { start = ts; last = ts; }
        else { deltas.push(ts - last); last = ts; }
        count++;
        if (count < 45) { requestAnimationFrame(step); }
        else {
          deltas.sort(function (a, b) { return a - b; });
          var mid = deltas[Math.floor(deltas.length / 2)] || 0;
          resolve(mid > 0 ? Math.round(1000 / mid) : null);
        }
      }
      requestAnimationFrame(step);
    });
  }

  // ---------------- storage ----------------
  function collectStorage() {
    var rows = [
      ['IndexedDB', ('indexedDB' in window) ? '支持' : '不支持'],
      ['Cache API', ('caches' in window) ? '支持' : '不支持'],
      ['本地存储 (localStorage)', (function () { try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return '可用'; } catch (e) { return '不可用'; } })()],
      ['磁盘型号', '受浏览器安全限制无法读取']
    ];
    addSection('存储', rows);

    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(function (est) {
        var rows2 = [
          ['存储配额上限', fmtBytes(est.quota)],
          ['本站已用', fmtBytes(est.usage)],
          ['使用比例', est.quota ? (est.usage / est.quota * 100).toFixed(2) + '%' : NA]
        ];
        addSection('存储配额', rows2);
      }).catch(function () { });
    }
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        addSection('存储持久化', [['持久化状态', p ? '已授予' : '未授予']]);
      }).catch(function () { });
    }
  }

  // ---------------- network ----------------
  function collectNetwork() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    var rows = [];
    if (c) {
      rows.push(['连接类型', c.effectiveType]);
      rows.push(['估算下行', c.downlink !== undefined ? c.downlink + ' Mbps' : NA]);
      rows.push(['往返延迟 RTT', c.rtt !== undefined ? c.rtt + ' ms' : NA]);
      rows.push(['省流量模式', c.saveData ? '开启' : '关闭']);
    } else {
      rows.push(['网络信息 API', NA]);
    }
    rows.push(['在线状态', navigator.onLine ? '在线' : '离线']);
    addSection('网络', rows);

    getLocalIPs().then(function (ips) {
      addSection('本地网络地址', [
        ['局域网 IP', ips.length ? ips.join(', ') : '未获取到 (浏览器可能已隐藏)']
      ]);
    });
  }

  function getLocalIPs() {
    return new Promise(function (resolve) {
      var ips = {}, done = false, pc;
      function finish() {
        if (done) return;
        done = true;
        try { if (pc) pc.close(); } catch (e) { }
        resolve(Object.keys(ips));
      }
      try {
        pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('x');
        pc.onicecandidate = function (e) {
          if (!e.candidate) { finish(); return; }
          var m = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate);
          if (m) ips[m[1]] = true;
        };
        pc.createOffer().then(function (o) { return pc.setLocalDescription(o); }).catch(finish);
        setTimeout(finish, 1500);
      } catch (e) { finish(); }
    });
  }

  // ---------------- battery ----------------
  function collectBattery() {
    if (!navigator.getBattery) {
      addSection('电池', [['电池状态', NA + ' (需 Chrome 或 Edge)']]);
      return;
    }
    navigator.getBattery().then(function (b) {
      function mins(v) { return isFinite(v) ? Math.round(v) + ' 分钟' : NA; }
      addSection('电池', [
        ['电量', Math.round(b.level * 100) + '%'],
        ['充电中', b.charging ? '是' : '否'],
        ['预计充满', b.charging ? mins(b.chargingTime / 60) : '—'],
        ['预计可用', !b.charging && isFinite(b.dischargingTime) ? mins(b.dischargingTime / 60) : '—']
      ]);
    }).catch(function () { });
  }

  // ---------------- media ----------------
  function collectMedia() {
    function can(mime) { try { return (window.MediaSource && MediaSource.isTypeSupported(mime)) ? '支持' : '不支持'; } catch (e) { return NA; } }
    var rows = [
      ['H.264 / AVC', can('video/mp4; codecs="avc1.42E01E"')],
      ['H.265 / HEVC', can('video/mp4; codecs="hev1.1.6.L93.B0"')],
      ['VP9', can('video/webm; codecs="vp9"')],
      ['AV1', can('video/mp4; codecs="av01.0.05M.08"')],
      ['Opus 音频', can('audio/webm; codecs="opus"')],
      ['AAC 音频', can('audio/mp4; codecs="mp4a.40.2"')]
    ];
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        var ac = new AC();
        rows.push(['音频采样率', ac.sampleRate + ' Hz']);
        rows.push(['音频通道', ac.destination.maxChannelCount ? ac.destination.maxChannelCount + ' 声道' : NA]);
        if (ac.close) ac.close();
      }
    } catch (e) { }
    addSection('媒体与编解码', rows);
  }

  // ---------------- features ----------------
  function collectFeatures() {
    function ok(v) { return v ? '支持' : '不支持'; }
    addSection('能力与特性', [
      ['WebAssembly', ok(typeof WebAssembly !== 'undefined')],
      ['SharedArrayBuffer', ok(typeof SharedArrayBuffer !== 'undefined')],
      ['Web Worker', ok(typeof Worker !== 'undefined')],
      ['OffscreenCanvas', ok(typeof OffscreenCanvas !== 'undefined')],
      ['WebRTC', ok(typeof RTCPeerConnection !== 'undefined')],
      ['WebUSB', ok(!!navigator.usb)],
      ['Web 蓝牙', ok(!!navigator.bluetooth)],
      ['Web Serial', ok(!!navigator.serial)],
      ['WebGPU', ok(!!navigator.gpu)],
      ['游戏手柄', ok(typeof navigator.getGamepads === 'function')],
      ['WebXR', ok(!!navigator.xr)],
      ['通知', ok(typeof Notification !== 'undefined')],
      ['地理位置', ok(!!navigator.geolocation)],
      ['剪贴板 API', ok(!!navigator.clipboard)],
      ['Web 分享', ok(!!navigator.share)],
      ['全屏 API', ok(!!document.fullscreenEnabled)],
      ['Wake Lock', ok(!!navigator.wakeLock)],
      ['Service Worker', ok('serviceWorker' in navigator)],
      ['文件系统访问', ok(!!window.showOpenFilePicker)],
      ['语音合成', ok('speechSynthesis' in window)],
      ['深色模式偏好', media('(prefers-color-scheme: dark)') ? '深色' : '浅色'],
      ['减少动画偏好', media('(prefers-reduced-motion: reduce)') ? '开启' : '关闭']
    ]);
  }

  // =================== benchmark ===================
  var BENCH_TESTS = [
    { name: 'CPU 整数运算', run: benchInt },
    { name: 'CPU 浮点运算', run: benchFloat },
    { name: '数组排序', run: benchSort },
    { name: 'JSON 编解码', run: benchJson },
    { name: 'SHA-256 加密', run: benchSha },
    { name: '内存带宽', run: benchMem },
    { name: 'Canvas 2D 填充', run: benchCanvas },
    { name: 'WebGL 渲染', run: benchGl },
    { name: 'IndexedDB 存储', run: benchIdb }
  ];
  var benchRunning = false, benchResults = new Array(BENCH_TESTS.length);

  function benchInt() {
    var n = 30000000, x = 1, t = performance.now();
    for (var i = 0; i < n; i++) { x = (x + i) ^ (x << 3); x = x & 0x7fffffff; }
    var ms = performance.now() - t;
    var ops = n / (ms / 1000);
    return { detail: (ops / 1e6).toFixed(0) + ' Mops/s · ' + ms.toFixed(0) + ' ms', score: Math.round(ops / 1e5) };
  }
  function benchFloat() {
    var n = 4000000, d = 1.0, s = 0.0, i, t = performance.now();
    for (i = 0; i < n; i++) { s += Math.sin(d) + Math.sqrt(d); d += 0.0001; }
    var ms = performance.now() - t;
    var ops = n / (ms / 1000);
    return { detail: (ops / 1e6).toFixed(1) + ' Mops/s · ' + ms.toFixed(0) + ' ms', score: Math.round(ops / 2e4) };
  }
  function benchSort() {
    var n = 200000, arr = new Float64Array(n), i;
    for (i = 0; i < n; i++) arr[i] = Math.random() * 1e6;
    var t = performance.now(), passes = 0, a;
    do {
      a = Array.prototype.slice.call(arr);
      a.sort(function (p, q) { return p - q; });
      passes++;
    } while (performance.now() - t < 150 && passes < 20);
    var ms = performance.now() - t;
    var eps = (n * passes) / (ms / 1000);
    return { detail: (eps / 1e6).toFixed(1) + ' M元素/s · ' + passes + ' 轮', score: Math.round(eps / 1e4) };
  }
  function benchJson() {
    var obj = { items: [] }, i;
    for (i = 0; i < 20000; i++) obj.items.push({ id: i, name: 'item-' + i, value: Math.random() });
    var t = performance.now(), s = '', passes = 0, round;
    do {
      s = JSON.stringify(obj);
      round = JSON.parse(s);
      passes++;
    } while (performance.now() - t < 150 && passes < 40);
    var ms = performance.now() - t;
    var mbps = (s.length * passes * 2) / 1e6 / (ms / 1000);
    return { detail: mbps.toFixed(0) + ' MB/s · ' + passes + ' 轮', score: Math.round(mbps * 8) };
  }
  function benchSha() {
    if (!(window.crypto && crypto.subtle)) {
      return Promise.resolve({ detail: '不支持 SubtleCrypto', score: 0 });
    }
    var size = 8 * 1024 * 1024, buf = new Uint8Array(size), i;
    for (i = 0; i < size; i += 4096) buf[i] = i & 255;
    var t0 = performance.now(), rounds = 0;
    function loop() {
      return crypto.subtle.digest('SHA-256', buf).then(function () {
        rounds++;
        if (performance.now() - t0 < 250 && rounds < 40) return loop();
        var ms = performance.now() - t0;
        var mbps = (size * rounds) / 1e6 / (ms / 1000);
        return { detail: mbps.toFixed(0) + ' MB/s · ' + rounds + ' 轮', score: Math.round(mbps * 6) };
      });
    }
    return loop();
  }
  function benchMem() {
    var n = 4 * 1024 * 1024, src = new Float64Array(n), dst = new Float64Array(n), i;
    for (i = 0; i < n; i++) src[i] = i;
    var t = performance.now(), reps = 0;
    do {
      for (var r = 0; r < 3; r++) dst.set(src);
      reps++;
    } while (performance.now() - t < 200 && reps < 60);
    var ms = performance.now() - t;
    var mbps = (n * 8 * reps * 2) / 1e6 / (ms / 1000);
    return { detail: mbps.toFixed(0) + ' MB/s · ' + reps + ' 轮', score: Math.round(mbps / 2) };
  }
  function benchCanvas() {
    try {
      var cv = document.createElement('canvas');
      cv.width = 512; cv.height = 512;
      var ctx = cv.getContext('2d');
      if (!ctx) return { detail: '不支持', score: 0 };
      var t = performance.now(), ops = 0;
      do {
        for (var i = 0; i < 2000; i++) {
          ctx.fillStyle = 'rgb(' + (i & 255) + ',80,160)';
          ctx.fillRect((i * 7) % 500, (i * 13) % 500, 24, 24);
        }
        ops += 2000;
      } while (performance.now() - t < 200 && ops < 200000);
      var ms = performance.now() - t;
      var perSec = ops / (ms / 1000);
      return { detail: (perSec / 1e3).toFixed(0) + ' K矩形/s · ' + ops + ' 次', score: Math.round(perSec / 1e2) };
    } catch (e) { return { detail: '不支持', score: 0 }; }
  }
  function benchGl() {
    try {
      var cv = document.createElement('canvas');
      cv.width = 256; cv.height = 256;
      var gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      if (!gl) return { detail: '不支持', score: 0 };
      var vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.0,1.0); }');
      gl.compileShader(vs);
      var fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, 'precision mediump float; void main(){ gl_FragColor = vec4(0.3,0.7,0.9,1.0); }');
      gl.compileShader(fs);
      var prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog); gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      var verts = new Float32Array(3 * 3000);
      for (var i = 0; i < verts.length; i++) verts[i] = Math.random() * 2 - 1;
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      var t = performance.now(), frames = 0;
      do {
        for (var f = 0; f < 50; f++) gl.drawArrays(gl.TRIANGLES, 0, 3000);
        gl.finish();
        frames += 50;
      } while (performance.now() - t < 200 && frames < 5000);
      var ms = performance.now() - t;
      var tris = frames * 1000 / (ms / 1000);
      return { detail: (tris / 1e6).toFixed(1) + ' M三角形/s · ' + frames + ' 帧', score: Math.round(tris / 1e5) };
    } catch (e) { return { detail: '不支持', score: 0 }; }
  }
  function benchIdb() {
    return new Promise(function (resolve) {
      if (!('indexedDB' in window)) { resolve({ detail: '不支持', score: 0 }); return; }
      var records = 3000, payload = 'x'.repeat(1024);
      try {
        var req = indexedDB.open('__dl_bench', 1);
        req.onupgradeneeded = function (e) { e.target.result.createObjectStore('kv'); };
        req.onerror = function () { resolve({ detail: '打开失败', score: 0 }); };
        req.onsuccess = function () {
          var db = req.result;
          var tx = db.transaction('kv', 'readwrite').objectStore('kv');
          var t = performance.now();
          for (var i = 0; i < records; i++) tx.put(payload + i, i);
          tx.transaction.oncomplete = function () {
            var writeMs = performance.now() - t;
            var get = db.transaction('kv', 'readonly').objectStore('kv').get(0);
            get.onsuccess = function () {
              var totalMs = performance.now() - t;
              var bytes = records * payload.length;
              var mbps = bytes / 1e6 / (totalMs / 1000);
              db.close();
              try { indexedDB.deleteDatabase('__dl_bench'); } catch (e2) { }
              resolve({ detail: mbps.toFixed(0) + ' MB/s · 写 ' + writeMs.toFixed(0) + ' ms', score: Math.round(mbps * 5) });
            };
            get.onerror = function () { db.close(); resolve({ detail: '读取失败', score: 0 }); };
          };
          tx.transaction.onerror = function () { db.close(); resolve({ detail: '写入失败', score: 0 }); };
        };
      } catch (e) { resolve({ detail: '不支持', score: 0 }); }
    });
  }

  function setGauge(pct) {
    var ring = $('#gauge-ring');
    if (!ring) return;
    var c = 2 * Math.PI * 66;
    ring.style.strokeDasharray = c.toFixed(2);
    var p = Math.max(0, Math.min(100, pct || 0)) / 100;
    ring.style.strokeDashoffset = (c * (1 - p)).toFixed(2);
  }

  function renderBenchShell() {
    var box = $('#bench-rows');
    box.innerHTML = '';
    BENCH_TESTS.forEach(function (t, i) {
      var row = el('div', 'bench-row');
      row.id = 'bench-row-' + i;
      row.appendChild(el('div', 'n', t.name));
      row.appendChild(el('div', 'd', '等待测试'));
      row.appendChild(el('div', 's', ''));
      box.appendChild(row);
    });
  }
  function setBenchRow(i, detail, score, running) {
    var row = document.getElementById('bench-row-' + i);
    if (!row) return;
    row.classList.toggle('running', !!running);
    row.querySelector('.d').textContent = detail;
    row.querySelector('.s').textContent = score ? score : '';
  }

  function runBenchmark() {
    if (benchRunning) return;
    benchRunning = true;
    $('#btn-bench').disabled = true;
    $('#score').textContent = '—';
    $('#bench-status').textContent = '正在测试…';
    renderBenchShell();
    setGauge(0);
    var weights = [1.3, 1.0, 0.9, 1.0, 1.0, 1.0, 0.8, 1.1, 0.8];
    var done = 0;

    function next(i) {
      if (i >= BENCH_TESTS.length) {
        var total = 0;
        for (var k = 0; k < benchResults.length; k++) total += (benchResults[k].score || 0) * weights[k];
        $('#score').textContent = Math.round(total);
        $('#bench-status').textContent = '测试完成，分数用于同机横向对比';
        $('#bench-bar').style.width = '100%';
        setGauge(100);
        $('#btn-bench').disabled = false;
        benchRunning = false;
        return;
      }
      setBenchRow(i, '测试中…', 0, true);
      $('#bench-bar').style.width = Math.round(i / BENCH_TESTS.length * 100) + '%';
      setGauge(i / BENCH_TESTS.length * 100);
      setTimeout(function () {
        Promise.resolve().then(BENCH_TESTS[i].run).then(function (res) {
          benchResults[i] = res || { detail: '无结果', score: 0 };
          setBenchRow(i, benchResults[i].detail, benchResults[i].score, false);
          done = i + 1;
          $('#bench-bar').style.width = Math.round(done / BENCH_TESTS.length * 100) + '%';
          setGauge(done / BENCH_TESTS.length * 100);
          next(i + 1);
        }).catch(function () {
          benchResults[i] = { detail: '测试失败', score: 0 };
          setBenchRow(i, '测试失败', 0, false);
          next(i + 1);
        });
      }, 30);
    }
    next(0);
  }

  // ---------------- report ----------------
  function copyReport() {
    var lines = ['设备检测实验室 - 检测报告', '生成时间: ' + new Date().toLocaleString()];
    report.forEach(function (sec) {
      lines.push('');
      lines.push('[' + sec.title + ']');
      sec.rows.forEach(function (r) { lines.push('  ' + r[0] + ': ' + txt(r[1])); });
    });
    var text = lines.join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        $('#btn-copy').textContent = '已复制';
        setTimeout(function () { $('#btn-copy').textContent = '复制报告'; }, 1500);
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); $('#btn-copy').textContent = '已复制'; } catch (e) { }
    document.body.removeChild(ta);
    setTimeout(function () { $('#btn-copy').textContent = '复制报告'; }, 1500);
  }

  // ---------------- download meta ----------------
  function headSize(url) {
    return fetch(url, { method: 'HEAD' }).then(function (r) {
      if (!r.ok) return null;
      var len = r.headers.get('content-length');
      return len ? parseInt(len, 10) : null;
    }).catch(function () { return null; });
  }

  function loadDownloads() {
    headSize('DeviceLab-PC.exe').then(function (n) {
      var e = $('#exe-size');
      if (n && e) e.textContent = n.toLocaleString() + ' 字节';
    });
    headSize('DeviceLab-v1.0.apk').then(function (n) {
      if (!n) return;
      var m = $('#apk-meta'), s = $('#apk-size');
      if (m) m.textContent = fmtBytes(n) + ' · Android 7.0+';
      if (s) s.textContent = n.toLocaleString() + ' 字节';
    });
  }

  // ---------------- tabs ----------------
  function initTabs() {
    var tabs = document.querySelectorAll('.tab');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        tabs.forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        var which = t.getAttribute('data-tab');
        $('#view-pc').classList.toggle('hidden', which !== 'pc');
        $('#view-apk').classList.toggle('hidden', which !== 'apk');
      });
    });
  }

  // ---------------- boot ----------------
  function collectAll() {
    report = [];
    $('#sections').innerHTML = '';
    collectSystem();
    collectCpu();
    collectGpu();
    collectDisplay();
    collectStorage();
    collectNetwork();
    collectBattery();
    collectMedia();
    collectFeatures();
  }

  function boot() {
    initTabs();
    collectAll();
    renderBenchShell();
    setGauge(0);
    var pill = $('#secure-pill');
    if (pill && pill.textContent.trim() === '—') {
      pill.textContent = window.isSecureContext ? 'HTTPS 安全环境' : '非安全环境';
    }
    $('#btn-refresh').addEventListener('click', function () {
      collectAll();
      renderBenchShell();
      $('#score').textContent = '—';
      $('#bench-status').textContent = '点击「开始跑分」，依次测试 CPU、内存、加密、图形与存储';
      $('#bench-bar').style.width = '0';
      setGauge(0);
      loadNative();
    });
    $('#btn-bench').addEventListener('click', runBenchmark);
    $('#btn-copy').addEventListener('click', copyReport);
    loadDownloads();
    loadNative();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
