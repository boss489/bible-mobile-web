#!/usr/bin/env node
// Collect public study resources so chapter matches have a real source page.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'

const exec = promisify(execFile)
const output = new URL('../content/bskorea-resource-catalog.json', import.meta.url)
const sitemap = 'https://bible.bskorea.or.kr/sitemap/indexed/kor-ko.content.xml'
const cacheMap = process.env.BSKOREA_CACHE_MAP
  ? JSON.parse(await readFile(process.env.BSKOREA_CACHE_MAP, 'utf8'))
  : null
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const fetchPage = async url => cacheMap
  ? readFile(cacheMap.pages[url], 'utf8')
  : (await exec('curl', [
  '-fsSL', '--retry', '2', '--retry-delay', '1', '--max-time', '25',
  '-A', userAgent, '-e', 'https://www.bskorea.or.kr/', url,
], { maxBuffer: 4 * 1024 * 1024 })).stdout

const xml = cacheMap ? await readFile(cacheMap.sitemap, 'utf8') : await fetchPage(sitemap)
const urls = [...xml.matchAll(/<loc>(https:\/\/bible\.bskorea\.or\.kr\/resources\/[^<]+)<\/loc>/g)]
  .map(match => match[1])
const previous = await readFile(output, 'utf8').then(JSON.parse).catch(() => ({ resources: [] }))
const saved = new Map(previous.resources.map(item => [item.url, item]))
const failures = []
let cursor = 0
let completed = 0
let saving = Promise.resolve()

async function worker() {
  while (cursor < urls.length) {
    const url = urls[cursor++]
    if (saved.has(url)) continue
    try {
      const dom = new JSDOM(await fetchPage(url))
      const document = dom.window.document
      const main = document.querySelector('main')
      if (!main) throw new Error('No public article content')
      const body = main?.querySelector('ibep-render-gutenberg-blocks')
      const paragraphs = [...(body?.querySelectorAll('p, h2, h3') ?? [])]
        .map(node => node.textContent.replace(/\s+/g, ' ').trim())
        .filter((text, index, all) => text && all.indexOf(text) === index)
      const parts = new URL(url).pathname.split('/').filter(Boolean)
      saved.set(url, {
        kind: parts[2] || parts[1],
        url,
        title: main?.querySelector('h1')?.textContent.trim() || document.title.split(' - ')[0],
        description: document.querySelector('meta[property="og:description"]')?.content || '',
        paragraphs,
        images: [...(body?.querySelectorAll('img[src]') ?? [])].slice(0, 5)
          .map(image => ({ src: image.src, alt: image.alt || '' })),
      })
      dom.window.close()
    } catch (error) {
      failures.push({ url, error: String(error.message || error) })
    }
    completed++
    if (completed % 50 === 0) {
      await save()
      console.log(`surveyed=${saved.size}/${urls.length} failed=${failures.length}`)
    }
  }
}

async function save() {
  const contents = JSON.stringify({
    collectedAt: new Date().toISOString().slice(0, 10),
    sitemap,
    expected: urls.length,
    resources: [...saved.values()].sort((a, b) => a.url.localeCompare(b.url)),
    failures,
  }, null, 2) + '\n'
  saving = saving.then(() => writeFile(output, contents))
  await saving
}

await Promise.all([worker(), worker(), worker()])
await save()
console.log(`surveyed=${saved.size}/${urls.length} failed=${failures.length}`)
if (saved.size !== urls.length) process.exitCode = 1
