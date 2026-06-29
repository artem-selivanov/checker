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

    async restartBrowser() {
        console.log('Перезапуск браузера: закрываю текущий экземпляр и создаю новый.');
        try {
            if (this.browser) {
                await this.browser.close();
            }
        } catch (error) {
            console.log('Не удалось корректно закрыть браузер перед перезапуском', error?.message || error);
        }

        this.browser = null;
        this.page = null;

        await this.initBrowser();
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


    async chekSite(site, options = {}) {
        const retries = options.retries ?? 3;
        const delayMs = options.delayMs ?? 3000;
        let timeoutStreak = 0;

        for (let attempt = 1; attempt <= retries; attempt++) {
            console.log(`[Ping] ${site} — попытка ${attempt} из ${retries}`);
            const result = await this.checkSiteOnce(site);

            if (result.status) {
                console.log(`[Ping] ${site} — успешно на попытке ${attempt}`);
                return result;
            }

            console.log(
                `[Ping] ${site} — ошибка на попытке ${attempt}: ${result.text}` +
                `${result.code ? ` [${result.code}]` : ''}` +
                `, retryable=${result.retryable === true}`
            );

            if (result.code === 'TIMEOUT') {
                timeoutStreak += 1;
                console.log(`[Ping] ${site} — таймаут подряд: ${timeoutStreak}`);
            } else {
                timeoutStreak = 0;
            }

            if (timeoutStreak >= 2 && attempt < retries) {
                console.log(`[Ping] ${site} — два таймаута подряд. Перезапускаю браузер перед следующей попыткой.`);
                await this.restartBrowser();
                timeoutStreak = 0;
            }

            if (!result.retryable || attempt === retries) {
                return {
                    status: false,
                    text: attempt > 1 ? `${result.text} (после ${attempt} попыток)` : result.text,
                };
            }

            console.log(`[Ping] ${site} — жду ${delayMs} мс перед следующей попыткой.`);
            await this.waitInSeconds(delayMs / 1000);
        }

        return {status: false, text: 'Невідома помилка перевірки сайту'};
    }

    async checkSiteOnce(site) {
        try {
            const url = ensureHttps(site)
            const response = await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
            })
            await this.waitInSeconds(5)
            if (!response) {
                return {
                    status: false,
                    text: 'Не отримано відповідь від сторінки',
                    code: 'NO_RESPONSE',
                    retryable: true,
                }
            }
            const status = response.status();
            if (status !== 200) {
                return {status: false, text: `Отримана відповідь від серверу ${status}`, code: 'HTTP_STATUS', retryable: false}
            }
            const title = await this.page.title();
            if (!title || title.trim() === '') {
                return {status: false, text: `Відсутній title`, code: 'EMPTY_TITLE', retryable: false}
            }
            //console.log({title})
            return {status: true, text: `Все ок`}
        } catch (err) {
            return classifyNavigationError(err)
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
function classifyNavigationError(err) {
    const message = (err && err.message ? err.message : err?.toString?.() || '').toLowerCase();

    if (message.includes('err_name_not_resolved') || message.includes('enotfound')) {
        return {status: false, text: 'Проблема DNS', code: 'DNS', retryable: false};
    }

    if (message.includes('timeout') || message.includes('navigation timeout')) {
        return {status: false, text: 'Таймаут завантаження', code: 'TIMEOUT', retryable: true};
    }

    if (message.includes('err_cert') || message.includes('ssl')) {
        return {status: false, text: 'Проблема SSL', code: 'SSL', retryable: false};
    }

    if (
        message.includes('err_connection_reset') ||
        message.includes('err_connection_refused') ||
        message.includes('err_connection_closed') ||
        message.includes('err_connection_failed') ||
        message.includes('err_network_changed')
    ) {
        return {status: false, text: 'Проблема з\'єднання', code: 'CONNECTION', retryable: true};
    }

    return {status: false, text: 'Невідома помилка завантаження', code: 'UNKNOWN', retryable: true};
}
