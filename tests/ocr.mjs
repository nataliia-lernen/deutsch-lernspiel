import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});const page=await browser.newPage();
await page.goto(process.env.GAME_URL||'http://localhost:5173');
const image=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=300;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,1200,300);x.fillStyle='black';x.font='45px Arial';x.fillText('der Bus — автобус',40,85);x.fillText('das Wasser — вода',40,175);return c.toDataURL('image/png').split(',')[1]});
await page.locator('[data-page=add]').click();await page.locator('#photos').setInputFiles([{name:'words-1.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')},{name:'words-2.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')}]);
await page.waitForFunction(()=>{const t=document.querySelector('#ocr-status')?.textContent;return t?.includes('Розпізнано фото')||t?.includes('Не вдалося')},{},{timeout:120000});const status=await page.locator('#ocr-status').textContent();console.log(status);assert.match(status,/2 із 2/);const text=await page.locator('#raw').inputValue();console.log(text);assert.match(text,/bus/i);assert.match(text,/автобус/);await browser.close();
