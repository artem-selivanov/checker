const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs');
const path = require('path');
const os = require('os');
//const input = require("input");
puppeteer.use(StealthPlugin())

class PuppeteerHandler {
    constructor(headless = true) {
        this.browser = null;
        this.page = null;
        this.headless = headless;
        this.userDataDir = null;
        this.tmpDir = null;
    }

    async initBrowser() {
        /*if (this.proxy!="")
        const proxyServer = await this.setUpProxy(this.proxy)*/
        this.path = process.cwd().includes("OpenServer") ? "" : "/home/root/amazon/fin/"
        let settings = {headless: this.headless ? 'new' : false}
        if (os.platform() !== 'win32') {
            const tmpDir = process.env.CHECKER_TMP_DIR || path.join(process.cwd(), '.chrome-tmp');
            fs.mkdirSync(tmpDir, {recursive: true, mode: 0o700});
            this.tmpDir = tmpDir;
            this.userDataDir = fs.mkdtempSync(path.join(tmpDir, 'checker-chrome-'));

            settings = {
                ...settings,
                userDataDir: this.userDataDir,
                env: {...process.env, TMPDIR: tmpDir, TMP: tmpDir, TEMP: tmpDir},
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--no-first-run',
                    '--no-default-browser-check',
                ],
            }

            const executablePath = getChromeExecutablePath();
            if (executablePath) settings.executablePath = executablePath;
        }
        //console.log({"Pupperteer Settings":settings})
        //console.log('-'.repeat(100))
        if (process.env.CHECKER_DEBUG_CHROME === '1') {
            console.log({
                chromeTmpDir: this.tmpDir,
                chromeUserDataDir: this.userDataDir,
                chromeExecutablePath: settings.executablePath,
                chromeArgs: settings.args,
            });
        }
        try {
            this.browser = await puppeteer.launch(settings);
        } catch (err) {
            this.cleanupUserDataDir();
            throw err;
        }
        this.page = await this.browser.newPage();
        await this.page.setViewport({
            width: 1920,
            height: 942,
        });
    }

    async closeBrowser() {
        try {
            if (this.browser) {
                await this.browser.close();
            }
        } finally {
            this.browser = null;
            this.page = null;
            this.cleanupUserDataDir();
        }
    }

    cleanupUserDataDir() {
        if (!this.userDataDir) return;
        fs.rmSync(this.userDataDir, {recursive: true, force: true});
        this.userDataDir = null;
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

function getChromeExecutablePath() {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    if (typeof puppeteer.executablePath === 'function') {
        try {
            const executablePath = puppeteer.executablePath();
            if (executablePath && fs.existsSync(executablePath)) {
                return executablePath;
            }
        } catch (err) {
            // Fall back to system Chromium below.
        }
    }

    if (fs.existsSync('/usr/bin/chromium-browser')) return '/usr/bin/chromium-browser';
    if (fs.existsSync('/usr/bin/chromium')) return '/usr/bin/chromium';
    if (fs.existsSync('/usr/bin/google-chrome')) return '/usr/bin/google-chrome';

    return null;
}

function ensureHttps(url) {
    if (!/^https?:\/\//i.test(url)) {
        return 'https://' + url;
    }
    return url;
}
