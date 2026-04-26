(function () {
  var BEIJING_OFFSET = 8 * 60 * 60 * 1000;
  function getBeijingNow() {
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + BEIJING_OFFSET);
  }

  var START = new Date(Date.UTC(2026, 0, 25, 0, 0, 0) - BEIJING_OFFSET);

  var $days = document.getElementById('days');
  var $headlineDays = document.getElementById('headline-days');
  var $hours = document.getElementById('hours');
  var $minutes = document.getElementById('minutes');
  var $seconds = document.getElementById('seconds');
  var $beijingTime = document.getElementById('beijing-time');

  function pad(n) { return String(n).padStart(2, '0'); }

  function updateCounter() {
    var now = new Date();
    var diff = now.getTime() - START.getTime();
    if (diff < 0) return;

    var totalSec = Math.floor(diff / 1000);
    var d = Math.floor(totalSec / 86400);
    var h = Math.floor((totalSec % 86400) / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;

    $days.textContent = d;
    $headlineDays.textContent = d;
    $hours.textContent = pad(h);
    $minutes.textContent = pad(m);
    $seconds.textContent = pad(s);

    var bj = getBeijingNow();
    $beijingTime.textContent =
      '北京时间 ' + bj.getFullYear() + '.' +
      pad(bj.getMonth() + 1) + '.' +
      pad(bj.getDate()) + '  ' +
      pad(bj.getHours()) + ':' +
      pad(bj.getMinutes()) + ':' +
      pad(bj.getSeconds());
  }

  updateCounter();
  setInterval(updateCounter, 1000);

  function pickQuote() {
    return QUOTES[Math.floor(Math.random() * QUOTES.length)];
  }

  function renderQuote() {
    var q = pickQuote();
    document.getElementById('quote-text').textContent = q.text;
    document.getElementById('fortune-label').textContent = q.tag;
    document.getElementById('fortune-icon').textContent = q.icon;
    document.getElementById('quote-author').textContent = q.author;
  }
  renderQuote();

  function createPetals() {
    var container = document.getElementById('petals');
    var count = window.innerWidth < 600 ? 10 : 18;
    var colors = [
      'rgba(212,160,160,0.18)',
      'rgba(232,206,206,0.22)',
      'rgba(201,169,110,0.12)',
      'rgba(242,224,224,0.25)',
      'rgba(212,160,160,0.10)',
    ];
    for (var i = 0; i < count; i++) {
      var el = document.createElement('div');
      el.className = 'petal';
      var size = 6 + Math.random() * 10;
      el.style.setProperty('--size', size + 'px');
      el.style.setProperty('--duration', (12 + Math.random() * 18) + 's');
      el.style.setProperty('--delay', (Math.random() * 15) + 's');
      el.style.setProperty('--drift', (Math.random() * 80 - 40) + 'px');
      el.style.setProperty('--spin', (180 + Math.random() * 360) + 'deg');
      el.style.setProperty('--peak-opacity', (0.3 + Math.random() * 0.3).toFixed(2));
      el.style.left = (Math.random() * 100) + '%';
      el.style.top = '-20px';
      el.style.background = colors[Math.floor(Math.random() * colors.length)];
      container.appendChild(el);
    }
  }
  createPetals();
})();
