/* 豆包工作 AI 校园行 · 静态复刻交互脚本
   1) 卡片轮播（embla 行为复刻：按 slide 宽度步进、缓动插值、3s 自动播放、拖拽）
   2) 三步领取：复制关键词 + Toast 提示、跳转报名页
   3) 页脚 CTA 滚动至「会员领取三步走」                                     */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- 轮播 ---------------- */
  function Carousel(root) {
    var track = root.querySelector('[data-track]');
    var slides = Array.prototype.slice.call(root.querySelectorAll('[role="group"]'));
    if (!track || slides.length < 2) return null;

    var dotsWrap = root.parentElement.querySelector('[data-dots]');
    var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.querySelectorAll('[data-dot]')) : [];
    var prev = root.querySelector('[data-prev]');
    var next = root.querySelector('[data-next]');

    var index = 0;
    var maxIndex = slides.length - 1;
    var current = 0;      // 当前像素位移
    var target = 0;       // 目标像素位移
    var raf = null;
    var dragging = false;
    var startX = 0;
    var startOffset = 0;
    var moved = false;
    var autoplay = !!dotsWrap;
    var timer = null;

    function step() {
      return slides[0].getBoundingClientRect().width;
    }

    function apply(v) {
      track.style.transform = 'translate3d(' + v.toFixed(2) + 'px, 0px, 0px)';
    }

    function animate() {
      // 与原站曲线一致：指数收敛，每帧逼近 10%
      raf = null;
      var diff = target - current;
      if (Math.abs(diff) < 0.5) {
        current = target;
        apply(current);
        return;
      }
      current += diff * 0.1;
      apply(current);
      raf = requestAnimationFrame(animate);
    }

    function goTo(i, animateIt) {
      index = Math.max(0, Math.min(maxIndex, i));
      target = -index * step();
      if (!animateIt || reduceMotion) {
        current = target;
        apply(current);
      } else if (!raf) {
        raf = requestAnimationFrame(animate);
      }
      updateDots();
    }

    function updateDots() {
      dots.forEach(function (d, i) {
        var on = i === index;
        d.className = 'h-1.5 rounded-full transition-all duration-300 ' +
          (on ? 'w-5 bg-[#4D6BFE]' : 'w-1.5 bg-[#4D6BFE]/25 hover:bg-[#4D6BFE]/45');
      });
    }

    function stopIntent() {
      if (timer) { clearInterval(timer); timer = null; }
      autoplay = false;
    }

    function startAutoplay() {
      if (!autoplay || reduceMotion) return;
      timer = setInterval(function () {
        if (index >= maxIndex) { stopIntent(); return; }
        goTo(index + 1, true);
      }, 3000);
    }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { stopIntent(); goTo(i, true); });
    });
    if (prev) prev.addEventListener('click', function () { stopIntent(); goTo(index - 1, true); });
    if (next) next.addEventListener('click', function () { stopIntent(); goTo(index + 1, true); });

    // 拖拽
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startOffset = current;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      track.classList.add('is-dragging');
      track.setPointerCapture && track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      current = startOffset + dx;
      apply(current);
    });
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      var dx = e.clientX - startX;
      var s = step();
      var delta = Math.round(-dx / s) || (Math.abs(dx) > s * 0.2 ? (dx < 0 ? 1 : -1) : 0);
      if (Math.abs(dx) < 4) { goTo(index, true); return; }
      stopIntent();
      goTo(index + delta, true);
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);

    window.addEventListener('resize', function () { goTo(index, false); });

    goTo(0, false);
    startAutoplay();

    return { goTo: goTo, stopAutoplay: stopIntent };
  }

  var carousels = Array.prototype.slice.call(document.querySelectorAll('[data-carousel]')).map(Carousel);

  /* ---------------- Toast ---------------- */
  var toastHost = document.getElementById('toastHost');
  var checkIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" height="20" width="20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path></svg>';

  function toast(message) {
    if (!toastHost) return;
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.innerHTML = '<div class="toast-icon">' + checkIcon + '</div><div class="toast-content"><div class="toast-title">' + message + '</div></div>';
    toastHost.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('is-in'); });
    setTimeout(function () {
      el.classList.remove('is-in');
      setTimeout(function () { el.remove(); }, 400);
    }, 4000);
  }

  /* ---------------- 复制 ---------------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* 无剪贴板权限时静默降级 */ }
    document.body.removeChild(ta);
  }

  // 移动端：三个按钮都改为复制本页电脑版地址（与原站行为一致）
  var PAGE_URL = location.href;
  var isMobile = window.matchMedia('(max-width: 767px)').matches;

  Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function (btn) {
    btn.addEventListener('click', function () {
      if (isMobile) {
        copyText(PAGE_URL).then(function () {
          toast('已复制电脑版报名地址！移动端仅支持浏览，请把地址发给电脑，用浏览器打开：' + PAGE_URL + ' 完成报名操作');
        });
        return;
      }
      var text = btn.getAttribute('data-copy');
      if (text) {
        copyText(text).then(function () {
          toast('关键词「' + text + '」已自动复制！在对话框输出关键词即可进入活动界面');
        });
        return;
      }
      window.open('https://www.doubao.com/pc/campus-campaign', '_blank', 'noopener');
    });
  });

  /* ---------------- 页脚 CTA ---------------- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-scroll-to]'), function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById(btn.getAttribute('data-scroll-to'));
      if (!target) return;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });
})();
