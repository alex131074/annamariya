/* Поведение страницы: открыто ли сейчас, орхидея на прокрутке, конструктор букета, появление блоков, отзывы, форма, панель на телефоне. */
(function () {
  var WA = 'https://wa.me/73812503809';
  var TEL = '<a href="tel:+79088002859">+7 (908) 800-28-59</a> или напишите в <a href="' + WA + '" target="_blank" rel="noopener">WhatsApp</a>';
  var FORM_ENDPOINT = ''; /* {{адрес приёма заявок}} */
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(id) { return document.getElementById(id); }
  var hero = $('hero'), bar = $('bar'), contacts = $('contacts');

  /* Время в Омске (UTC+6): Пн–Сб 9:00–21:00, Вс 10:00–20:00 */
  var d = new Date(Date.now() + 6 * 3600000), h = d.getUTCHours() + d.getUTCMinutes() / 60, day = d.getUTCDay();
  var from = day === 0 ? 10 : 9, to = day === 0 ? 20 : 21, open = h >= from && h < to, now = $('now');
  now.textContent = open ? 'Сейчас открыто' : (h < from ? 'Откроемся в ' + from + ':00' : 'Завтра с ' + (day === 6 ? 10 : 9) + ':00');
  now.classList.toggle('off', !open);
  now.hidden = false;

  /* Конструктор букета */
  var stems = document.querySelectorAll('#stems li'), dots = $('bqDots'), list = [];
  var RB = ['#f7a1c4', '#a8d8f0', '#fde68a', '#c4b5fd', '#a7f3d0', '#fdba74'];
  var SIZE = { 1350: 17, 590: 12, 330: 11, 320: 11, 120: 8, 290: 10, 380: 7 };
  function plural(n) { var a = n % 10, b = n % 100; return n + ' ' + (a === 1 && b !== 11 ? 'ветка' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'ветки' : 'веток'); }
  function money(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function layout() {
    var n = list.length, k = Math.min(1, Math.sqrt(40 / Math.max(n, 1)));
    list.forEach(function (o, i) {
      var r = 15 * Math.sqrt(i + .5) * k, t = i * 2.39996;
      o.el.setAttribute('cx', (Math.cos(t) * r).toFixed(1));
      o.el.setAttribute('cy', (0 + Math.sin(t) * r * .78).toFixed(1));
      o.el.setAttribute('r', (o.s * 1.5 * (.6 + .4 * k)).toFixed(1));
    });
  }
  function update() {
    var sum = 0, n = 0, lines = [];
    stems.forEach(function (li) {
      var q = +li.dataset.q || 0, sp = li.querySelector('span'), sm = sp.querySelector('small');
      var name = (sp.firstChild.textContent + (sm ? ', ' + sm.textContent : '')).replace(/\s+/g, ' ').trim();
      li.querySelector('output').textContent = q;
      li.classList.toggle('has', q > 0);
      if (q) { sum += q * +li.dataset.p; n += q; lines.push('– ' + name + ' × ' + q); }
    });
    $('bqSum').textContent = money(sum);
    $('bqN').textContent = plural(n);
    $('bqEmpty').hidden = n > 0;
    var send = $('bqSend');
    send.classList.toggle('off', !n);
    send.setAttribute('aria-disabled', !n);
    send.href = WA + (n ? '?text=' + encodeURIComponent('Здравствуйте! Хочу собрать букет:\n' + lines.join('\n') + '\nЦветы на сумму ' + sum + ' ₽ по ценам с сайта. Подскажите, всё ли есть в наличии и сколько будет стоить упаковка?') : '');
    layout();
  }
  stems.forEach(function (li) {
    var b = li.querySelectorAll('button');
    b[1].addEventListener('click', function () {
      li.dataset.q = (+li.dataset.q || 0) + 1;
      var c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      var col = li.dataset.c === 'rainbow' ? RB[list.length % RB.length] : li.dataset.c;
      c.setAttribute('fill', col); c.setAttribute('stroke', 'rgba(58,30,45,.18)'); c.setAttribute('stroke-width', '1');
      dots.appendChild(c); list.push({ li: li, el: c, s: SIZE[li.dataset.p] || 10 });
      update();
    });
    b[0].addEventListener('click', function () {
      if (!(+li.dataset.q)) return;
      li.dataset.q = +li.dataset.q - 1;
      for (var i = list.length - 1; i >= 0; i--) if (list[i].li === li) { dots.removeChild(list[i].el); list.splice(i, 1); break; }
      update();
    });
  });
  $('bqClear').addEventListener('click', function () { stems.forEach(function (li) { li.dataset.q = 0; }); list.forEach(function (o) { dots.removeChild(o.el); }); list = []; update(); });
  update();

  function onScroll() {
    var H = innerHeight, hr = hero.getBoundingClientRect(), cr = contacts.getBoundingClientRect();
    if (window.OR) { OR.live(hr.bottom > 0); OR.scroll(-hr.top / Math.max(1, hr.height)); }
    bar.classList.toggle('on', hr.bottom < H * .3 && cr.top > H * .6);
  }
  var ticking = false;
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(function () { ticking = false; onScroll(); }); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  if (!reduce && 'IntersectionObserver' in window) {
    var rise = document.querySelectorAll('.sec h2,.sec .sub,.sec-h .pull,.exh,.stems,.bq-card,.cat-c,.steps li,.strip figure,.gifts-f,.gl li,.ex,.score,.rev-g:not(.rev-more) .rev,.maplink,.form');
    rise.forEach(function (el) { el.classList.add('rise'); });
    var seen = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); seen.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rise.forEach(function (el) { seen.observe(el); });
  }

  var more = $('revMore'), btn = $('revBtn');
  btn.addEventListener('click', function () {
    var o = more.classList.toggle('open');
    btn.setAttribute('aria-expanded', o);
    btn.textContent = o ? 'Свернуть отзывы' : 'Показать ещё отзывы';
  });

  var form = $('form'), msg = $('formMsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ph = form.elements.phone, ok = ph.value.replace(/\D/g, '').length >= 10;
    ph.classList.toggle('invalid', !ok);
    if (!ok) { msg.textContent = 'Укажите телефон, чтобы мы могли связаться.'; ph.focus(); return; }
    if (!FORM_ENDPOINT) { msg.innerHTML = 'Заявки с сайта пока не подключены, поэтому ваш номер не отправлен. Позвоните: ' + TEL; return; }
    fetch(FORM_ENDPOINT, { method: 'POST', body: new FormData(form) })
      .then(function (r) { if (!r.ok) throw 0; msg.textContent = 'Заявка принята, свяжемся с вами.'; form.reset(); })
      .catch(function () { msg.innerHTML = 'Заявка не отправилась. Позвоните: ' + TEL; });
  });
})();
