(function () {
  var hostname = window.location.hostname;
  var isLocal = hostname === 'localhost' || hostname === '127.0.0.1';

  var defaultApiBase = isLocal
    ? 'http://localhost:5000'
    : 'https://api.ortizcustomworks.com';

  var overrideApiBase = null;
  try {
    overrideApiBase = window.localStorage.getItem('apiBaseUrlOverride');
  } catch (error) {
    overrideApiBase = null;
  }

  var resolvedBase = (overrideApiBase || defaultApiBase || '').replace(/\/+$/, '');

  window.API_BASE = resolvedBase;
  window.apiUrl = function (path) {
    var normalizedPath = path.startsWith('/') ? path : '/' + path;
    return window.API_BASE + normalizedPath;
  };
})();
