const http = require('http');

function api(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      method,
      hostname: '127.0.0.1',
      port: 3000,
      path,
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    console.log('=== health ===');
    console.log(await api('GET', '/api/health'));
    console.log('\n=== generate-mock ===');
    console.log(await api('POST', '/api/assets/generate-mock?days_before=30&days_after=30'));
    console.log('\n=== snapshots (近7天) ===');
    const today = new Date();
    const end = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    const past = new Date(today); past.setDate(past.getDate() - 7);
    const start = `${past.getFullYear()}-${String(past.getMonth()+1).padStart(2,'0')}-${String(past.getDate()).padStart(2,'0')}`;
    console.log(`range: ${start} -> ${end}`);
    console.log(await api('GET', `/api/assets/snapshots?start=${start}&end=${end}&granularity=day`));
    console.log('\n=== changes (近7天) ===');
    console.log(await api('GET', `/api/assets/changes?start=${start}&end=${end}`));
    console.log('\n=== snapshot today ===');
    console.log(await api('GET', `/api/assets/snapshot?date=${end}`));
  } catch (e) {
    console.error('ERR:', e);
  }
})();
