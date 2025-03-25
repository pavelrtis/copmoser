
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const puppeteer = require("puppeteer");
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(bodyParser.json());

app.post("/post-to-composer", async (req, res) => {
  const { content, media, tags, links } = req.body;

  const tweetText = [content, ...(tags || []), ...(links || [])].join(" ");

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto("https://x.com/login", { waitUntil: "networkidle2" });
    await page.type('input[name="text"]', process.env.X_USERNAME);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    await page.type('input[name="password"]', process.env.X_PASSWORD);
    await page.keyboard.press("Enter");
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    await page.goto("https://x.com/compose/tweet", { waitUntil: "networkidle2" });

    await page.waitForSelector('[role="textbox"]');
    await page.type('[role="textbox"]', tweetText);

    if (media && media.length > 0) {
      const imgUrl = media[0];
      const response = await fetch(imgUrl);
      const buffer = await response.buffer();
      const filePath = path.join(__dirname, "temp-img.jpg");
      fs.writeFileSync(filePath, buffer);

      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('div[aria-label="Add photos or video"]'),
      ]);

      await fileChooser.accept([filePath]);
    }

    await page.waitForTimeout(1500);
    await page.click('div[data-testid="tweetButton"]');
    await page.waitForTimeout(3000);

    res.status(200).json({ success: true, message: "Tweet sent!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
