(function Calendar() {
  var BEIJING_OFFSET = 8 * 60 * 60 * 1000;

  function getBeijingNow() {
    var now = new Date();
    var utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + BEIJING_OFFSET);
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function showToast(text) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2500);
  }

  var bjNow = getBeijingNow();
  var viewYear = bjNow.getFullYear();
  var viewMonth = bjNow.getMonth();
  var selectedDate = null;
  var monthMessages = {};
  var loadingMessages = false;

  var $grid = document.getElementById('calendar-grid');
  var $label = document.getElementById('cal-month-label');
  var $prev = document.getElementById('cal-prev');
  var $next = document.getElementById('cal-next');
  var $panel = document.getElementById('msg-panel');
  var $panelDate = document.getElementById('msg-panel-date');
  var $panelClose = document.getElementById('msg-panel-close');
  var $msgList = document.getElementById('msg-list');
  var $msgInput = document.getElementById('msg-input');
  var $msgSend = document.getElementById('msg-send');

  function monthKey(y, m) {
    return y + '-' + pad(m + 1);
  }

  function filePath(y, m) {
    return 'messages/' + monthKey(y, m) + '.json';
  }

  function loadMessages(y, m) {
    var key = monthKey(y, m);
    loadingMessages = true;
    return GitHubAPI.readFile(filePath(y, m)).then(function (result) {
      monthMessages[key] = result ? JSON.parse(result.content) : {};
      loadingMessages = false;
    }).catch(function () {
      monthMessages[key] = {};
      loadingMessages = false;
    });
  }

  function renderGrid() {
    $label.textContent = viewYear + ' 年 ' + (viewMonth + 1) + ' 月';
    $grid.innerHTML = '';

    var firstDay = new Date(viewYear, viewMonth, 1).getDay();
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var key = monthKey(viewYear, viewMonth);
    var msgs = monthMessages[key] || {};

    var today = getBeijingNow();
    var todayStr = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());

    for (var i = 0; i < firstDay; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-day empty';
      $grid.appendChild(empty);
    }

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = viewYear + '-' + pad(viewMonth + 1) + '-' + pad(d);
      var cell = document.createElement('div');
      cell.className = 'cal-day';
      cell.textContent = d;
      cell.dataset.date = dateStr;

      if (dateStr === todayStr) cell.classList.add('today');
      if (msgs[dateStr] && msgs[dateStr].length > 0) cell.classList.add('has-msg');
      if (dateStr === selectedDate) cell.classList.add('selected');

      cell.addEventListener('click', onDayClick);
      $grid.appendChild(cell);
    }
  }

  function onDayClick(e) {
    var dateStr = e.currentTarget.dataset.date;
    if (!dateStr) return;
    selectedDate = dateStr;
    renderGrid();
    openPanel(dateStr);
  }

  function openPanel(dateStr) {
    var parts = dateStr.split('-');
    $panelDate.textContent = parts[0] + ' 年 ' + parseInt(parts[1]) + ' 月 ' + parseInt(parts[2]) + ' 日';
    $panel.style.display = '';
    renderMessages(dateStr);
    $msgInput.value = '';
    $msgInput.focus();
  }

  function closePanel() {
    $panel.style.display = 'none';
    selectedDate = null;
    renderGrid();
  }

  function renderMessages(dateStr) {
    var key = monthKey(viewYear, viewMonth);
    var msgs = monthMessages[key] || {};
    var dayMsgs = msgs[dateStr] || [];

    if (dayMsgs.length === 0) {
      $msgList.innerHTML = '<div class="msg-empty">还没有留言，写下第一条吧</div>';
      return;
    }

    $msgList.innerHTML = '';
    var user = UserManager.getUser();

    dayMsgs.forEach(function (msg) {
      var bubble = document.createElement('div');
      bubble.className = 'msg-bubble ' + (msg.user === user ? 'msg-self' : 'msg-other');

      var name = document.createElement('div');
      name.className = 'msg-bubble-name';
      name.textContent = msg.user;

      var text = document.createElement('div');
      text.className = 'msg-bubble-text';
      text.textContent = msg.text;

      var time = document.createElement('div');
      time.className = 'msg-bubble-time';
      var t = new Date(msg.time);
      time.textContent = pad(t.getHours()) + ':' + pad(t.getMinutes());

      bubble.appendChild(name);
      bubble.appendChild(text);
      bubble.appendChild(time);
      $msgList.appendChild(bubble);
    });

    $msgList.scrollTop = $msgList.scrollHeight;
  }

  function sendMessage() {
    var text = $msgInput.value.trim();
    if (!text || !selectedDate) return;
    if (text.length > 500) {
      showToast('消息不能超过 500 字');
      return;
    }

    var user = UserManager.getUser();
    if (!user) {
      showToast('请先选择身份');
      return;
    }

    $msgSend.disabled = true;
    $msgInput.disabled = true;

    var bj = getBeijingNow();
    var timeStr = bj.getFullYear() + '-' + pad(bj.getMonth() + 1) + '-' + pad(bj.getDate()) +
      'T' + pad(bj.getHours()) + ':' + pad(bj.getMinutes()) + ':' + pad(bj.getSeconds()) + '+08:00';

    var newMsg = { user: user, text: text, time: timeStr };
    var dateStr = selectedDate;
    var y = viewYear, m = viewMonth;

    GitHubAPI.writeFileWithRetry(
      filePath(y, m),
      function (data) {
        if (!data[dateStr]) data[dateStr] = [];
        data[dateStr].push(newMsg);
        return data;
      },
      user + ': ' + text.substring(0, 30)
    ).then(function () {
      var key = monthKey(y, m);
      if (!monthMessages[key][dateStr]) monthMessages[key][dateStr] = [];
      monthMessages[key][dateStr].push(newMsg);

      $msgInput.value = '';
      renderMessages(dateStr);
      renderGrid();
    }).catch(function (err) {
      showToast('发送失败，请重试');
      console.error('Send message failed:', err);
    }).finally(function () {
      $msgSend.disabled = false;
      $msgInput.disabled = false;
      $msgInput.focus();
    });
  }

  function changeMonth(delta) {
    closePanel();
    viewMonth += delta;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }

    var key = monthKey(viewYear, viewMonth);
    if (monthMessages[key]) {
      renderGrid();
    } else {
      renderGrid();
      loadMessages(viewYear, viewMonth).then(renderGrid);
    }
  }

  $prev.addEventListener('click', function () { changeMonth(-1); });
  $next.addEventListener('click', function () { changeMonth(1); });
  $panelClose.addEventListener('click', closePanel);
  $msgSend.addEventListener('click', sendMessage);
  $msgInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  function initCalendar() {
    renderGrid();
    loadMessages(viewYear, viewMonth).then(renderGrid);
  }

  if (UserManager.getUser()) {
    initCalendar();
  } else {
    window.addEventListener('userReady', initCalendar);
  }
})();
