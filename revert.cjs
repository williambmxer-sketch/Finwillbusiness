const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(file);
    }
  });
  return results;
}

const files = walk('c:/Financas/src');
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/'receita'/g, "'income'");
  content = content.replace(/"receita"/g, '"income"');
  content = content.replace(/'despesa'/g, "'expense'");
  content = content.replace(/"despesa"/g, '"expense"');
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedCount++;
    console.log('Reverted: ' + file);
  }
});
console.log('Total files changed: ' + changedCount);
