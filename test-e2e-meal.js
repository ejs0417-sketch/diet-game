#!/usr/bin/env node
// 0.4.12 E2E: 한 끼 메뉴 3개 연속 검색·추가 (모든 진입 경로, 짧은 화면, SW 업데이트)
const {spawnSync} = require('child_process');
const path = require('path');
const r = spawnSync('python3', [path.join(__dirname, 'test-e2e-meal.py'), ...process.argv.slice(2)], {stdio: 'inherit'});
process.exit(r.status == null ? 1 : r.status);
