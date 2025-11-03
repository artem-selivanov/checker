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

    for (let sheetUrl of [process.env.SPREADSHEET]) {
        const texts = []
        const s = new SheetHandler(sheetUrl);
        const arr = await s.getValues('Accounts')
        const tabUpdate = []
        const logs = []
        for (let [name, url, expire, ping, whois, ssl, token, chat] of arr.splice(1)) {
            if (url=='') continue
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
            logs.push([curTime, 'Ping', url,status?'OK':'ERROR', message])
            if (status) continue
            console.log(`Проблема з ping домена ${url}: ${message}`)
            texts.push(`Проблема з ping домена ${url}: ${message}`)
            //await util.sendMessage(`Проблема з ping домена ${url}: ${message}`, chat, token)
        }
        if (tabUpdate.length > 0) {
            await s.setValues('Accounts', tabUpdate, `${letter}2`)
            await s.addRows(logs, 'Logs')//.setValues('Accounts',tabUpdate,`${letter}2`)
        }
        if (texts.length>0){
            await util.sendMessage(texts.join("\n"), arr[1][7], arr[1][6])
        }
    }
    //console.log(arr)
    await p.closeBrowser()
})()

async function check() {
    return {status: false}
}