var GitHubAPI = (function () {
  var BASE = 'https://api.github.com';

  function apiUrl(path) {
    return BASE + '/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/contents/' + path;
  }

  function isConfigured() {
    return CONFIG.GITHUB_TOKEN && CONFIG.GITHUB_OWNER && CONFIG.GITHUB_REPO;
  }

  function readHeaders() {
    return {
      'Authorization': 'token ' + CONFIG.GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json'
    };
  }

  function writeHeaders() {
    return {
      'Authorization': 'token ' + CONFIG.GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  function readFile(path) {
    if (!isConfigured()) return Promise.resolve(null);
    return fetch(apiUrl(path), { headers: readHeaders() })
      .then(function (res) {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error('GitHub API error: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data) return null;
        return {
          content: decodeURIComponent(escape(atob(data.content.replace(/\n/g, '')))),
          sha: data.sha
        };
      });
  }

  function writeFile(path, content, sha, message) {
    if (!isConfigured()) return Promise.reject(new Error('GitHub API not configured'));
    var body = {
      message: message || 'update ' + path,
      content: btoa(unescape(encodeURIComponent(content)))
    };
    if (sha) body.sha = sha;

    return fetch(apiUrl(path), {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        if (res.status === 409) {
          var err = new Error('conflict');
          err.status = 409;
          throw err;
        }
        throw new Error('GitHub API write error: ' + res.status);
      }
      return res.json();
    });
  }

  function writeFileWithRetry(path, mergeFn, message, retries) {
    retries = retries || 3;
    return readFile(path).then(function (existing) {
      var currentData = existing ? JSON.parse(existing.content) : {};
      var merged = mergeFn(currentData);
      var sha = existing ? existing.sha : null;
      return writeFile(path, JSON.stringify(merged, null, 2), sha, message);
    }).catch(function (err) {
      if (err.status === 409 && retries > 1) {
        return writeFileWithRetry(path, mergeFn, message, retries - 1);
      }
      throw err;
    });
  }

  function writeFileBinary(path, base64Content, sha, message) {
    if (!isConfigured()) return Promise.reject(new Error('GitHub API not configured'));
    var body = {
      message: message || 'upload ' + path,
      content: base64Content
    };
    if (sha) body.sha = sha;

    return fetch(apiUrl(path), {
      method: 'PUT',
      headers: writeHeaders(),
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error('GitHub API upload error: ' + res.status);
      return res.json();
    });
  }

  function listDir(path) {
    if (!isConfigured()) return Promise.resolve([]);
    return fetch(apiUrl(path), { headers: readHeaders() })
      .then(function (res) {
        if (res.status === 404) return [];
        if (!res.ok) throw new Error('GitHub API list error: ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!Array.isArray(data)) return [];
        return data;
      });
  }

  function rawUrl(path) {
    return 'https://raw.githubusercontent.com/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/main/' + path;
  }

  return {
    readFile: readFile,
    writeFile: writeFile,
    writeFileWithRetry: writeFileWithRetry,
    writeFileBinary: writeFileBinary,
    listDir: listDir,
    rawUrl: rawUrl
  };
})();
