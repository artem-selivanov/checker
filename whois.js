const SheetHandler = require('./helpers/spreadsheet');
const util = require('./helpers/util');
const path = require('path');
const path2 = process.cwd().indexOf("/root") > -1 ? "/root/checker" : "D:\\OpenServer\\domains\\ppcagency"
require('dotenv').config({path: path.join(path2, `.env`)});
const moment = require('moment')

const letter = "E";

(async function () {
    //[process.env.SHEET1, process.env.SHEET2, process.env.SHEET3, process.env.SHEET4, process.env.SHEET5]

    for (let sheetUrl of [process.env.SPREADSHEET]) {
        const texts = []
        const s = new SheetHandler(sheetUrl);
        const arr = await s.getValues('Accounts')
        //console.log({token: arr[1][7], chat:arr[1][6]})
        //return
        const tabUpdate = []
        const logs = []
        const expireDates = []
        for (let [name, url, expire, ping, whois, ssl, token, chat] of arr.splice(1)) {
            if (url=='') continue
            if (url.includes('.net.ua')||url.includes('.kh.ua')||url.includes('.in.ua')||url.includes('.md')||url=='https://1ua.in/ua/') {
                expireDates.push([""])
                continue
            }
            let status = false
            let message = ""

            if (util.whoisCheck(expire)) {
                try {
                    const data = await util.getWhois(process.env.WHOIS, url)
                    status = data.status
                    message = data.message
                    expireDates.push([data.expire])
                } catch (e) {
                    console.log(e)
                    message = e.toString()
                }
            } else {
                expireDates.push([expire])
                message = 'Дата далеко перевірка не робилась'
                status = true
            }
            const curTime = moment().format('DD.MM.YYYY HH:mm');
            tabUpdate.push([curTime])
            logs.push([curTime, 'Whois', url, status?'OK':'ERROR',message])

            if (status) continue
            texts.push(`Проблема з Whois домена ${url}: ${message}`)
            //break;
            //await util.sendMessage(`Проблема з Whois домена ${url}: ${message}`, chat, token)
        }
        if (tabUpdate.length > 0) {
            await s.setValues('Accounts', tabUpdate, `${letter}2`)
            await s.setValues('Accounts', expireDates, `C2`)
            await s.addRows(logs, 'Logs')//.setValues('Accounts',tabUpdate,`${letter}2`)
        }
        if (texts.length>0){
            await util.sendMessage(texts.join("\n"), arr[1][7], arr[1][6])
        }
    }
})()

async function check(){
    return {status:false}
}

