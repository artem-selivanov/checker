const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const path = require('path');
const os = require('os');
//const input = require("input");
puppeteer.use(StealthPlugin())

class PuppeteerHandler {
    constructor(headless = true) {
        this.browser = null;
        this.page = null;
        this.headless = headless;
    }

    async initBrowser() {
        /*if (this.proxy!="")
        const proxyServer = await this.setUpProxy(this.proxy)*/
        this.path = process.cwd().includes("OpenServer") ? "" : "/home/root/amazon/fin/"
        let settings = {headless: this.headless ? 'new' : false}
        /*if (os.platform() !== 'win32') {
            settings.executablePath = "/snap/bin/chromium"
            settings.args = ['--no-sandbox']
        }*/
        if (this.exist) {
            settings = {...settings, userDataDir, cacheDirectory}
        }
        //console.log({"Pupperteer Settings":settings})
        //console.log('-'.repeat(100))
        this.browser = await puppeteer.launch(settings);
        this.page = await this.browser.newPage();
        await this.page.setViewport({
            width: 1920,
            height: 942,
        });
    }

    async closeBrowser() {
        await this.browser.close();
    }


    async chekSite(site) {
        try {
            const url = ensureHttps(site)
            const response = await this.page.goto(url)
            await this.waitInSeconds(5)
            const status = response.status();
            if (status !== 200) {
                return {status: false, text: `Отримана відповідь від серверу ${status}`}
            }
            const title = await this.page.title();
            if (!title || title.trim() === '') {
                return {status: false, text: `Відсутній title`}
            }
            console.log({title})
            return {status: true, text: `Все ок`}
        } catch (err) {
            return {status: false, text: `Проблема DNS`}
        }
    }

    async waitInSeconds(seconds) {
        return new Promise((resolve) => {
            setTimeout(resolve, seconds * 1000);
        });
    }


}


module.exports = PuppeteerHandler

function ensureHttps(url) {
    if (!/^https?:\/\//i.test(url)) {
        return 'https://' + url;
    }
    return url;
}