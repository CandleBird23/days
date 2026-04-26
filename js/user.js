var UserManager = (function () {
  var STORAGE_KEY = 'calendar_user';
  var currentUser = null;

  function getQueryParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  function isValidUser(name) {
    return CONFIG.USERS.indexOf(name) !== -1;
  }

  function init() {
    var fromUrl = getQueryParam('user');
    if (fromUrl && isValidUser(fromUrl)) {
      currentUser = fromUrl;
      sessionStorage.setItem(STORAGE_KEY, currentUser);
      return;
    }

    var fromSession = sessionStorage.getItem(STORAGE_KEY);
    if (fromSession && isValidUser(fromSession)) {
      currentUser = fromSession;
      return;
    }

    showSelectionPrompt();
  }

  function showSelectionPrompt() {
    var overlay = document.createElement('div');
    overlay.className = 'user-select-overlay';

    var box = document.createElement('div');
    box.className = 'user-select-box';

    var title = document.createElement('p');
    title.className = 'user-select-title';
    title.textContent = '你是谁？';
    box.appendChild(title);

    CONFIG.USERS.forEach(function (name) {
      var btn = document.createElement('button');
      btn.className = 'user-select-btn';
      btn.textContent = name;
      btn.addEventListener('click', function () {
        currentUser = name;
        sessionStorage.setItem(STORAGE_KEY, name);
        overlay.remove();
        window.dispatchEvent(new CustomEvent('userReady'));
      });
      box.appendChild(btn);
    });

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  function getUser() {
    return currentUser;
  }

  function getUserIndex() {
    return CONFIG.USERS.indexOf(currentUser);
  }

  init();

  if (currentUser) {
    setTimeout(function () {
      window.dispatchEvent(new CustomEvent('userReady'));
    }, 0);
  }

  return {
    getUser: getUser,
    getUserIndex: getUserIndex
  };
})();
