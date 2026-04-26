(function Album() {
  var BEIJING_OFFSET = 8 * 60 * 60 * 1000;
  var MAX_WIDTH = 1920;
  var JPEG_QUALITY = 0.8;
  var PHOTOS_PER_PAGE = 12;

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

  var allPhotos = [];
  var displayedCount = 0;
  var loadedMonths = [];
  var currentLightboxIndex = -1;

  var $grid = document.getElementById('album-grid');
  var $fileInput = document.getElementById('album-file-input');
  var $status = document.getElementById('album-upload-status');
  var $loadMore = document.getElementById('album-load-more');
  var $lightbox = document.getElementById('lightbox');
  var $lightboxImg = document.getElementById('lightbox-img');
  var $lightboxClose = document.getElementById('lightbox-close');
  var $lightboxPrev = document.getElementById('lightbox-prev');
  var $lightboxNext = document.getElementById('lightbox-next');

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > MAX_WIDTH) {
            h = Math.round(h * MAX_WIDTH / w);
            w = MAX_WIDTH;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          var base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function generateFilename() {
    var bj = getBeijingNow();
    var ts = bj.getFullYear() + pad(bj.getMonth() + 1) + pad(bj.getDate()) +
      '_' + pad(bj.getHours()) + pad(bj.getMinutes()) + pad(bj.getSeconds());
    var rand = Math.random().toString(36).substring(2, 8);
    return ts + '_' + rand + '.jpg';
  }

  function imageDirPath(bj) {
    return 'images/' + bj.getFullYear() + '-' + pad(bj.getMonth() + 1);
  }

  function uploadFile(file) {
    $status.textContent = '压缩中…';
    return compressImage(file).then(function (base64) {
      $status.textContent = '上传中…';
      var bj = getBeijingNow();
      var dir = imageDirPath(bj);
      var filename = generateFilename();
      var path = dir + '/' + filename;
      return GitHubAPI.writeFileBinary(path, base64, null, 'upload ' + filename);
    }).then(function (result) {
      var rawUrl = GitHubAPI.rawUrl(result.content.path);
      allPhotos.unshift({ url: rawUrl, name: result.content.name });
      renderGallery();
      $status.textContent = '上传成功';
      setTimeout(function () { $status.textContent = ''; }, 2000);
    }).catch(function (err) {
      $status.textContent = '';
      showToast('上传失败，请重试');
      console.error('Upload failed:', err);
    });
  }

  function onFileSelect(e) {
    var files = Array.from(e.target.files);
    if (!files.length) return;

    var chain = Promise.resolve();
    files.forEach(function (file, i) {
      chain = chain.then(function () {
        $status.textContent = '上传 ' + (i + 1) + '/' + files.length + '…';
        return uploadFile(file);
      });
    });
    chain.then(function () {
      $status.textContent = files.length + ' 张上传完成';
      setTimeout(function () { $status.textContent = ''; }, 2000);
    });
    e.target.value = '';
  }

  function getMonthList() {
    var bj = getBeijingNow();
    var months = [];
    for (var i = 0; i < 24; i++) {
      var y = bj.getFullYear();
      var m = bj.getMonth() - i;
      while (m < 0) { m += 12; y--; }
      months.push(y + '-' + pad(m + 1));
    }
    return months;
  }

  function loadNextMonth() {
    var monthList = getMonthList();
    var nextIndex = loadedMonths.length;
    if (nextIndex >= monthList.length) {
      $loadMore.style.display = 'none';
      return Promise.resolve();
    }

    var monthStr = monthList[nextIndex];
    return GitHubAPI.listDir('images/' + monthStr).then(function (files) {
      loadedMonths.push(monthStr);
      files.forEach(function (f) {
        if (f.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          allPhotos.push({
            url: GitHubAPI.rawUrl(f.path),
            name: f.name
          });
        }
      });
      allPhotos.sort(function (a, b) { return b.name.localeCompare(a.name); });
    }).catch(function () {
      loadedMonths.push(monthStr);
    });
  }

  function renderGallery() {
    $grid.innerHTML = '';
    var count = Math.min(allPhotos.length, displayedCount + PHOTOS_PER_PAGE);
    displayedCount = count;

    for (var i = 0; i < count; i++) {
      var photo = allPhotos[i];
      var thumb = document.createElement('div');
      thumb.className = 'album-thumb';
      thumb.dataset.index = i;

      var img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name;
      img.loading = 'lazy';

      thumb.appendChild(img);
      thumb.addEventListener('click', onThumbClick);
      $grid.appendChild(thumb);
    }

    $loadMore.style.display = (allPhotos.length > count || loadedMonths.length < getMonthList().length)
      ? '' : 'none';
  }

  function onThumbClick(e) {
    var index = parseInt(e.currentTarget.dataset.index);
    openLightbox(index);
  }

  function openLightbox(index) {
    if (index < 0 || index >= allPhotos.length) return;
    currentLightboxIndex = index;
    $lightboxImg.src = allPhotos[index].url;
    $lightbox.style.display = '';
  }

  function closeLightbox() {
    $lightbox.style.display = 'none';
    currentLightboxIndex = -1;
  }

  function prevPhoto() {
    if (currentLightboxIndex > 0) openLightbox(currentLightboxIndex - 1);
  }

  function nextPhoto() {
    if (currentLightboxIndex < allPhotos.length - 1) openLightbox(currentLightboxIndex + 1);
  }

  $fileInput.addEventListener('change', onFileSelect);
  $lightboxClose.addEventListener('click', closeLightbox);
  $lightboxPrev.addEventListener('click', prevPhoto);
  $lightboxNext.addEventListener('click', nextPhoto);
  $lightbox.addEventListener('click', function (e) {
    if (e.target === $lightbox) closeLightbox();
  });
  document.addEventListener('keydown', function (e) {
    if ($lightbox.style.display === 'none') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') prevPhoto();
    if (e.key === 'ArrowRight') nextPhoto();
  });

  $loadMore.addEventListener('click', function () {
    loadNextMonth().then(renderGallery);
  });

  function initAlbum() {
    loadNextMonth().then(function () {
      renderGallery();
      if (allPhotos.length === 0) {
        loadNextMonth().then(renderGallery);
      }
    });
  }

  window.addEventListener('userReady', initAlbum);
})();
