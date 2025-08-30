const PuppeteerHandler = require('./helpers/auto');
const SheetHandler = require('./helpers/spreadsheet');
const util = require('./helpers/util');
const path = require('path');
const path2 = process.cwd().indexOf("/root") > -1 ? "/root/checker" : "D:\\OpenServer\\domains\\ppcagency"
require('dotenv').config({path: path.join(path2, `.env`)});
const test = false;


const moment = require('moment')


const p = new PuppeteerHandler(test ? false : true);
const letter = "D";

(async function () {
    await p.initBrowser()

    for (let sheetUrl of [process.env.SHEET1, process.env.SHEET2, process.env.SHEET3, process.env.SHEET4, process.env.SHEET5]) {

        const s = new SheetHandler(sheetUrl);
        const arr = await s.getValues('Accounts')
        const tabUpdate = []
        const logs = []
        for (let [name, url, expire, ping, whois, ssl, token, chat] of arr.splice(1)) {
            let status = false
            let message = ""
            try {
                const data = await p.chekSite(url)
                status = data.status
                message = data.text
            } catch (e) {
                console.log(e)
                message = e.toString()
            }
            const curTime = moment().format('DD.MM.YYYY HH:mm');
            tabUpdate.push([curTime])
            logs.push([curTime, 'Ping', url, message])
            if (status) continue
            await util.sendMessage(`Проблема з ping домена ${url}: ${message}`, chat, token)
        }
        if (tabUpdate.length > 0) {
            await s.setValues('Accounts', tabUpdate, `${letter}2`)
            await s.addRows(logs, 'Logs')//.setValues('Accounts',tabUpdate,`${letter}2`)
        }
    }
    //console.log(arr)
    await p.closeBrowser()
})()

async function check() {
    return {status: false}
}