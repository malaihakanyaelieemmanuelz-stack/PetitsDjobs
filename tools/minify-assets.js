const fs = require('fs');
const path = require('path');

function minifyCss(css) {
  return css
    .replace(/\/\*[^*]*\*+([^/*][^*]*\*+)*\//g, '') // remove comments
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/\s*([{}:;,])\s*/g, '$1') // remove space around separators
    .trim();
}

function minifyJs(js) {
  return js
    .replace(/\/\*[\s\S]*?\*\//g, '') // remove block comments
    .replace(/\/\/.*$/gm, '') // remove line comments
    .replace(/\s+/g, ' ') // collapse whitespace
    .replace(/\s*([=(){};,<>:+\-/*])\s*/g, '$1')
    .trim();
}

const CSS_SRC = path.join(__dirname, '..', 'public', 'style.css');
const CSS_OUT = path.join(__dirname, '..', 'public', 'style.min.css');
const JS_SRC = path.join(__dirname, '..', 'public', 'js', 'appele-direct.js');
const JS_OUT = path.join(__dirname, '..', 'public', 'js', 'appele-direct.min.js');

try {
  if (fs.existsSync(CSS_SRC)) {
    const css = fs.readFileSync(CSS_SRC, 'utf8');
    fs.writeFileSync(CSS_OUT, minifyCss(css), 'utf8');
    console.log('Wrote', CSS_OUT);
  } else console.warn('CSS source not found:', CSS_SRC);

  if (fs.existsSync(JS_SRC)) {
    const js = fs.readFileSync(JS_SRC, 'utf8');
    fs.writeFileSync(JS_OUT, minifyJs(js), 'utf8');
    console.log('Wrote', JS_OUT);
  } else console.warn('JS source not found:', JS_SRC);
} catch (err) {
  console.error(err);
}
