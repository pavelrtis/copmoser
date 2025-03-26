const express = require('express')
const puppeteer = require('puppeteer')
const bodyParser = require('body-parser')

const app = express()
const PORT = process.env.PORT || 10000

let pendingSessions = {}

app.use(bodyParser.json())

app.post('/post-to-composer', async (req, res) => {
  const { account, method, contentPrompt, tagPrompt, imagePrompt, sourceURL } = req.body
  const { login, password, proxy, promotedOnly } = account

  const browser = await puppeteer.launch({ headless: true, args: proxy ? ["--proxy-server=http://" + proxy] : [] })
  const page = await browser.newPage()

  try {
    await page.goto('https://x.com/login')
    await page.type('input[name="text"]', login)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(1000)

    await page.type('input[name="password"]', password)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(2000)

    if (await page.$('input[name="challenge_response"]')) {
      const sessionId = Date.now().toString()
      pendingSessions[sessionId] = { page, browser, login }
      res.status(202).json({ sessionId })
      return
    }

    await page.goto('https://ads.x.com/')
    await page.waitForTimeout(5000)
    // TODO: implement posting

    await browser.close()
    res.sendStatus(200)
  } catch (e) {
    console.error('Post failed:', e)
    await browser.close()
    res.sendStatus(500)
  }
})

app.post('/submit-code', async (req, res) => {
  const { login, code } = req.body
  const sessionId = Object.keys(pendingSessions).find(id => pendingSessions[id].login === login)
  if (!sessionId) return res.status(404).send('Session not found')

  const { page, browser } = pendingSessions[sessionId]
  try {
    await page.type('input[name="challenge_response"]', code)
    await page.keyboard.press('Enter')
    await page.waitForTimeout(3000)

    await page.goto('https://ads.x.com/')
    await page.waitForTimeout(5000)
    // TODO: implement post-composer action

    delete pendingSessions[sessionId]
    await browser.close()
    res.sendStatus(200)
  } catch (e) {
    console.error('2FA failed:', e)
    await browser.close()
    res.sendStatus(500)
  }
})

app.listen(PORT, () => {
  console.log('Server listening on port', PORT)
})