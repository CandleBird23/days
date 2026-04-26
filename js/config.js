var CONFIG = (function () {
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token') || sessionStorage.getItem('gh_token') || '';
  if (token) sessionStorage.setItem('gh_token', token);
  return {
    GITHUB_TOKEN: token,
    GITHUB_OWNER: 'CandleBird23',
    GITHUB_REPO:  'days',
    USERS: ['Now', 'Livia']
  };
})();
