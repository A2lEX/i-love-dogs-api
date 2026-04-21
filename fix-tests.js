const fs = require('fs');

function findFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(findFiles(file));
    } else { 
      if (file.endsWith('.spec.ts')) results.push(file);
    }
  });
  return results;
}

const files = findFiles('src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('.useMocker(')) return;
  content = content.replace(/\}\)\.compile\(\);/g, '}).useMocker(() => ({})).compile();');
  fs.writeFileSync(file, content);
});
console.log('Test files updated with useMocker.');
