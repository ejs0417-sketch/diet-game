// 0.4.8 XP 검증: compute('2026-11-11') = 65 XP, Lv.1
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const store = {};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};
const ctx = {
  console, Date, Math, JSON, Object, Array, String, Number, Boolean, Set, Map,
  RegExp, parseInt, parseFloat, isNaN, isFinite, Infinity, undefined, NaN,
  Intl, Error, TypeError, URL, Promise, localStorage,
  document: { body: {}, createElement(){return {style:{},appendChild(){}};}, addEventListener(){}, getElementById(){return null;} },
  window: {}, globalThis: null, navigator: {serviceWorker:null, onLine:true},
  location: {pathname:'/', origin:'http://127.0.0.1', search:'', hash:'', href:'http://127.0.0.1/'},
  history: {replaceState(){}},
  setTimeout, clearTimeout, setInterval, clearInterval
};
ctx.window = ctx;
ctx.globalThis = ctx;
ctx.self = ctx;
ctx.root = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'), ctx, {filename:'app.js'});
ctx.ensureSeed();
const C = ctx.compute('2026-11-11');
assert.strictEqual(C.total, 65, 'XP should be 65, got '+C.total);
assert.strictEqual(C.level, 1, 'Level should be 1, got '+C.level);
assert.strictEqual(vm.runInContext('VERSION', ctx), '0.4.10');
console.log('XP tests ok', {total:C.total, level:C.level, version:ctx.VERSION});
