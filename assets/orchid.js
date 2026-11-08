/* 3D-орхидея цимбидиум в горшке: бутоны раскрываются один за другим, по нажатию меняется цвет. Чистый WebGL, без библиотек. */
(function () {
  var cv = document.getElementById('or');
  var gl = cv && (cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }) || cv.getContext('experimental-webgl'));
  if (!gl) { document.documentElement.classList.add('no-gl'); window.OR = { scroll: function () {}, live: function () {} }; return; }
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PI = Math.PI;

  /* ---------- математика ---------- */
  function mul(a, b) { var o = new Float32Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); }
  function trans(x, y, z) { var m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function scl(x, y, z) { var m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; }
  function rotX(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function rotY(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function rotZ(a) { var c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function persp(fov, asp, n, f) { var t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = 2 * f * n / (n - f); return m; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lookAt(e, t) { var z = norm([e[0] - t[0], e[1] - t[1], e[2] - t[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]); }
  function basis(d) { var y = norm(d), up = Math.abs(y[2]) < .9 ? [0, 0, 1] : [1, 0, 0], x = norm(cross(up, y)), z = cross(x, y); return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]); }
  function chain() { var m = arguments[0]; for (var i = 1; i < arguments.length; i++) m = mul(m, arguments[i]); return m; }

  /* ---------- геометрия ---------- */
  function Geo() { this.d = []; }
  Geo.prototype.surf = function (F, nu, nv, M) { // F(u,v) -> [x,y,z,m], нормали по разностям
    M = M || ident(); var P = [], i, j, e = 1e-3;
    for (j = 0; j <= nv; j++) for (i = 0; i <= nu; i++) {
      var u = i / nu, v = j / nv, p = F(u, v), pu = F(Math.min(1, u + e), v), pu2 = F(Math.max(0, u - e), v), pv = F(u, Math.min(1, v + e)), pv2 = F(u, Math.max(0, v - e));
      var n = cross([pu[0] - pu2[0], pu[1] - pu2[1], pu[2] - pu2[2]], [pv[0] - pv2[0], pv[1] - pv2[1], pv[2] - pv2[2]]);
      if (!(n[0] || n[1] || n[2])) n = [0, 1, 0];
      P.push([p, norm(n)]);
    }
    var w = nu + 1;
    for (j = 0; j < nv; j++) for (i = 0; i < nu; i++) {
      var a = P[j * w + i], b = P[j * w + i + 1], c = P[(j + 1) * w + i + 1], d = P[(j + 1) * w + i];
      this.tri(a, b, c, M); this.tri(a, c, d, M);
    }
  };
  Geo.prototype.tri = function () {
    var M = arguments[3], self = this;
    for (var k = 0; k < 3; k++) {
      var q = arguments[k], p = q[0], n = q[1];
      self.d.push(M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14],
        M[0] * n[0] + M[4] * n[1] + M[8] * n[2], M[1] * n[0] + M[5] * n[1] + M[9] * n[2], M[2] * n[0] + M[6] * n[1] + M[10] * n[2], p[3]);
    }
  };
  Geo.prototype.upload = function () {
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.d), gl.STATIC_DRAW);
    var n = this.d.length / 7; this.d = null; return { b: b, n: n };
  };

  /* лепесток: растёт вдоль y, края загибаются к центру цветка, кончик отгибается наружу */
  function petal(g, o) {
    var F = function (u, v) {
      var s = u * 2 - 1, w = o.w * Math.pow(Math.sin(PI * (.08 + .86 * v)), o.sh || .6);
      var x = s * w, y = o.l * v, z = -o.cup * s * s * w + o.curl * v * v * v * o.l;
      y -= o.tipDip ? o.tipDip * s * s * v * v : 0;
      return [x, y, z, o.m === undefined ? v : o.m];
    };
    g.surf(F, o.nu || 7, o.nv || 8, chain(rotY(o.a), trans(0, o.y || 0, o.r), rotX(o.t)));
  }
  function disc(g, r, h, m, M) { // приплюснутая полусфера: серединка, чашелистик
    g.surf(function (u, v) { var a = u * 2 * PI, b = v * PI / 2; return [Math.cos(a) * Math.cos(b) * r, Math.sin(b) * h, Math.sin(a) * Math.cos(b) * r, m]; }, 18, 5, M);
  }

  /* роза: тугой бутон внутри, раскрытые лепестки снаружи */
  var rose = new Geo(), GA = 2.39996;
  [[5, .14, .32, .5, .2, .25, .02], [5, .45, .42, .62, .3, .4, .06], [6, .8, .52, .72, .38, .5, .12], [6, 1.12, .6, .76, .44, .55, .22]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(rose, { a: k / L[0] * 2 * PI + li * .7, t: L[1], w: L[2], l: L[3], r: L[4] * .35, cup: L[5], curl: L[6], y: -li * .05 });
  });
  disc(rose, .34, -.28, .1, ident());
  var roseB = rose.upload();

  /* кустовая роза: маленькая и раскрытая */
  var spray = new Geo();
  [[5, .5, .3, .4, .2, .35, .05], [6, 1.0, .36, .46, .3, .3, .15]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(spray, { a: k / L[0] * 2 * PI + li * .6, t: L[1], w: L[2], l: L[3], r: L[4] * .3, cup: L[5], curl: L[6] });
  });
  disc(spray, .2, -.18, .1, ident());
  var sprayB = spray.upload();

  /* хризантема-ромашка: серединка и два ряда узких лепестков */
  var daisy = new Geo();
  [[18, 1.25, .1, .78, .02], [16, 1.5, .09, .7, .1]].forEach(function (L, li) {
    for (var k = 0; k < L[0]; k++) petal(daisy, { a: (k + li * .5) / L[0] * 2 * PI, t: L[1], w: L[2], l: L[3], r: .18, cup: .5, curl: L[4], sh: .45, nu: 3, nv: 6, y: .04 - li * .03 });
  });
  disc(daisy, .24, .14, 2, trans(0, .02, 0));
  var daisyB = daisy.upload();

  /* лист эвкалипта/зелени */
  var leaf = new Geo();
  petal(leaf, { a: 0, t: 0, w: .26, l: 1.25, r: 0, cup: .25, curl: .25, sh: .9, nv: 9 });
  var leafB = leaf.upload();

  /* обёртка: два слоя бумаги с волнистым краем, спереди ниже, чтобы цветы были видны */
  function wrapGeo(rot, lift, waves, m) {
    var g = new Geo();
    g.surf(function (u, v) {
      var a = u * 2 * PI, t = v;
      var front = Math.max(0, Math.cos(a - PI / 2 + rot));
      var top = .55 + lift - 1.0 * front * front + .16 * Math.sin(a * waves);
      var y = -3.3 + (top + 3.3) * t;
      var r = (.32 + Math.pow(t, 1.25) * .98) * (1 + .05 * Math.sin(a * waves + 1) * t);
      return [Math.cos(a) * r, y, Math.sin(a) * r, m + t * .9];
    }, 72, 14);
    return g.upload();
  }
  var wrapA = wrapGeo(0, 0, 5, 0), wrapB = wrapGeo(.5, .22, 4, 0);
  var ribbon = new Geo();
  ribbon.surf(function (u, v) { var a = u * 2 * PI, b = v * 2 * PI, R = .52, r = .07; return [Math.cos(a) * (R + Math.cos(b) * r), Math.sin(b) * r * 1.6, Math.sin(a) * (R + Math.cos(b) * r), 2]; }, 40, 8);
  [-1, 1].forEach(function (s) { // хвосты ленты
    ribbon.surf(function (u, v) { var x = s * (.1 + v * .5), y = -v * 1.2, z = .55 + Math.sin(v * 3) * .08; return [x + (u - .5) * .22, y, z + (u - .5) * .02 * s, 2]; }, 2, 8);
  });
  var ribbonB = ribbon.upload();
  var stem = new Geo();
  stem.surf(function (u, v) { var a = u * 2 * PI; return [Math.cos(a) * .05, -v * 1.1, Math.sin(a) * .05, .5]; }, 8, 1);
  var stemB = stem.upload();
  /* ---------- шейдер: лепестки, губа с крапом, стебель, листья, горшок ---------- */
  var VS = 'attribute vec3 aP;attribute vec3 aN;attribute float aM;uniform mat4 uVP;uniform mat4 uW;varying vec3 vW;varying vec3 vN;varying float vM;varying vec3 vO;' +
    'void main(){vec4 w=uW*vec4(aP,1.);vW=w.xyz;vO=aP;vN=mat3(uW[0].xyz,uW[1].xyz,uW[2].xyz)*aN;vM=aM;gl_Position=uVP*w;}';
  var FS = 'precision mediump float;varying vec3 vW;varying vec3 vN;varying float vM;varying vec3 vO;uniform vec3 uC1;uniform vec3 uC3;uniform vec3 uE;uniform float uFade;' +
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}' +
    'void main(){vec3 N=normalize(vN);vec3 V=normalize(uE-vW);if(dot(N,V)<0.)N=-N;vec3 b;float gl=.15;' +
    'if(vM<1.5){b=mix(uC1*vec3(.86,.9,.8),uC1,smoothstep(0.,.8,vM));b=mix(b,uC3,.10*smoothstep(.5,1.,vM));}' +
    'else if(vM<3.5){float t=vM-2.;b=mix(mix(vec3(.99,.96,.86),uC3,.55),uC1,smoothstep(.55,1.,t));' +
    'vec2 g=vO.xz*30.+vec2(vO.y*7.);vec2 fr=fract(g)-.5;float sp=(1.-smoothstep(.18,.26,length(fr)))*step(.4,h(floor(g)));b=mix(b,uC3*.8,sp*.85*(1.-smoothstep(.5,.85,t)));b=mix(b,uC3*.9,.55*smoothstep(.75,1.,t));}' +
    'else if(vM<4.5){b=vec3(.98,.95,.86);}' +
    'else if(vM<5.5){b=vec3(.42,.56,.3);}' +
    'else if(vM<6.5){b=mix(vec3(.2,.38,.2),vec3(.45,.62,.33),fract(vM)*2.);gl=.25;}' +
    'else if(vM<7.5){b=vec3(.97,.9,.91)*mix(.88,1.,fract(vM)*2.);gl=.9;}' +
    'else if(vM<8.5){b=vec3(.3,.23,.18);gl=0.;}' +
    'else{b=mix(vec3(.5,.62,.34),uC1,smoothstep(.2,.9,fract(vM)));}' +
    'vec3 L1=normalize(vec3(-.5,.8,.7));vec3 L2=normalize(vec3(.85,.15,.45));' +
    'float d1=max(0.,dot(N,L1)*.6+.4);float d2=max(0.,dot(N,L2))*.3;float f=1.-max(dot(N,V),0.);' +
    'float sp2=pow(max(dot(N,normalize(L1+V)),0.),36.)*gl;' +
    'vec3 c=b*(.36+d1*.7+d2)+vec3(sp2)+mix(vec3(1.,.96,.97),b,.4)*pow(f,2.4)*.18;' +
    'gl_FragColor=vec4(min(c,vec3(1.))*uFade,uFade);}';
  function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(o)); return o; }
  var pg = gl.createProgram(); gl.attachShader(pg, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pg, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pg);
  var A = { p: gl.getAttribLocation(pg, 'aP'), n: gl.getAttribLocation(pg, 'aN'), m: gl.getAttribLocation(pg, 'aM') };
  var U = {}; ['uVP', 'uW', 'uC1', 'uC3', 'uE', 'uFade'].forEach(function (n) { U[n] = gl.getUniformLocation(pg, n); });
  gl.useProgram(pg); gl.enable(gl.DEPTH_TEST); gl.clearColor(0, 0, 0, 0);
  [A.p, A.n, A.m].forEach(function (l) { gl.enableVertexAttribArray(l); });
  function draw(buf, W) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.b);
    gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 28, 0); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 28, 12); gl.vertexAttribPointer(A.m, 1, gl.FLOAT, false, 28, 24);
    gl.uniformMatrix4fv(U.uW, false, W);
    gl.drawArrays(gl.TRIANGLES, 0, buf.n);
  }
  function add(a, b, k) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
  /* рамка цветка: y – куда смотрит цветок, z – куда смотрит верхний чашелистик */
  function frame(f, u) {
    var y = norm(f), d = dot(u, y), z = norm([u[0] - y[0] * d, u[1] - y[1] * d, u[2] - y[2] * d]), x = cross(y, z);
    return new Float32Array([x[0], x[1], x[2], 0, y[0], y[1], y[2], 0, z[0], z[1], z[2], 0, 0, 0, 0, 1]);
  }
  function tube(g, a, b, r, m) {
    var y = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]), L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    var M = chain(trans(a[0], a[1], a[2]), frame(y, Math.abs(y[1]) < .9 ? [0, 1, 0] : [1, 0, 0]));
    g.surf(function (u, v) { var t = u * 2 * PI; return [Math.cos(t) * r, v * L, Math.sin(t) * r, m]; }, 7, 1, M);
  }

  /* ---------- цветок цимбидиума: 3 чашелистика, 2 лепестка, губа, колонка ---------- */
  var bl = new Geo();
  [0, 2.25, -2.25].forEach(function (a) { petal(bl, { a: a, t: 1.38, w: .21, l: 1.0, r: .04, cup: .22, curl: .12, sh: .7, nu: 6, nv: 8 }); });
  [.82, -.82].forEach(function (a) { petal(bl, { a: a, t: 1.12, w: .2, l: .86, r: .04, cup: .3, curl: .06, sh: .7, nu: 6, nv: 8 }); });
  var lip = new Geo();
  petal(lip, { a: PI, t: .95, w: .27, l: .64, r: .05, cup: .95, curl: .55, sh: .55, nu: 8, nv: 9 });
  for (var q = 6; q < lip.d.length; q += 7) lip.d[q] = 2 + lip.d[q] * .99;
  Array.prototype.push.apply(bl.d, lip.d);
  petal(bl, { a: 0, t: .5, w: .075, l: .38, r: .02, cup: 1.4, curl: .2, sh: .5, nu: 4, nv: 5, m: 4 });
  var bloomB = bl.upload();

  /* ---------- горшок, листья, стебель, бутоны: всё неподвижное одним буфером ---------- */
  var st = new Geo();
  st.surf(function (u, v) { var a = u * 2 * PI, y = -2.95 + v * 1.3, r = .6 + .3 * Math.pow(v, 1.4) + (v > .9 ? .05 : 0); return [Math.cos(a) * r, y, Math.sin(a) * r, 7 + v * .45]; }, 36, 10);
  st.surf(function (u, v) { var a = u * 2 * PI, b = v * 2 * PI; return [Math.cos(a) * (.93 + Math.cos(b) * .05), -1.65 + Math.sin(b) * .05, Math.sin(a) * (.93 + Math.cos(b) * .05), 7.45]; }, 36, 6);
  disc(st, .9, .05, 8, trans(0, -1.78, 0));
  function P(s) { return [2.0 * s * s - .1 * s, -1.75 + 4.6 * s - 1.6 * s * s, .35 * Math.sin(PI * s)]; }
  function T(s) { return norm([4 * s - .1, 4.6 - 3.2 * s, .35 * PI * Math.cos(PI * s)]); }
  for (var i = 0; i < 20; i++) tube(st, P(i / 20), P((i + 1) / 20), .06 - i * .0015, 5);
  [[-.5, .42, 2.6], [2.2, .38, 2.4], [-2.5, .5, 2.2], [.9, .3, 2.8], [3.7, .55, 2.0]].forEach(function (L) {
    var g2 = new Geo();
    petal(g2, { a: 0, t: L[1], w: .15, l: L[2], r: 0, cup: .3, curl: .42, sh: .9, nv: 14, nu: 4 });
    for (var k = 6; k < g2.d.length; k += 7) g2.d[k] = 6 + g2.d[k] * .45;
    var M = chain(trans(0, -1.75, 0), rotY(L[0]));
    for (var k2 = 0; k2 < g2.d.length; k2 += 7) {
      var x = g2.d[k2], y = g2.d[k2 + 1], z = g2.d[k2 + 2], nx = g2.d[k2 + 3], ny = g2.d[k2 + 4], nz = g2.d[k2 + 5];
      st.d.push(M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14],
        M[0] * nx + M[4] * ny + M[8] * nz, M[1] * nx + M[5] * ny + M[9] * nz, M[2] * nx + M[6] * ny + M[10] * nz, g2.d[k2 + 6]);
    }
  });
  var FL = [];
  for (i = 0; i < 9; i++) {
    var s = .4 + i * .075, p = P(s), t = T(s), side = i % 2 ? 1 : -1, n = norm(cross(t, [0, 0, 1]));
    if (i < 6) {
      var c = add(add(p, n, side * .42), [0, 0, 1], .22);
      tube(st, p, c, .03, 5);
      FL.push({ c: c, f: norm([n[0] * side * .35, n[1] * side * .35 + .05, 1]), u: norm(add([0, 1, 0], t, .35)), s: .64 - i * .028, k: .5 + i * .32 });
    } else {
      var r = .2 - (i - 6) * .035, bc = add(p, n, side * (.12 + r)), dirB = norm(add(n, t, side * .6));
      tube(st, p, bc, .025, 5);
      st.surf(function (u, v) { var a = u * 2 * PI, b = (v - .5) * PI; return [Math.cos(a) * Math.cos(b) * r * .62, Math.sin(b) * r * 1.25 + r, Math.sin(a) * Math.cos(b) * r * .62, 9 + v * .9]; }, 10, 8, chain(trans(bc[0], bc[1], bc[2]), frame(side > 0 ? dirB : [-dirB[0], -dirB[1], -dirB[2]], [0, 0, 1])));
    }
  }
  var plantB = st.upload();

  /* ---------- цвета: по нажатию меняется ---------- */
  var VAR = [
    { n: 'розовый', c1: [.98, .76, .85], c3: [.78, .12, .38] },
    { n: 'белый', c1: [.97, .97, .9], c3: [.82, .16, .26] },
    { n: 'лимонный', c1: [.98, .9, .56], c3: [.74, .2, .16] },
    { n: 'сиреневый', c1: [.86, .74, .94], c3: [.52, .12, .46] }
  ];
  var vi = 0, C1 = VAR[0].c1.slice(), C3 = VAR[0].c3.slice(), label = document.getElementById('orName');

  /* ---------- кадр ---------- */
  var W = 0, H = 0, live = true, last = 0, time = 0, mx = 0, my = 0, tmx = 0, tmy = 0, fade = 0, scr = 0, scrT = 0, open = 0;
  function resize() {
    var r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    gl.viewport(0, 0, W, H);
  }
  addEventListener('resize', function () { resize(); kick(); });
  if (matchMedia('(hover:hover)').matches) addEventListener('pointermove', function (e) { tmx = e.clientX / innerWidth - .5; tmy = e.clientY / innerHeight - .5; }, { passive: true });
  cv.addEventListener('click', function () {
    vi = (vi + 1) % VAR.length;
    if (label) label.textContent = VAR[vi].n;
    if (!reduce) open = Math.min(open, .2); else { C1 = VAR[vi].c1.slice(); C3 = VAR[vi].c3.slice(); kick(); }
  });

  function ease(x) { x = Math.max(0, Math.min(1, x)); return 1 - Math.pow(1 - x, 3); }
  function step(dt) {
    var k = 1 - Math.exp(-dt * 5), kc = 1 - Math.exp(-dt * 3);
    fade += (1 - fade) * kc;
    mx += (tmx - mx) * k; my += (tmy - my) * k; scr += (scrT - scr) * k;
    open = reduce ? 9 : open + dt;
    for (var j = 0; j < 3; j++) { C1[j] += (VAR[vi].c1[j] - C1[j]) * kc; C3[j] += (VAR[vi].c3[j] - C3[j]) * kc; }
  }
  function render() {
    if (!W) resize();
    var asp = W / H, d = 11.4 * Math.max(1, .8 / asp);
    var tg = [.7, -1.2, 0], eye = [tg[0], tg[1] + 1.4, d];
    var VP = mul(persp(.5, asp, 1, 80), lookAt(eye, tg));
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniform3f(U.uE, eye[0], eye[1], eye[2]); gl.uniform1f(U.uFade, fade);
    gl.uniform3fv(U.uC1, C1); gl.uniform3fv(U.uC3, C3);
    var still = reduce ? 0 : 1;
    var G = chain(trans(.35, -.2 + scr * .6, 0), rotY(-.25 + mx * .6 + still * Math.sin(time * .4) * .18 + scr * 1.6), rotX(my * .2), trans(-.35, 0, 0));
    draw(plantB, G);
    FL.forEach(function (f, i) {
      var e = ease((open - f.k * .55) / .9);
      if (e <= 0) return;
      var sw = still * Math.sin(time * 1.2 + i * 1.3) * .05;
      var sc = f.s * (.2 + .8 * e);
      draw(bloomB, chain(G, trans(f.c[0], f.c[1] + sw * .4, f.c[2]), frame(f.f, f.u), rotY(sw + (1 - e) * .8), scl(sc, sc, sc)));
    });
  }
  function frame_(now) {
    var dt = Math.min(.05, (now - last) / 1000 || .016); last = now; time += dt;
    step(dt); render();
    if (live) requestAnimationFrame(frame_);
  }
  var pending = false;
  function kick() {
    if (!reduce || pending) return; pending = true;
    requestAnimationFrame(function () { pending = false; step(.05); render(); });
  }
  window.OR = {
    scroll: function (p) { scrT = Math.max(0, Math.min(1, p)); kick(); },
    live: function (v) { if (reduce || v === live) return; live = v; if (v) { last = performance.now(); requestAnimationFrame(frame_); } }
  };
  resize();
  if (reduce) { live = false; fade = 1; open = 9; kick(); } else requestAnimationFrame(frame_);
})();
