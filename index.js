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
  const { content, media, headline, website } = req.body;

  const browser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();

  try {
    console.log("🌐 Заходим на X.com/login");
    await page.goto("https://x.com/login", { waitUntil: "networkidle2" });

    await page.waitForSelector('input[name="text"]');
    await page.type('input[name="text"]', process.env.X_USERNAME);
    await page.keyboard.press("Enter");

    await page.waitForTimeout(1500);
    await page.type('input[name="password"]', process.env.X_PASSWORD);
    await page.keyboard.press("Enter");

    console.log("🕐 Введи код из email (2FA) вручную и нажми Enter в консоли.");
    await new Promise((resolve) => process.stdin.once("data", () => resolve()));
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    console.log("🔗 Переход на ads.x.com...");
    await page.goto("https://ads.x.com/", { waitUntil: "networkidle2" });
    await page.waitForNavigation({ waitUntil: "networkidle2" });

    const url = page.url();
    const match = url.match(/analytics\\/([a-zA-Z0-9]+)/);
    if (!match) throw new Error("Не удалось извлечь account_id");
    const accountId = match[1];
    console.log("📎 Найден account_id:", accountId);

    const composerUrl = `https://ads.x.com/composer/${accountId}/carousel`;
    await page.goto(composerUrl, { waitUntil: "networkidle2" });

    await page.waitForSelector('button.FormInput');
    await page.click('button.FormInput');

    await page.waitForSelector('#dropdown-menu-item-content-60');
    await page.click('#dropdown-menu-item-content-60');

    await page.waitForSelector('[aria-multiline="true"][contenteditable="true"]');
    await page.type('[aria-multiline="true"][contenteditable="true"]', content);

    await page.click('div[role="radio"]:has-text("Single media")');

    await page.waitForSelector('input[type="file"]', { visible: true });

    const mediaUrl = media[0];
    const mediaPath = path.join(__dirname, "temp-upload.jpg");
    const buffer = await fetch(mediaUrl).then(r => r.buffer());
    fs.writeFileSync(mediaPath, buffer);

    const [fileChooser] = await Promise.all([
      page.waitForFileChooser(),
      page.click('button:has-text("Browse your device")')
    ]);
    await fileChooser.accept([mediaPath]);

    await page.waitForSelector('input[placeholder="Headline"]');
    await page.type('input[placeholder="Headline"]', headline);

    await page.type('input[placeholder="https://"]', website);

    const promotedCheckbox = await page.$('input[type="checkbox"]:checked');
    if (promotedCheckbox) {
      await promotedCheckbox.click();
    }

    res.status(200).json({ success: true, message: "Composer заполнен. Готов к ручному подтверждению." });
  } catch (err) {
    console.error("❌ Ошибка:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server ready on port ${PORT}`);
});
