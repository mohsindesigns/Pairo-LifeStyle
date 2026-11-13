/* Rack3D — WebGL clothing rack.
 * Requires window.THREE (with GLTFLoader, RoomEnvironment) and window.gsap — see src/globals.js.
 * Loads .glb models; textures are decoded with createImageBitmap so it also runs under strict CSPs. */
(function () {
  var T = window.THREE;
  var PI = Math.PI;

  function b64ToBuf(s) {
    var bin = atob(s.replace(/\s+/g, ''));
    var n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return u.buffer;
  }
  function extractB64(t) {
    var a = t.indexOf(',"'), b = t.lastIndexOf('"');
    if (a >= 0 && b > a) return t.slice(a + 2, b);
    return t; // raw base64 file
  }

  // --- fetch the model text: fetch() first, <script> injection as a fallback (no connect-src needed)
  var pending = {};
  window.__R3D = function (src, b64) {
    for (var k in pending) {
      if (src && src.indexOf(k) !== -1) { var r = pending[k]; delete pending[k]; r(b64); return; }
    }
  };
  function viaScript(url) {
    return new Promise(function (res, rej) {
      var key = url.split('/').pop();
      pending[key] = res;
      var sc = document.createElement('script');
      sc.async = true; sc.src = url;
      sc.onerror = function () { delete pending[key]; rej(new Error('script load failed')); };
      document.head.appendChild(sc);
      setTimeout(function () { if (pending[key]) { delete pending[key]; rej(new Error('script timeout')); } }, 60000);
    });
  }
  function getText(url) {
    return fetch(url, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.text();
    }).then(extractB64).catch(function (e) {
      Rack3D.lastFetchError = String(e && e.message || e);
      return viaScript(url);
    });
  }

  // --- split a GLB: strip embedded images so GLTFLoader never needs blob: URLs
  function splitGLB(buf) {
    var dv = new DataView(buf);
    var jsonLen = dv.getUint32(12, true);
    var json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
    var binHdr = 20 + jsonLen;
    var binLen = dv.getUint32(binHdr, true);
    var bin = new Uint8Array(buf, binHdr + 8, binLen);
    var images = (json.images || []).map(function (im) {
      var bv = json.bufferViews[im.bufferView], off = bv.byteOffset || 0;
      return { mime: im.mimeType || 'image/png', bytes: bin.slice(off, off + bv.byteLength) };
    });
    var texSrc = (json.textures || []).map(function (t) {
      return t.extensions && t.extensions.EXT_texture_webp ? t.extensions.EXT_texture_webp.source : t.source;
    });
    var slots = [];
    (json.materials || []).forEach(function (m, mi) {
      var pbr = m.pbrMetallicRoughness || {};
      slots[mi] = {
        map: pbr.baseColorTexture ? texSrc[pbr.baseColorTexture.index] : null,
        normal: m.normalTexture ? texSrc[m.normalTexture.index] : null,
        orm: pbr.metallicRoughnessTexture ? texSrc[pbr.metallicRoughnessTexture.index] : null
      };
      delete pbr.baseColorTexture; delete pbr.metallicRoughnessTexture; delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture;
      m.name = (m.name || 'm') + '#' + mi;
    });
    delete json.textures; delete json.images; delete json.samplers;
    ['extensionsUsed', 'extensionsRequired'].forEach(function (k) {
      if (json[k]) { json[k] = json[k].filter(function (e) { return e !== 'EXT_texture_webp'; }); if (!json[k].length) delete json[k]; }
    });
    var jtxt = JSON.stringify(json);
    while (jtxt.length % 4) jtxt += ' ';
    var jb = new TextEncoder().encode(jtxt);
    var total = 12 + 8 + jb.length + 8 + bin.length;
    var out = new ArrayBuffer(total), o = new DataView(out), u = new Uint8Array(out);
    o.setUint32(0, 0x46546C67, true); o.setUint32(4, 2, true); o.setUint32(8, total, true);
    o.setUint32(12, jb.length, true); o.setUint32(16, 0x4E4F534A, true); u.set(jb, 20);
    var bo = 20 + jb.length;
    o.setUint32(bo, bin.length, true); o.setUint32(bo + 4, 0x004E4942, true); u.set(bin, bo + 8);
    return { glb: out, images: images, slots: slots };
  }

  // --- decode image bytes without URLs where possible
  function decodeImage(img) {
    var blob = new Blob([img.bytes], { type: img.mime });
    function viaImg(src) {
      return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = src; });
    }
    function viaBlobUrl() { var u = URL.createObjectURL(blob); return viaImg(u); }
    function viaDataUrl() {
      return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(blob); }).then(viaImg);
    }
    if (window.createImageBitmap) {
      return createImageBitmap(blob, { imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
        .catch(function () { return createImageBitmap(blob); })
        .catch(viaBlobUrl).catch(viaDataUrl);
    }
    return viaBlobUrl().catch(viaDataUrl);
  }

  var cache = {};
  function loadModel(url) {
    if (cache[url]) return cache[url];
    cache[url] = fetch(url).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      var parts = splitGLB(buf);
      var texP = Promise.all(parts.images.map(function (im) { return decodeImage(im).catch(function () { return null; }); }));
      var sceneP = new Promise(function (res, rej) {
        new T.GLTFLoader().parse(parts.glb, '', function (g) { res(g.scene); }, rej);
      });
      return Promise.all([sceneP, texP]).then(function (r) {
        var scene = r[0], bmps = r[1];
        var made = {};
        function tex(idx, srgb) {
          if (idx == null || !bmps[idx]) return null;
          var key = idx + (srgb ? 's' : 'l');
          if (made[key]) return made[key];
          var tx = new T.Texture(bmps[idx]);
          tx.flipY = false; tx.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
          tx.anisotropy = 4; tx.needsUpdate = true;
          made[key] = tx; return tx;
        }
        scene.traverse(function (o) {
          if (!o.isMesh || !o.material) return;
          var m = o.material, mi = parseInt(String(m.name).split('#').pop(), 10);
          var sl = parts.slots[isNaN(mi) ? 0 : mi] || parts.slots[0] || {};
          var map = tex(sl.map, true), nrm = tex(sl.normal, false), orm = tex(sl.orm, false);
          if (map) { m.map = map; }
          if (nrm) { m.normalMap = nrm; }
          if (orm) { m.roughnessMap = orm; m.metalnessMap = orm; }
          m.needsUpdate = true;
        });
        return scene;
      });
    });
    return cache[url];
  }

  // Wrap a loaded scene so its top-centre sits at the origin; return group + size (unit height)
  function normalise(scene) {
    var box = new T.Box3().setFromObject(scene);
    var size = box.getSize(new T.Vector3());
    var c = box.getCenter(new T.Vector3());
    var g = new T.Group();
    scene.position.set(-c.x, -box.max.y, -c.z);
    g.add(scene);
    var mats = [];
    scene.traverse(function (o) {
      if (o.isMesh) {
        o.castShadow = true; o.receiveShadow = true;
        var m = o.material;
        if (m) { m.envMapIntensity = 0.9; m.side = T.DoubleSide; mats.push(m); }
      }
    });
    g.userData.mats = mats;
    g.userData.size = size;
    return g;
  }

  function setOpacity(group, op) {
    if (!group) return;
    group.traverse(function (o) {
      if (o.material) {
        var ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(function (m) {
          m.transparent = op < 0.999;
          m.opacity = op;
          m.depthWrite = op > 0.5;
        });
      }
    });
  }

  function Rack3D(canvas, opts) {
    this.canvas = canvas;
    this.o = opts;
    this.items = [];
    this.mode = 'rack';
    this.hover = -1;
    this.sel = -1;
    this.k = 0.74;            // global garment scale
    this.railY = 1.02;
    this.mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    this.spin = { yaw: -PI / 2, vel: 0, tilt: 0, drag: false, lastX: 0, idle: 0 };
    this.clock = new T.Clock();
    this.alive = true;
    this.visible = true;
    this._init();
  }

  Rack3D.prototype._init = function () {
    var self = this, o = this.o;
    var r = this.renderer = new T.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 2));
    r.outputColorSpace = T.SRGBColorSpace;
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.02;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    var bg = new T.Color(o.bg || '#ECEAE5');
    r.setClearColor(0x000000, 0);

    var s = this.scene = new T.Scene();
    var pm = new T.PMREMGenerator(r);
    s.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.75;

    var cam = this.cam = new T.PerspectiveCamera(28, 1, 0.1, 60);
    this.camBase = new T.Vector3(0, 0.5, 4.9);
    this.look = new T.Vector3(0, 0.46, 0);

    var key = new T.DirectionalLight(0xfff4e6, 2.1);
    key.position.set(-1.6, 3.4, 5.2);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4; key.shadow.camera.right = 4;
    key.shadow.camera.top = 3; key.shadow.camera.bottom = -2;
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 14;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    key.shadow.radius = 10; key.shadow.blurSamples = 16;
    s.add(key);
    var fill = new T.DirectionalLight(0xe8eeff, 0.55);
    fill.position.set(3, 1.5, 2.5);
    s.add(fill);

    // studio: shadow-catching wall + floor on a flat backdrop
    var wall = new T.Mesh(new T.PlaneGeometry(30, 12), new T.ShadowMaterial({ color: 0x2e271d, opacity: 0.2 }));
    wall.position.set(0, 1.5, -0.42); wall.receiveShadow = true; s.add(wall);
    
    // rail
    var metal = this.metal = new T.MeshStandardMaterial({ color: 0xcfcac1, metalness: 1, roughness: 0.24 });
    this.railG = new T.Group(); s.add(this.railG);
    var rail = new T.Mesh(new T.CylinderGeometry(0.021, 0.021, 1, 32), metal);
    rail.rotation.z = PI / 2; rail.castShadow = true; this.rail = rail; this.railG.add(rail);
    var capGeo = new T.SphereGeometry(0.03, 24, 16);
    this.capL = new T.Mesh(capGeo, metal); this.capR = new T.Mesh(capGeo, metal);
    this.railG.add(this.capL, this.capR);
    var rodGeo = new T.CylinderGeometry(0.007, 0.007, 4, 12);
    this.rodL = new T.Mesh(rodGeo, metal); this.rodR = new T.Mesh(rodGeo, metal);
    this.rodL.castShadow = this.rodR.castShadow = true;
    this.railG.add(this.rodL, this.rodR);

    // hook + hanger shared geometry
    var hookPts = [
      new T.Vector3(0, -0.012, -0.034), new T.Vector3(0, 0.03, -0.03), new T.Vector3(0, 0.046, 0),
      new T.Vector3(0, 0.03, 0.03), new T.Vector3(0, -0.004, 0.03), new T.Vector3(0, -0.05, 0.016),
      new T.Vector3(0, -0.085, 0), new T.Vector3(0, -0.14, 0)
    ];
    this.hookGeo = new T.TubeGeometry(new T.CatmullRomCurve3(hookPts), 48, 0.0045, 8, false);
    var hp = [new T.Vector3(0, -0.14, 0), new T.Vector3(0, -0.2, -0.17), new T.Vector3(0, -0.2, 0.17), new T.Vector3(0, -0.14, 0)];
    this.barGeo = new T.TubeGeometry(new T.CatmullRomCurve3(hp, false, 'catmullrom', 0.05), 40, 0.004, 6, false);

    this.ray = new T.Raycaster();
    this._bind();
    this.resize();

    // build items
    var total = o.items.length, done = 0;
    o.items.forEach(function (it, i) {
      var pivot = new T.Group();
      var hook = new T.Mesh(self.hookGeo, metal.clone()); hook.castShadow = true;
      var turn = new T.Group();
      var bar = new T.Mesh(self.barGeo, metal.clone());
      turn.add(bar);
      pivot.add(hook); pivot.add(turn);
      s.add(pivot);
      var item = { i: i, def: it, pivot: pivot, hook: hook, turn: turn, bar: bar, model: null, hi: {},
        x: 0, px: 0, vx: 0, z: 0, pz: 0, vz: 0, swingZ: 0, swingZv: 0, swingX: 0, swingXv: 0,
        state: { x: 0, z: 0, y: self.railY, yaw: 0, scale: 1, op: 1 } };
      self.items.push(item);
      pivot.visible = false;
      loadModel(it.lo).then(function (scene) {
        var g = normalise(scene);
        self._mount(item, g);
        done++;
        o.onProgress && o.onProgress(done / total);
        if (done === total) self._ready();
      }).catch(function (e) {
        done++;
        self.failed = (self.failed || 0) + 1;
        self.failReason = String(e && e.message || e);
        o.onError && o.onError(e);
        o.onProgress && o.onProgress(done / total);
        if (done === total) self._ready();
      });
    });

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
    if ('IntersectionObserver' in window) {
      this._io = new IntersectionObserver(function (en) { self.visible = en[0].isIntersecting; });
      this._io.observe(this.canvas);
    }
  };

  Rack3D.prototype._mount = function (item, g) {
    var sc = this.k * (item.def.scale || 1);
    g.scale.setScalar(sc);
    g.position.y = -0.155;
    if (item.model) item.turn.remove(item.model);
    item.model = g;
    item.turn.add(g);
    var sz = g.userData.size;
    item.depth = sz.x * sc;  // extent along X when side-on
    item.width = sz.z * sc;  // extent along Z (shoulders)
    item.height = sz.y * sc;
  };

  Rack3D.prototype._ready = function () {
    var self = this;
    if (this.failed) { this.o.onFail && this.o.onFail(this.failReason || 'model load failed'); return; }
    this.ready = true;
    this.layoutRack(-1, true);
    this.railScale = { v: 0 };
    this.items.forEach(function (it) { it.state.op = 0; it.state.y = self.railY + 1.6; });
    this.o.onReady && this.o.onReady();
  };

  Rack3D.prototype.intro = function (delay) {
    var self = this;
    if (!this.ready) return;
    this.introd = true;
    gsap.to(this.railScale, { v: 1, duration: 1.4, ease: 'expo.inOut', delay: delay || 0 });
    this.items.forEach(function (it, i) {
      var st = it.state;
      gsap.to(st, { y: self.railY, op: 1, duration: 1.6, ease: 'expo.out', delay: (delay || 0) + 0.5 + Math.abs(i - (self.items.length - 1) / 2) * 0.07 });
      gsap.delayedCall((delay || 0) + 0.9 + i * 0.03, function () { it.swingZv += (i % 2 ? 1 : -1) * 2.2; });
    });
  };

  Rack3D.prototype.slots = function () {
    var xs = [], it = this.items, x = 0;
    for (var i = 0; i < it.length; i++) {
      if (i > 0) x += ((it[i - 1].depth || 0.3) + (it[i].depth || 0.3)) / 2 * 0.86;
      xs.push(x);
    }
    var mid = (xs[0] + xs[xs.length - 1]) / 2;
    return xs.map(function (v) { return v - mid; });
  };

  Rack3D.prototype.layoutRack = function (h, instant) {
    var self = this, xs = this.slots();
    var G = 0;
    if (h >= 0) { var hi = this.items[h]; G = (hi.width * 1.14) / 2 + 0.05 - (hi.depth || 0.3) * 0.43; }
    this.items.forEach(function (it, i) {
      var st = it.state, t = { x: xs[i], z: 0, yaw: -0.18, scale: 1, y: self.railY, op: 1 };
      if (h >= 0) {
        if (i < h) { t.x -= G; t.yaw = -0.18 + 0.22; }
        else if (i > h) { t.x += G; t.yaw = -0.18 - 0.22; }
        else { t.yaw = -PI / 2 + 0.06; t.z = 0.32; t.scale = 1.14; }
      }
      if (instant) { Object.assign(st, t); return; }
      gsap.to(st, Object.assign(t, { duration: 1.05, ease: 'expo.out', overwrite: 'auto' }));
    });
    var span = xs[xs.length - 1] - xs[0] + 0.7;
    this.railLen = span;
  };

  Rack3D.prototype.setHover = function (h) {
    if (this.mode !== 'rack' || h === this.hover) return;
    this.hover = h;
    this.layoutRack(h);
    this.o.onHover && this.o.onHover(h);
  };

  Rack3D.prototype.enterProduct = function (i) {
    var self = this;
    this.mode = 'product'; this.sel = i; this.hover = -1;
    this.items.forEach(function (it, j) {
      if (j === i) return;
      var d = j < i ? -1 : 1;
      gsap.to(it.state, { x: it.state.x + d * 3.4, op: 0, yaw: it.state.yaw + d * 0.9, duration: 1.1, ease: 'power3.inOut', overwrite: 'auto' });
    });
    gsap.to(this.railScale, { v: 0, duration: 0.8, ease: 'power3.in' });
    this.color = 0;
    this._center(i, 0);
    this._loadHi(this.items[i], 0);
  };

  Rack3D.prototype._productTarget = function (it) {
    var h = it.height || 0.8;
    var sc = Math.min(1.9, 1.1 / h);
    var topOffset = 0.155 * 1;
    return { x: 0, z: 0.4, scale: sc, y: 0.7 + (topOffset + h / 2) * sc, op: 1 };
  };

  Rack3D.prototype._center = function (i, fromSide) {
    var it = this.items[i], self = this, t = this._productTarget(it);
    if (fromSide) {
      it.state.x = fromSide * 3.4; it.state.op = 0; it.state.z = t.z; it.state.scale = t.scale; it.state.y = t.y;
      it.state.yaw = -PI / 2 + fromSide * 1.6;
    }
    this.spin.yaw = it.state.yaw; this.spin.vel = 0; this.spin.idle = 0;
    this.spinLock = true;
    gsap.to(it.state, Object.assign({}, t, { duration: 1.25, ease: 'expo.out', overwrite: 'auto' }));
    gsap.to(this.spin, { yaw: -PI / 2, duration: 1.4, ease: 'expo.out', onComplete: function () { self.spinLock = false; } });
  };

  Rack3D.prototype.step = function (d) {
    var N = this.items.length;
    this.goTo((this.sel + d + N) % N, d);
  };

  Rack3D.prototype.goTo = function (next, d) {
    if (this.mode !== 'product' || next === this.sel) return;
    var cur = this.items[this.sel];
    d = d || (next > this.sel ? 1 : -1);
    cur.state.yaw = this.spin.yaw;
    gsap.to(cur.state, { x: -d * 3.4, op: 0, yaw: cur.state.yaw - d * 1.6, duration: 0.9, ease: 'power3.in', overwrite: 'auto' });
    this.sel = next; this.color = 0;
    this._center(next, d);
    this._loadHi(this.items[next], 0);
  };

  Rack3D.prototype.setColorInstant = function (ci) { this.color = ci; };

  Rack3D.prototype._loadHi = function (it, ci) {
    var self = this;
    var url = ci ? it.def.alt : it.def.hi;
    if (!url) return Promise.resolve();
    if (it.hi[ci]) { if (it.model !== it.hi[ci]) this._swap(it, it.hi[ci]); return Promise.resolve(); }
    return loadModel(url).then(function (scene) {
      var g = normalise(scene);
      it.hi[ci] = g;
      if (self.sel === it.i && (self.color || 0) === ci) self._swap(it, g);
    }).catch(function () {});
  };

  Rack3D.prototype._swap = function (it, g) {
    var op = it.state.op;
    this._mount(it, g);
    setOpacity(g, op);
  };

  Rack3D.prototype.setColor = function (ci) {
    if (this.mode !== 'product') return;
    var self = this, it = this.items[this.sel];
    this.color = ci;
    this.spinLock = true;
    var start = this.spin.yaw;
    var p = it.hi[ci] ? Promise.resolve() : loadModel(ci ? it.def.alt : it.def.hi).then(function (sc) { it.hi[ci] = normalise(sc); });
    gsap.to(this.spin, { yaw: start + PI, duration: 0.55, ease: 'power2.in', onComplete: function () {
      p.then(function () {
        if (self.sel === it.i && it.hi[ci]) self._swap(it, it.hi[ci]);
        // garment was at back-facing; continue round to the front
        gsap.to(self.spin, { yaw: start + 2 * PI, duration: 1.1, ease: 'expo.out', onComplete: function () { self.spin.yaw = start; self.spinLock = false; } });
      });
    } });
  };

  Rack3D.prototype.exitProduct = function () {
    var self = this;
    var sel = this.items[this.sel];
    if (sel) {
      var y = this.spin.yaw; y = ((y + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
      sel.state.yaw = y;
    }
    this.mode = 'rack'; this.sel = -1; this.color = 0; this.hover = -1;
    this.items.forEach(function (it) { if (it.loModel && it.model !== it.loModel) self._swap(it, it.loModel); });
    gsap.to(this.railScale, { v: 1, duration: 1.1, ease: 'expo.inOut' });
    var xs = this.slots();
    this.items.forEach(function (it, i) {
      gsap.to(it.state, { x: xs[i], z: 0, y: self.railY, yaw: -0.18, scale: 1, op: 1, duration: 1.3, ease: 'expo.out', delay: Math.abs(i - (self.items.length - 1) / 2) * 0.03, overwrite: 'auto' });
      it.swingZv += (i % 2 ? 1 : -1) * 2.5;
    });
  };

  Rack3D.prototype._bind = function () {
    var self = this, c = this.canvas;
    this._pm = function (e) {
      var r = c.getBoundingClientRect();
      var nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      self.mouse.tx = nx; self.mouse.ty = ny; self.mouse.nx = nx; self.mouse.ny = ny; self.mouse.on = true;
      if (self.spin.drag) {
        var dx = e.clientX - self.spin.lastX; self.spin.lastX = e.clientX;
        self.spin.yaw += dx * 0.011; self.spin.vel = dx * 0.011 * 60; self.spin.idle = 0;
      }
    };
    this._pd = function (e) {
      self.downX = e.clientX; self.downY = e.clientY; self.ptrType = e.pointerType;
      if (self.mode === 'product' && !self.spinLock) {
        self.spin.drag = true; self.spin.lastX = e.clientX; self.spin.vel = 0;
        self.o.onDrag && self.o.onDrag(true);
      }
    };
    this._pu = function (e) {
      var moved = Math.abs(e.clientX - (self.downX || 0)) + Math.abs(e.clientY - (self.downY || 0)) > 6;
      if (self.spin.drag) { self.spin.drag = false; self.o.onDrag && self.o.onDrag(false); }
      if (!moved && self.mode === 'rack') {
        var h = self._pick();
        if (h >= 0) {
          if (self.ptrType === 'touch' && self.hover !== h) { self.setHover(h); return; }
          self.o.onClick && self.o.onClick(h);
        }
      }
    };
    this._pl = function () {
      self.mouse.on = false; self.mouse.tx = 0; self.mouse.ty = 0;
      if (self.spin.drag) { self.spin.drag = false; self.o.onDrag && self.o.onDrag(false); }
      if (self.mode === 'rack') self.setHover(-1);
    };
    c.addEventListener('pointermove', this._pm);
    c.addEventListener('pointerdown', this._pd);
    window.addEventListener('pointerup', this._pu);
    c.addEventListener('pointerleave', this._pl);
    this._rs = function () { self.resize(); };
    window.addEventListener('resize', this._rs);
  };

  Rack3D.prototype._pick = function () {
    if (!this.mouse.on || !this.ready) return -1;
    this.ray.setFromCamera(new T.Vector2(this.mouse.nx, this.mouse.ny), this.cam);
    var best = -1, bd = 1e9;
    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i]; if (!it.model) continue;
      var hit = this.ray.intersectObject(it.model, true);
      if (hit.length && hit[0].distance < bd) { bd = hit[0].distance; best = i; }
    }
    return best;
  };

  Rack3D.prototype.resize = function () {
    var w = this.canvas.clientWidth || 1, h = this.canvas.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    var a = w / h;
    this.cam.aspect = a;
    // fit the rack width on narrow screens
    var need = 3.9;
    var halfW = Math.tan((this.cam.fov * PI / 180) / 2) * a;
    this.dist = Math.max(4.9, (need / 2) / halfW + 0.5);
    this.cam.updateProjectionMatrix();
  };

  Rack3D.prototype._loop = function () {
    if (!this.alive) return;
    requestAnimationFrame(this._loop);
    var dt = Math.min(0.05, this.clock.getDelta());
    if (!this.visible) return;
    var t = this.clock.elapsedTime, self = this;

    // camera parallax
    var m = this.mouse;
    m.x += (m.tx - m.x) * 0.05; m.y += (m.ty - m.y) * 0.05;
    var prodK = this.mode === 'product' ? 0.35 : 1;
    this.cam.position.set(m.x * 0.32 * prodK, this.camBase.y + m.y * 0.14 * prodK, this.dist);
    this.cam.lookAt(this.look);

    // rail
    var rs = this.railScale ? this.railScale.v : 0;
    var len = (this.railLen || 3) * Math.max(0.0001, rs);
    this.rail.scale.set(1, len, 1); this.rail.position.set(0, this.railY, 0);
    this.capL.position.set(-len / 2, this.railY, 0); this.capR.position.set(len / 2, this.railY, 0);
    this.capL.visible = this.capR.visible = rs > 0.02;
    this.rodL.position.set(-len / 2 + 0.06, this.railY + 2, 0); this.rodR.position.set(len / 2 - 0.06, this.railY + 2, 0);
    this.rodL.scale.y = this.rodR.scale.y = Math.max(0.0001, rs);
    this.railG.visible = rs > 0.01;

    // product spin
    if (this.mode === 'product' && !this.spinLock) {
      if (!this.spin.drag) {
        this.spin.idle += dt;
        this.spin.vel *= Math.pow(0.04, dt);
        var auto = this.spin.idle > 2.2 ? 0.32 : 0;
        this.spin.yaw += (this.spin.vel + auto) * dt;
      }
    }
    var tiltT = this.mode === 'product' && m.on ? -m.y * 0.12 : 0;
    this.spin.tilt += (tiltT - this.spin.tilt) * 0.06;

    // hover picking (throttled)
    this._pf = (this._pf || 0) + 1;
    if (this.mode === 'rack' && this.ready && this._pf % 3 === 0 && m.on) {
      var h = this._pick();
      if (h !== this.hover) this.setHover(h);
    }

    for (var i = 0; i < this.items.length; i++) {
      var it = this.items[i], st = it.state;
      // swing physics driven by acceleration of the hook along the rail
      var vx = (st.x - it.px) / Math.max(dt, 1e-3), ax = (vx - it.vx) / Math.max(dt, 1e-3);
      it.px = st.x; it.vx = vx;
      var vz = (st.z - it.pz) / Math.max(dt, 1e-3), az = (vz - it.vz) / Math.max(dt, 1e-3);
      it.pz = st.z; it.vz = vz;
      var kS = 38, cS = 2.4;
      it.swingZv += (-kS * it.swingZ - cS * it.swingZv + Math.max(-60, Math.min(60, ax)) * 0.16) * dt;
      it.swingZ += it.swingZv * dt;
      it.swingXv += (-kS * it.swingX - cS * it.swingXv - Math.max(-60, Math.min(60, az)) * 0.12) * dt;
      it.swingX += it.swingXv * dt;
      var idle = Math.sin(t * 0.7 + i * 1.7) * 0.012;
      var p = it.pivot;
      p.position.set(st.x, st.y, st.z);
      p.rotation.set(it.swingX * (this.mode === 'product' && i === this.sel ? 0.3 : 1), 0, (it.swingZ + idle) * (this.mode === 'product' && i === this.sel ? 0.2 : 1));
      var yaw = (this.mode === 'product' && i === this.sel) ? this.spin.yaw : st.yaw;
      it.turn.rotation.set(i === this.sel ? this.spin.tilt : 0, yaw, 0);
      it.turn.scale.setScalar(st.scale);
      it.hook.scale.setScalar(1);
      it.hook.visible = st.op > 0.05 && (this.mode === 'rack');
      it.bar.visible = this.mode === 'rack';
      if (it.model) {
        if (Math.abs((it._op === undefined ? 1 : it._op) - st.op) > 0.004) { setOpacity(it.model, st.op); it._op = st.op; }
        p.visible = st.op > 0.01;
      }
    }
    this.renderer.render(this.scene, this.cam);
  };

  // keep the rack-resolution model around so exit can restore it
  var _mount = Rack3D.prototype._mount;
  Rack3D.prototype._mount = function (item, g) {
    if (!item.loModel) item.loModel = g;
    _mount.call(this, item, g);
  };

  Rack3D.prototype.dispose = function () {
    this.alive = false;
    var c = this.canvas;
    c.removeEventListener('pointermove', this._pm); c.removeEventListener('pointerdown', this._pd);
    window.removeEventListener('pointerup', this._pu); c.removeEventListener('pointerleave', this._pl);
    window.removeEventListener('resize', this._rs);
    if (this._io) this._io.disconnect();
    this.renderer.dispose();
  };

  Rack3D.supported = function () {
    try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
  };

  window.Rack3D = Rack3D;
})();
