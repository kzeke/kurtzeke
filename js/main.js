(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined';
  const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: .5, ny: .5, vx: 0, vy: 0 };
  let scrollP = 0, previewOn = false;


  /* ---------- copy email ---------- */
  const copyBtn = document.getElementById('copyEmail'), emailText = document.getElementById('emailText');
  copyBtn.addEventListener('click', () => {
    const done = () => { copyBtn.textContent = 'Copied'; setTimeout(() => copyBtn.textContent = 'Copy', 1800); };
    const fallback = () => { const r = document.createRange(); r.selectNodeContents(emailText); const s = getSelection(); s.removeAllRanges(); s.addRange(r); copyBtn.textContent = 'Selected, press Ctrl+C'; setTimeout(() => copyBtn.textContent = 'Copy', 2400); };
    try { navigator.clipboard.writeText(emailText.textContent).then(done, fallback); } catch (e) { fallback(); }
  });

  /* ---------- mouse ---------- */
  addEventListener('pointermove', e => {
    mouse.vx = e.clientX - mouse.x; mouse.vy = e.clientY - mouse.y;
    mouse.x = e.clientX; mouse.y = e.clientY;
    mouse.nx = e.clientX / innerWidth; mouse.ny = e.clientY / innerHeight;
  }, { passive: true });
  addEventListener('scroll', () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollP = max > 0 ? scrollY / max : 0;
  }, { passive: true });

  /* ---------- WebGL gradient field ---------- */
  const field = document.getElementById('field');
  const gl = field.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  let drawField = () => {};
  if (gl) {
    const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fs = `precision highp float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uMouse;uniform float uScroll;uniform float uVel;
vec3 ink=vec3(0.,0.,.2);vec3 cobalt=vec3(0.,.4,.8);vec3 azure=vec3(0.,.6,1.);vec3 mist=vec3(.93);
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*n(p);p=r*p*2.02;a*=.5;}return v;}
void main(){
  vec2 uv=gl_FragCoord.xy/uRes;float asp=uRes.x/uRes.y;
  vec2 p=vec2(uv.x*asp,uv.y);vec2 m=vec2(uMouse.x*asp,1.-uMouse.y);
  float d=distance(p,m);
  float lens=exp(-d*d*9.);
  p+=(p-m)*lens*(.22+uVel*.5);
  p+=vec2(sin(d*24.-uTime*2.4),cos(d*24.-uTime*2.4))*lens*.018*(1.+uVel*4.);
  float t=uTime*.06;
  vec2 q=vec2(fbm(p*1.4+t),fbm(p*1.4-t+3.1));
  vec2 r=vec2(fbm(p*1.7+q*1.9+vec2(1.7,9.2)+t*1.3),fbm(p*1.7+q*1.9+vec2(8.3,2.8)-t));
  float f=fbm(p*1.2+r*1.6+uScroll*1.5);
  vec3 col=mix(ink,cobalt,smoothstep(.38,.78,f));
  col=mix(col,azure,smoothstep(.62,.95,f)*.7);
  col+=mist*smoothstep(.86,1.05,f)*.18;
  col+=azure*lens*.12;
  float vig=smoothstep(1.25,.25,length((uv-vec2(.62,.62))*vec2(1.,1.15)));
  col=mix(ink*.55,col,vig*(1.-uScroll*.55));
  col*=mix(1.,.6,smoothstep(.55,0.,uv.y)*smoothstep(.75,.1,uv.x));
  col+=(h(gl_FragCoord.xy+fract(uTime))-.5)*.035;
  gl_FragColor=vec4(col,1.);
}`;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr);
    if (gl.getProgramParameter(pr, gl.LINK_STATUS)) {
      gl.useProgram(pr);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = n => gl.getUniformLocation(pr, n);
      const uRes = U('uRes'), uTime = U('uTime'), uMouse = U('uMouse'), uScroll = U('uScroll'), uVel = U('uVel');
      const sm = { x: .5, y: .5, v: 0, s: 0 };
      const size = () => { const dpr = Math.min(devicePixelRatio || 1, 1.5) * .6; field.width = Math.round(innerWidth * dpr); field.height = Math.round(innerHeight * dpr); gl.viewport(0, 0, field.width, field.height); };
      size(); addEventListener('resize', size);
      drawField = (t) => {
        sm.x += (mouse.nx - sm.x) * .06; sm.y += (mouse.ny - sm.y) * .06;
        const sp = Math.min(Math.hypot(mouse.vx, mouse.vy) / 60, 1); sm.v += (sp - sm.v) * .08;
        sm.s += (scrollP - sm.s) * .08;
        gl.uniform2f(uRes, field.width, field.height); gl.uniform1f(uTime, t * .001);
        gl.uniform2f(uMouse, sm.x, sm.y); gl.uniform1f(uScroll, sm.s); gl.uniform1f(uVel, sm.v);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
    }
  } else {
    field.style.background = 'radial-gradient(80% 60% at 70% 30%, #0066CC 0%, #000033 70%)';
  }

  /* ---------- particle dust ---------- */
  const dust = document.getElementById('dust');
  const ctx = dust.getContext('2d');
  let parts = [], dpr2 = 1;
  const makeDust = () => {
    dpr2 = Math.min(devicePixelRatio || 1, 2);
    dust.width = innerWidth * dpr2; dust.height = innerHeight * dpr2;
    const count = Math.round(Math.min(140, innerWidth * innerHeight / 9000));
    parts = Array.from({ length: count }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight,
      z: Math.random() * .9 + .1, vx: (Math.random() - .5) * .15, vy: -Math.random() * .25 - .05,
      ox: 0, oy: 0
    }));
  };
  makeDust(); addEventListener('resize', makeDust);
  let lastScroll = scrollY;
  const drawDust = () => {
    const ds = scrollY - lastScroll; lastScroll = scrollY;
    ctx.setTransform(dpr2, 0, 0, dpr2, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.x += p.vx * p.z; p.y += p.vy * p.z - ds * p.z * .25;
      const dx = p.x + p.ox - mouse.x, dy = p.y + p.oy - mouse.y, dd = Math.hypot(dx, dy);
      if (dd < 140 && dd > 0 && fine) { const f = (140 - dd) / 140; p.ox += dx / dd * f * 3; p.oy += dy / dd * f * 3; }
      p.ox *= .93; p.oy *= .93;
      if (p.y < -10) p.y = innerHeight + 10; if (p.y > innerHeight + 10) p.y = -10;
      if (p.x < -10) p.x = innerWidth + 10; if (p.x > innerWidth + 10) p.x = -10;
    }
    ctx.lineWidth = .6;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i], ax = a.x + a.ox, ay = a.y + a.oy;
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j], bx = b.x + b.ox, by = b.y + b.oy;
        const d = (ax - bx) ** 2 + (ay - by) ** 2;
        if (d < 9000) { ctx.strokeStyle = `rgba(0,153,255,${(1 - d / 9000) * .22})`; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
      }
      ctx.fillStyle = a.z > .7 ? `rgba(237,237,237,${.5 + a.z * .4})` : `rgba(0,153,255,${.4 + a.z * .5})`;
      ctx.beginPath(); ctx.arc(ax, ay, a.z * 1.8 + .3, 0, 6.283); ctx.fill();
    }
  };

  /* ---------- SVG distortion driven by cursor speed ---------- */
  const titleMap = document.getElementById('titleMap'), titleNoise = document.getElementById('titleNoise');
  const warpMap = document.getElementById('warpMap'), warpNoise = document.getElementById('warpNoise');
  const heroTitle = document.getElementById('heroTitle');
  let tScale = 0, wScale = 0, hoverTitle = false;
  heroTitle.addEventListener('pointerenter', () => { hoverTitle = true; heroTitle.style.filter = 'url(#titleWarp)'; });
  heroTitle.addEventListener('pointerleave', () => { hoverTitle = false; });

  /* ---------- main loop ---------- */
  let running = true;
  document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) requestAnimationFrame(loop); });
  function loop(t) {
    if (!running) return;
    drawField(t); drawDust();
    const speed = Math.min(Math.hypot(mouse.vx, mouse.vy), 80);
    const tgt = hoverTitle ? Math.min(4 + speed * .35, 26) : 0;
    tScale += (tgt - tScale) * .12;
    titleMap.setAttribute('scale', tScale.toFixed(2));
    titleNoise.setAttribute('baseFrequency', `0.004 ${(0.05 + Math.sin(t * .002) * .02).toFixed(4)}`);
    if (!hoverTitle && tScale < .2 && heroTitle.style.filter) heroTitle.style.filter = '';
    wScale += ((previewOn ? Math.min(3 + speed * .35, 24) : 0) - wScale) * .14;
    warpMap.setAttribute('scale', wScale.toFixed(2));
    warpNoise.setAttribute('baseFrequency', `0.012 ${(0.03 + Math.sin(t * .003) * .01).toFixed(4)}`);
    mouse.vx *= .85; mouse.vy *= .85;
    requestAnimationFrame(loop);
  }

  /* ---------- custom cursor + magnetic ---------- */
  const cur = document.getElementById('cursor'), dot = document.getElementById('cursorDot');
  if (fine) {
    document.body.classList.add('has-cursor');
    let cx = mouse.x, cy = mouse.y;
    const follow = () => { cx += (mouse.x - cx) * .18; cy += (mouse.y - cy) * .18; cur.style.transform = `translate(${cx}px,${cy}px)`; dot.style.transform = `translate(${mouse.x}px,${mouse.y}px)`; requestAnimationFrame(follow); };
    follow();
    if (!reduce) document.querySelectorAll('.magnetic').forEach(el => {
      el.addEventListener('pointermove', e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .15}px,${(e.clientY - r.top - r.height / 2) * .2}px)`; });
      el.addEventListener('pointerleave', () => { el.style.transition = 'transform .6s cubic-bezier(.16,1,.3,1)'; el.style.transform = ''; setTimeout(() => el.style.transition = '', 600); });
    });
  }


  /* ---------- hero photo: WebGL hover distortion ---------- */
  (() => {
    const fig = document.getElementById('heroPhoto'), img = document.getElementById('photoImg'), cv = document.getElementById('photoGL');
    if (reduce) return;
    const g = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!g) return;
    const vs = 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}';
    const fs = `precision mediump float;varying vec2 v;uniform sampler2D t;uniform vec2 m;uniform float hv,tm,vel;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
void main(){
  vec2 uv=v;vec2 dl=uv-m;float d=length(dl*vec2(1.,1.34));
  float w=hv*smoothstep(.5,0.,d);
  float nz=n(uv*7.+tm*.9)-.5;
  uv+=vec2(nz*.035,0.)*w;
  float slice=floor(uv.y*26.);float tk=floor(tm*9.);
  float band=step(.88,h(vec2(slice,tk)))*hv;
  uv.x+=band*(h(vec2(tk,slice))-.5)*.08;
  vec2 off=vec2(.006+vel*.03,0.)*(w+band);
  vec4 r=texture2D(t,uv+off),gg=texture2D(t,uv),b=texture2D(t,uv-off);
  vec4 c=vec4(r.r,gg.g,b.b,max(max(r.a,gg.a),b.a));
  c.rgb+=vec3(0.,.12,.32)*(w*.6+band*.5)*c.a;
  gl_FragColor=c;
}`;
    const mk = (ty, s) => { const o = g.createShader(ty); g.shaderSource(o, s); g.compileShader(o); return o; };
    const pr = g.createProgram(); g.attachShader(pr, mk(g.VERTEX_SHADER, vs)); g.attachShader(pr, mk(g.FRAGMENT_SHADER, fs)); g.linkProgram(pr);
    if (!g.getProgramParameter(pr, g.LINK_STATUS)) return;
    g.useProgram(pr);
    const buf = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), g.STATIC_DRAW);
    const loc = g.getAttribLocation(pr, 'p'); g.enableVertexAttribArray(loc); g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0);
    const uM = g.getUniformLocation(pr, 'm'), uH = g.getUniformLocation(pr, 'hv'), uT = g.getUniformLocation(pr, 'tm'), uV = g.getUniformLocation(pr, 'vel');
    const st = { tx: .5, ty: .5, x: .5, y: .5, target: 0, hv: 0, vel: 0, lx: 0, ly: 0, raf: 0, ready: false };
    const size = () => { const r = fig.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2); cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round(r.height * dpr)); g.viewport(0, 0, cv.width, cv.height); draw(performance.now()); };
    const draw = (now) => {
      if (!st.ready) return;
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      g.uniform2f(uM, st.x, st.y); g.uniform1f(uH, st.hv); g.uniform1f(uT, now * .001); g.uniform1f(uV, st.vel);
      g.drawArrays(g.TRIANGLES, 0, 6);
    };
    const frame = (now) => {
      st.hv += (st.target - st.hv) * .08; st.x += (st.tx - st.x) * .15; st.y += (st.ty - st.y) * .15; st.vel *= .9;
      draw(now);
      if (st.target > 0 || st.hv > .002) st.raf = requestAnimationFrame(frame); else { st.hv = 0; st.raf = 0; draw(now); }
    };
    const kick = () => { if (!st.raf) st.raf = requestAnimationFrame(frame); };
    const local = e => { const r = fig.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
    fig.addEventListener('pointerenter', e => { [st.tx, st.ty] = local(e); st.x = st.tx; st.y = st.ty; st.target = 1; kick(); });
    fig.addEventListener('pointermove', e => { const [x, y] = local(e); st.vel = Math.min(st.vel + Math.hypot(x - st.tx, y - st.ty) * 2, 1); st.tx = x; st.ty = y; st.target = 1; kick(); });
    fig.addEventListener('pointerleave', () => { st.target = 0; kick(); });
    const upload = () => {
      const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
      g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      // Opened straight from disk (file://), browsers block reading the image into WebGL.
      // The plain photo stays visible; the hover effect works once the site is on a web server.
      try { g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, img); } catch (err) { return; }
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      st.ready = true; cv.hidden = false; img.style.visibility = 'hidden'; size();
    };
    (img.decode ? img.decode() : Promise.resolve()).then(upload, () => img.complete && upload());
    addEventListener('resize', size);
  })();

  /* ---------- glass card spotlight ---------- */
  document.querySelectorAll('.card').forEach(c => c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }));

  /* ---------- work hover preview ---------- */
  const preview = document.getElementById('preview'), pHero = document.getElementById('previewHero'), pLabel = document.getElementById('previewLabel');
  if (fine) {
    if (hasGsap) gsap.set(preview, { xPercent: -50, yPercent: -50, scale: .6 }); else preview.style.transform = 'translate(-50%,-50%)';
    let px = mouse.x, py = mouse.y;
    const movePrev = () => { px += (mouse.x - px) * .12; py += (mouse.y - py) * .12; const rot = Math.max(-12, Math.min(12, mouse.vx * .4)); preview.style.left = px + 'px'; preview.style.top = py + 'px'; preview.style.rotate = rot + 'deg'; requestAnimationFrame(movePrev); };
    movePrev();
  }

  /* ---------- cursor + preview state: read from what is actually under the pointer ---------- */
  if (fine) {
    const label = cur.querySelector('.cursor__label');
    const INTERACTIVE = 'a,button,.chip,input,textarea,select,label';
    let row = null, inter = false, inside = false, queued = false;
    const showPreview = r => {
      const [a, b] = r.dataset.hue.split(',');
      pHero.style.background = `linear-gradient(135deg, ${a}, ${b})`;
      pLabel.textContent = r.dataset.label;
      label.textContent = r.querySelector('a').target === '_blank' ? 'Visit' : 'Ask';
      previewOn = true; cur.classList.add('is-view');
      if (hasGsap) gsap.to(preview, { opacity: 1, scale: 1, duration: .5, ease: 'expo.out', overwrite: true }); else preview.style.opacity = 1;
    };
    const hidePreview = () => {
      previewOn = false; cur.classList.remove('is-view');
      if (hasGsap) gsap.to(preview, { opacity: 0, scale: .6, duration: .3, ease: 'expo.in', overwrite: true }); else preview.style.opacity = 0;
    };
    const sync = () => {
      queued = false;
      const el = inside ? document.elementFromPoint(mouse.x, mouse.y) : null;
      const r = el ? el.closest('.work__row') : null;
      const i = !!(el && !r && el.closest(INTERACTIVE));
      if (i !== inter) { inter = i; cur.classList.toggle('is-hover', i); }
      if (r !== row) { row = r; r ? showPreview(r) : hidePreview(); }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(sync); } };
    addEventListener('pointermove', () => { inside = true; queue(); }, { passive: true });
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', queue);
    const leave = () => { inside = false; cur.style.opacity = dot.style.opacity = 0; queue(); };
    document.documentElement.addEventListener('pointerleave', leave);
    document.addEventListener('mouseout', e => { if (!e.relatedTarget) leave(); });
    addEventListener('blur', leave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) leave(); });
    addEventListener('pointermove', () => { cur.style.opacity = dot.style.opacity = ''; }, { passive: true });
  }

  /* ---------- marquee duplicate ---------- */
  const mq = document.getElementById('marquee');
  const star = '<svg class="marquee__star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/></svg>';
  [...mq.children].forEach(el => el.insertAdjacentHTML('beforeend', star));
  [...mq.children].forEach(el => { const c = el.cloneNode(true); c.setAttribute('aria-hidden', 'true'); mq.appendChild(c); });

  /* ---------- split hero title ---------- */
  const chars = [];
  document.querySelectorAll('[data-split]').forEach(el => {
    const txt = el.textContent; el.setAttribute('aria-label', txt); el.textContent = '';
    [...txt].forEach(ch => { const s = document.createElement('span'); s.className = 'char'; s.setAttribute('aria-hidden', 'true'); s.textContent = ch === ' ' ? ' ' : ch; el.appendChild(s); chars.push(s); });
  });

  /* ---------- manifesto words ---------- */
  const man = document.getElementById('manifesto');
  const wrapWords = node => {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) frag.append(w); else { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; frag.append(s); } });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) wrapWords(n);
    });
  };
  wrapWords(man);

  /* ---------- form ---------- */
  const form = document.getElementById('contactForm');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = form.elements.name, email = form.elements.email;
    const nameOk = !!name.value.trim(), emailOk = /^\S+@\S+\.\S+$/.test(email.value);
    document.getElementById('e-name').textContent = nameOk ? '' : 'Add your name so I know who to reply to.';
    document.getElementById('e-email').textContent = emailOk ? '' : 'Enter an email like jane@company.com.';
    name.setAttribute('aria-invalid', String(!nameOk)); email.setAttribute('aria-invalid', String(!emailOk));
    const status = document.getElementById('formStatus');
    if (!nameOk || !emailOk) { status.textContent = ''; (nameOk ? email : name).focus(); return; }
    status.textContent = `Thanks, ${name.value.trim().split(' ')[0]}. Your enquiry is ready to send.`;
    form.reset(); document.getElementById('need-site').checked = true;
  });

  /* ---------- smooth in-page scrolling ---------- */
  let scrollAnim = 0;
  const cancelScroll = () => { if (scrollAnim) { cancelAnimationFrame(scrollAnim); scrollAnim = 0; } };
  ['wheel', 'touchstart', 'keydown'].forEach(ev => addEventListener(ev, cancelScroll, { passive: true }));
  const smoothTo = (y, done) => {
    cancelScroll();
    if (reduce) { scrollTo(0, y); done && done(); return; }
    const start = scrollY, dist = y - start, dur = Math.min(1800, 700 + Math.abs(dist) * .18), t0 = performance.now();
    const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const step = now => { const k = Math.min((now - t0) / dur, 1); scrollTo(0, start + dist * ease(k)); if (k < 1) scrollAnim = requestAnimationFrame(step); else { scrollAnim = 0; done && done(); } };
    scrollAnim = requestAnimationFrame(step);
  };
  document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1); const target = id === 'top' ? null : document.getElementById(id);
    if (id !== 'top' && !target) return;
    e.preventDefault();
    const y = target ? target.getBoundingClientRect().top + scrollY - 24 : 0;
    smoothTo(Math.max(0, y), () => { const f = target || document.getElementById('heroTitle'); f.setAttribute('tabindex', '-1'); f.focus({ preventScroll: true }); });
  }));



  /* ---------- GSAP choreography ---------- */
  const loader = document.getElementById('loader');
  if (!hasGsap || reduce) {
    loader.remove();
    document.querySelectorAll('.manifesto .w').forEach(w => w.style.opacity = 1);
    if (!reduce) requestAnimationFrame(loop); else { drawField(0); drawDust(); }
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  requestAnimationFrame(loop);

  const count = { v: 0 }, cEl = document.getElementById('loaderCount');
  const intro = gsap.timeline({ defaults: { ease: 'expo.inOut' } });
  intro.to(count, { v: 100, duration: 1.1, ease: 'power2.inOut', onUpdate: () => cEl.textContent = Math.round(count.v) })
       .to('#loaderBar', { scaleX: 1, duration: 1.1, ease: 'power2.inOut' }, 0)
       .to(loader, { yPercent: -100, duration: .9 }, '+=.1')
       .set(loader, { display: 'none' })
       .from(chars, { yPercent: 115, rotate: 8, duration: 1.1, stagger: .022, ease: 'expo.out' }, '-=.45')
       .from('.hero__meta > *, .hero__lede, .hero__ctas > *, .scroll-cue', { y: 24, opacity: 0, duration: .9, stagger: .06, ease: 'expo.out' }, '-=.8')
       .from('#heroPhoto', { y: 60, opacity: 0, scale: .94, duration: 1.3, ease: 'expo.out' }, '<');

  gsap.to('.hero__title', { yPercent: -18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  const skewTo = gsap.quickTo('#marquee', 'skewX', { duration: .5, ease: 'power3' });
  ScrollTrigger.create({ onUpdate: s => skewTo(gsap.utils.clamp(-12, 12, s.getVelocity() / -250)) });

  gsap.to('.manifesto .w', { opacity: 1, stagger: .08, ease: 'none', scrollTrigger: { trigger: man, start: 'top 80%', end: 'bottom 45%', scrub: true } });

  gsap.utils.toArray('.sec__head, .perf__copy, .perf__panel, .contact__lead p, .contact__mail, .form-panel').forEach(el => {
    gsap.from(el, { y: 50, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  gsap.from('.about-grid > *', { y: 60, opacity: 0, duration: 1.1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.about-grid', start: 'top 85%', once: true } });
  gsap.from('.work__row, .also', { y: 40, opacity: 0, duration: 1, stagger: .07, ease: 'expo.out', scrollTrigger: { trigger: '#workList', start: 'top 85%', once: true } });
  gsap.from('.card', { y: 60, opacity: 0, duration: 1.1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '.svc', start: 'top 85%', once: true } });
  gsap.from('.contact__big span', { yPercent: 60, opacity: 0, duration: 1.2, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: '.contact__big', start: 'top 85%', once: true } });

  document.querySelectorAll('[data-count]').forEach((el, i) => {
    const end = +el.dataset.count, suffix = el.textContent.replace(/[0-9]/g, ''), o = { v: 0 };
    el.textContent = '0' + suffix;
    gsap.to(o, { v: end, duration: 2.2, delay: .35 + i * .12, ease: 'power2.out', scrollTrigger: { trigger: '.facts', start: 'top 78%', once: true },
      onUpdate: () => el.textContent = Math.round(o.v) + suffix, onComplete: () => el.textContent = end + suffix });
  });

  const C = 2 * Math.PI * 52;
  document.querySelectorAll('.gauge__val').forEach(c => {
    c.style.strokeDasharray = C; c.style.strokeDashoffset = C * (1 - c.dataset.val / 100);
    gsap.from(c, { strokeDashoffset: C, duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: '#gauges', start: 'top 85%', once: true } });
  });

  const mm = gsap.matchMedia();
  mm.add('(min-width: 1000px)', () => {
    const sec = document.getElementById('process'), track = document.getElementById('procTrack');
    sec.classList.add('is-pinned');
    const dist = () => Math.max(0, track.scrollWidth - track.parentElement.clientWidth);
    const tw = gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true } });
    gsap.to('#procBar', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), scrub: true } });
    gsap.utils.toArray('.step').forEach(s => gsap.from(s.querySelector('.step__n'), { yPercent: 40, opacity: 0, ease: 'none', scrollTrigger: { trigger: s, containerAnimation: tw, start: 'left 95%', end: 'left 55%', scrub: true } }));
    return () => sec.classList.remove('is-pinned');
  });
  mm.add('(max-width: 999px)', () => {
    gsap.from('.step', { y: 50, opacity: 0, duration: 1, stagger: .1, ease: 'expo.out', scrollTrigger: { trigger: '#procTrack', start: 'top 85%', once: true } });
  });
  addEventListener('load', () => ScrollTrigger.refresh());
})();
