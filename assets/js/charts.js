/* Lumigrid charts and savings calculator. Hand-built SVG, no dependencies.
   Series colours were checked with the dataviz palette validator on the white
   chart surface: amber #B87A0E and sky #0B7BC0 pass lightness, chroma, CVD and
   3:1 contrast. Charts sit on light cards only. */
(() => {
  const SOLAR = '#B87A0E';
  const SKY = '#0B7BC0';
  const INK = '#2b2d31';
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (s, el = document) => el.querySelector(s);

  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    if (parent) parent.append(n);
    return n;
  };
  const line = pts => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  // monotone-ish smoothing with Catmull-Rom → cubic Bézier
  const smooth = pts => {
    if (pts.length < 3) return line(pts);
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d;
  };
  const setLen = p => p.style.setProperty('--len', Math.ceil(p.getTotalLength()) + 1);

  /* Shared frame: grid, y ticks, x ticks, hover crosshair + tooltip */
  function frame(host, { W, H, pad, yMax, yTicks, yFmt, xs, xFmt, xTickEvery = 1 }) {
    host.innerHTML = '';
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' }, host);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const X = i => pad.l + (i / (xs.length - 1)) * iw;
    const Y = v => pad.t + ih - (v / yMax) * ih;
    const g = el('g', { class: 'grid' }, svg);
    const ax = el('g', { class: 'axis' }, svg);
    yTicks.forEach(v => {
      el('line', { x1: pad.l, x2: W - pad.r, y1: Y(v), y2: Y(v) }, g);
      const t = el('text', { x: pad.l - 10, y: Y(v) + 4, 'text-anchor': 'end' }, ax);
      t.textContent = yFmt(v);
    });
    xs.forEach((x, i) => {
      if (i % xTickEvery) return;
      const t = el('text', { x: X(i), y: H - pad.b + 22, 'text-anchor': 'middle' }, ax);
      t.textContent = xFmt(x);
    });
    return { svg, X, Y, iw, ih };
  }

  function hover(host, svg, { W, pad, H, n, X, render }) {
    const cursor = el('line', { class: 'chart-cursor', y1: pad.t, y2: H - pad.b }, svg);
    const dots = el('g', {}, svg);
    const tip = document.createElement('div');
    tip.className = 'chart-tip';
    host.append(tip);
    const hit = el('rect', { x: pad.l, y: 0, width: W - pad.l - pad.r, height: H, fill: 'transparent' }, svg);
    const move = e => {
      const r = svg.getBoundingClientRect();
      const sx = (e.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round(((sx - pad.l) / (W - pad.l - pad.r)) * (n - 1))));
      const x = X(i);
      cursor.setAttribute('x1', x); cursor.setAttribute('x2', x);
      cursor.classList.add('is-on');
      const { html, points } = render(i);
      dots.innerHTML = '';
      points.forEach(([y, c]) => el('circle', { cx: x, cy: y, r: 5, fill: c, stroke: '#fff', 'stroke-width': 2 }, dots));
      tip.innerHTML = html;
      tip.style.left = `${(x / W) * r.width}px`;
      tip.style.top = `${(Math.min(...points.map(p => p[0])) / svg.viewBox.baseVal.height) * r.height}px`;
      tip.classList.add('is-on');
    };
    hit.addEventListener('pointermove', move);
    hit.addEventListener('pointerleave', () => { tip.classList.remove('is-on'); cursor.classList.remove('is-on'); dots.innerHTML = ''; });
  }

  /* ------------------------------------------------------------------
     A day on a 5 kW hybrid system: solar generation vs household load,
     with load-shedding windows shaded; battery charge in its own chart.
     Illustrative profile for a Harare home in the dry season.
     ------------------------------------------------------------------ */
  function dayChart(host) {
    const hours = Array.from({ length: 49 }, (_, i) => i / 2);
    const solar = hours.map(h => 4.4 * Math.max(0, Math.sin(((h - 6.2) / 12) * Math.PI)) ** 1.15);
    const load = hours.map(h =>
      0.35 + 1.5 * Math.exp(-((h - 6.8) ** 2) / 1.4) + 0.75 * Math.exp(-((h - 13) ** 2) / 6) + 2.3 * Math.exp(-((h - 19.2) ** 2) / 2.6));
    const outages = [[5, 9], [17, 21]];
    // battery state of charge: simple energy balance on a 10 kWh pack
    const soc = [];
    let s = 0.55;
    hours.forEach((h, i) => {
      if (i) s = Math.min(1, Math.max(0.12, s + ((solar[i] - load[i]) * 0.5 * 0.92) / 10));
      soc.push(s * 100);
    });

    const W = Math.max(320, host.clientWidth), H = W < 600 ? 260 : 320, pad = { l: 48, r: 12, t: 18, b: 38 };
    const { svg, X, Y } = frame(host, {
      W, H, pad, yMax: 5, yTicks: [0, 1, 2, 3, 4, 5], yFmt: v => `${v} kW`,
      xs: hours, xFmt: h => `${String(h).padStart(2, '0')}:00`, xTickEvery: W < 600 ? 12 : 6,
    });
    svg.setAttribute('aria-label', 'Solar generation and household demand across 24 hours, with morning and evening load-shedding');
    const defs = el('defs', {}, svg);
    const hatch = el('pattern', { id: 'hatch', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 8, height: 8, fill: '#f6f4ef' }, hatch);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#ddd8ce', 'stroke-width': 3 }, hatch);
    const grad = el('linearGradient', { id: 'solar-fill', x1: 0, x2: 0, y1: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': SOLAR, 'stop-opacity': 0.32 }, grad);
    el('stop', { offset: 1, 'stop-color': SOLAR, 'stop-opacity': 0.02 }, grad);

    const bands = el('g', { class: 'fade' }, svg);
    svg.insertBefore(bands, svg.firstChild.nextSibling);
    outages.forEach(([a, b]) => {
      const x0 = X(a * 2), x1 = X(b * 2);
      el('rect', { x: x0, y: pad.t, width: x1 - x0, height: H - pad.t - pad.b, fill: 'url(#hatch)', rx: 4 }, bands);
      const t = el('text', { x: (x0 + x1) / 2, y: pad.t + 16, 'text-anchor': 'middle', fill: '#6c6f75', 'font-size': 11, 'font-family': 'Geist Mono, monospace' }, bands);
      t.textContent = 'Load-shedding';
    });

    const sp = hours.map((h, i) => [X(i), Y(solar[i])]);
    el('path', { d: `${smooth(sp)} L${X(hours.length - 1)} ${Y(0)} L${X(0)} ${Y(0)} Z`, fill: 'url(#solar-fill)', class: 'fade' }, svg);
    const ps = el('path', { d: smooth(sp), fill: 'none', stroke: SOLAR, 'stroke-width': 2.5, 'stroke-linecap': 'round', class: 'draw' }, svg);
    const pl = el('path', { d: smooth(hours.map((h, i) => [X(i), Y(load[i])])), fill: 'none', stroke: SKY, 'stroke-width': 2.5, 'stroke-linecap': 'round', class: 'draw' }, svg);
    setLen(ps); setLen(pl);

    // direct labels at the peaks
    const lab = (x, y, txt, c) => { const t = el('text', { x, y, fill: INK, 'font-size': 12, 'font-weight': 600, class: 'fade' }, svg); t.textContent = txt; el('circle', { cx: x - 10, cy: y - 4, r: 4, fill: c, class: 'fade' }, svg); };
    lab(X(31) + 4, Y(4) - 2, 'Solar generation', SOLAR);
    lab(X(39) + (W < 600 ? -60 : 18), Y(2.7) - 8, 'Home demand', SKY);

    hover(host, svg, {
      W, H, pad, n: hours.length, X,
      render: i => {
        const h = hours[i];
        const out = outages.some(([a, b]) => h >= a && h < b);
        return {
          html: `<b>${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}</b>${out ? ' · grid off' : ''}<br>Solar <b>${solar[i].toFixed(2)} kW</b><br>Demand <b>${load[i].toFixed(2)} kW</b><br>Battery <b>${Math.round(soc[i])}%</b>`,
          points: [[Y(solar[i]), SOLAR], [Y(load[i]), SKY]],
        };
      },
    });

    // battery chart — a second, aligned chart with its own 0–100% scale (no dual axis)
    const bh = $('[data-chart-soc]');
    if (bh) {
      const H2 = 150, pad2 = { l: 48, r: 12, t: 12, b: 34 };
      const f = frame(bh, { W, H: H2, pad: pad2, yMax: 100, yTicks: [0, 50, 100], yFmt: v => `${v}%`, xs: hours, xFmt: h => `${String(h).padStart(2, '0')}:00`, xTickEvery: W < 600 ? 12 : 6 });
      f.svg.setAttribute('aria-label', 'Battery state of charge across 24 hours');
      const p = el('path', { d: smooth(hours.map((h, i) => [f.X(i), f.Y(soc[i])])), fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round', class: 'draw' }, f.svg);
      setLen(p);
      hover(bh, f.svg, { W, H: H2, pad: pad2, n: hours.length, X: f.X, render: i => ({ html: `<b>${String(Math.floor(hours[i])).padStart(2, '0')}:${hours[i] % 1 ? '30' : '00'}</b><br>Battery <b>${Math.round(soc[i])}%</b>`, points: [[f.Y(soc[i]), INK]] }) });
    }

    const tbl = $('[data-table-day]');
    if (tbl) tbl.innerHTML = '<tr><th>Time</th><th>Solar (kW)</th><th>Demand (kW)</th><th>Battery</th></tr>' +
      hours.filter((_, i) => i % 4 === 0).map(h => { const i = h * 2; return `<tr><td>${String(h).padStart(2, '0')}:00</td><td>${solar[i].toFixed(2)}</td><td>${load[i].toFixed(2)}</td><td>${Math.round(soc[i])}%</td></tr>`; }).join('');
  }

  /* ------------------------------------------------------------------
     Savings calculator. All assumptions live here; adjust to match
     Lumigrid's current pricing before launch.
     ------------------------------------------------------------------ */
  const A = {
    gridPrice: 0.12,        // USD per kWh from the grid
    genPrice: 0.55,         // USD per kWh from a petrol/diesel generator (fuel only)
    sunHours: 5.6,          // Harare average peak sun hours per day
    perfRatio: 0.78,        // system losses
    escalate: 0.06,         // yearly rise in tariffs and fuel
    costPerKwp: 620,        // panels + mounting, USD per kWp (indicative)
    costPerKwh: 330,        // lithium storage, USD per kWh (indicative)
    costPerKva: 210,        // hybrid inverter, USD per kVA (indicative)
    install: 450,           // labour, protection and cabling (indicative)
    upkeep: 60,             // yearly cleaning and checks
    co2Grid: 0.65,          // kg CO2 per kWh, regional grid average
    co2Gen: 0.85,           // kg CO2 per kWh from a small generator
  };
  const NIGHT = { home: 0.45, business: 0.2, farm: 0.3 };

  function calc() {
    const form = $('[data-calc]');
    if (!form) return;
    const out = $('[data-calc-out]');
    const host = $('[data-chart-savings]');
    const fmt = (v, d = 0) => v.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });

    const update = () => {
      const bill = +form.bill.value, fuel = +form.fuel.value, shed = +form.shed.value;
      const type = form.type.value;
      [...form.querySelectorAll('input[type=range]')].forEach(r => {
        r.style.setProperty('--p', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);
        const o = form.querySelector(`output[for=${r.id}]`);
        if (o) o.textContent = r.dataset.prefix ? `${r.dataset.prefix}${fmt(+r.value)}` : `${r.value}${r.dataset.suffix || ''}`;
      });

      const gridKwh = bill / A.gridPrice, genKwh = fuel / A.genPrice;
      const daily = Math.max(4, (gridKwh + genKwh) / 30);
      const kwp = Math.max(1.5, Math.ceil((daily / (A.sunHours * A.perfRatio)) * 2) / 2);
      const kva = [3, 5, 8, 10, 12, 15, 20, 30, 50].find(k => k >= Math.max(kwp * 0.9, daily / 5)) || 50;
      const night = NIGHT[type] + (shed / 24) * 0.35;
      const kwh = Math.max(5, Math.ceil((daily * night) / 5) * 5);
      const cost = kwp * A.costPerKwp + kwh * A.costPerKwh + kva * A.costPerKva + A.install;

      const prod = kwp * A.sunHours * A.perfRatio * 30;
      const cover = Math.min(0.9, prod / (gridKwh + genKwh || 1));
      const monthly = bill * cover + fuel * Math.min(0.95, cover + 0.15);
      const years = Array.from({ length: 11 }, (_, y) => y);
      const without = [], withSolar = [];
      let a = 0, b = cost;
      years.forEach(y => {
        if (y) {
          const k = (1 + A.escalate) ** (y - 1);
          a += (bill + fuel) * 12 * k;
          b += (bill + fuel - monthly) * 12 * k + A.upkeep;
        }
        without.push(a); withSolar.push(b);
      });
      const crossIdx = years.findIndex(y => y > 0 && withSolar[y] <= without[y]);
      let payback = null;
      if (crossIdx > 0) {
        const y0 = crossIdx - 1;
        const d0 = withSolar[y0] - without[y0], d1 = withSolar[crossIdx] - without[crossIdx];
        payback = y0 + d0 / (d0 - d1);
      }
      const co2 = (gridKwh * cover * A.co2Grid + genKwh * Math.min(0.95, cover + 0.15) * A.co2Gen) * 12 / 1000;

      out.querySelector('[data-o=monthly]').textContent = fmt(monthly);
      out.querySelector('[data-o=size]').textContent = `${kva} kVA`;
      out.querySelector('[data-o=pv]').textContent = `${fmt(kwp, 1)} kWp`;
      out.querySelector('[data-o=batt]').textContent = `${kwh} kWh`;
      out.querySelector('[data-o=payback]').textContent = payback ? `${fmt(payback, 1)} yrs` : '10+ yrs';
      out.querySelector('[data-o=ten]').textContent = `$${fmt(Math.max(0, without[10] - withSolar[10]))}`;
      out.querySelector('[data-o=cost]').textContent = `$${fmt(Math.round(cost / 100) * 100)}`;
      out.querySelector('[data-o=co2]').textContent = `${fmt(co2, 1)} t`;
      const wa = $('[data-calc-wa]');
      if (wa) wa.href = `https://wa.me/263779056541?text=${encodeURIComponent(`Hi Lumigrid, I used your savings calculator (${type}). Monthly ZESA bill $${bill}, generator fuel $${fuel}, about ${shed}h of load-shedding a day. It suggested a ${kva} kVA system with ${kwh} kWh storage. Please send me a quote.`)}`;
      host._args = [years, without, withSolar, payback];
      savingsChart(host, ...host._args);
    };
    let rw = host.clientWidth;
    addEventListener('resize', () => { if (Math.abs(host.clientWidth - rw) > 30) { rw = host.clientWidth; savingsChart(host, ...host._args); } });
    form.addEventListener('input', update);
    form.addEventListener('submit', e => e.preventDefault());
    update();
  }

  function savingsChart(host, years, without, withSolar, payback) {
    if (!host) return;
    const max = Math.max(...without, ...withSolar);
    const step = [500, 1000, 2500, 5000, 10000, 25000, 50000, 100000].find(s => max / s <= 5) || 250000;
    const yMax = Math.ceil(max / step) * step;
    const W = Math.max(320, host.clientWidth), H = W < 600 ? 280 : 340, pad = { l: 52, r: 12, t: 20, b: 38 };
    const { svg, X, Y } = frame(host, {
      W, H, pad, yMax, yTicks: Array.from({ length: yMax / step + 1 }, (_, i) => i * step),
      yFmt: v => v >= 1000 ? `$${v / 1000}k` : `$${v}`, xs: years, xFmt: y => (y ? (W < 600 ? `${y}` : `Yr ${y}`) : 'Now'), xTickEvery: W < 600 ? 2 : 1,
    });
    svg.setAttribute('aria-label', 'Cumulative energy spending over ten years, with and without a Lumigrid system');
    const host2 = host.closest('.chart');
    const animate = !host._drawn;
    host._drawn = true;

    const pa = years.map((y, i) => [X(i), Y(without[i])]);
    const pb = years.map((y, i) => [X(i), Y(withSolar[i])]);
    // shaded savings area between the curves after payback
    const defs = el('defs', {}, svg);
    const grad = el('linearGradient', { id: 'save-fill', x1: 0, x2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': SOLAR, 'stop-opacity': 0.04 }, grad);
    el('stop', { offset: 1, 'stop-color': SOLAR, 'stop-opacity': 0.22 }, grad);
    el('path', { d: `${line(pa)} ${line([...pb].reverse()).replace('M', 'L')} Z`, fill: 'url(#save-fill)', class: animate ? 'fade' : '' }, svg);

    const l1 = el('path', { d: line(pa), fill: 'none', stroke: SKY, 'stroke-width': 2.5, 'stroke-linejoin': 'round', class: animate ? 'draw' : '' }, svg);
    const l2 = el('path', { d: line(pb), fill: 'none', stroke: SOLAR, 'stroke-width': 2.5, 'stroke-linejoin': 'round', class: animate ? 'draw' : '' }, svg);
    if (animate) { setLen(l1); setLen(l2); }
    [[pa, SKY], [pb, SOLAR]].forEach(([pts, c]) => pts.forEach(p => el('circle', { cx: p[0], cy: p[1], r: 4, fill: c, stroke: '#fff', 'stroke-width': 2 }, svg)));

    const lab = (p, txt, dy) => { const t = el('text', { x: p[0] - 6, y: p[1] + dy, 'text-anchor': 'end', fill: INK, 'font-size': 12, 'font-weight': 600 }, svg); t.textContent = txt; };
    lab(pa[10], 'Without solar', -12);
    lab(pb[10], 'With Lumigrid', 22);

    if (payback && payback <= 10) {
      const x = X(payback);
      const yv = without[Math.floor(payback)] + (without[Math.ceil(payback)] - without[Math.floor(payback)]) * (payback % 1);
      el('line', { x1: x, x2: x, y1: Y(yv), y2: H - pad.b, stroke: INK, 'stroke-dasharray': '3 4' }, svg);
      const g = el('g', { transform: `translate(${x} ${Y(yv) - 16})` }, svg);
      el('rect', { x: -52, y: -16, width: 104, height: 24, rx: 12, fill: INK }, g);
      const t = el('text', { x: 0, y: 0, 'text-anchor': 'middle', fill: '#fff', 'font-size': 11, 'font-weight': 600 }, g);
      t.textContent = `Break-even · ${payback.toFixed(1)} yrs`;
    }
    const usd = v => `$${Math.round(v).toLocaleString('en-US')}`;
    hover(host, svg, {
      W, H, pad, n: years.length, X,
      render: i => ({
        html: `<b>${i ? `Year ${i}` : 'Today'}</b><br>Without solar <b>${usd(without[i])}</b><br>With Lumigrid <b>${usd(withSolar[i])}</b>${without[i] > withSolar[i] ? `<br>Saved <b>${usd(without[i] - withSolar[i])}</b>` : ''}`,
        points: [[Y(without[i]), SKY], [Y(withSolar[i]), SOLAR]],
      }),
    });
    if (host2 && !animate) host2.classList.add('is-in');
    const tbl = $('[data-table-savings]');
    if (tbl) tbl.innerHTML = '<tr><th>Year</th><th>Without solar</th><th>With Lumigrid</th></tr>' + years.map(y => `<tr><td>${y || 'Today'}</td><td>${usd(without[y])}</td><td>${usd(withSolar[y])}</td></tr>`).join('');
  }

  document.querySelectorAll('[data-chart-day]').forEach(h => {
    dayChart(h);
    let rw = h.clientWidth;
    addEventListener('resize', () => { if (Math.abs(h.clientWidth - rw) > 30) { rw = h.clientWidth; dayChart(h); h.closest('.chart').classList.add('is-in'); $('[data-chart-soc]')?.closest('.chart').classList.add('is-in'); } });
  });
  calc();
})();
