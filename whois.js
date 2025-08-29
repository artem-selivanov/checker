const SheetHandler = require('./helpers/spreadsheet');
const util = require('./helpers/util');
const path = require('path');
const path2 = process.cwd().indexOf("/root") > -1 ? "/root/checker" : "D:\\OpenServer\\domains\\ppcagency"
require('dotenv').config({path: path.join(path2, `.env`)});
const moment = require('moment')

const s = new SheetHandler(process.env.SPREADSHEET);
const letter = "E";

(async function () {
    const arr = await s.getValues('Accounts')
    const tabUpdate=[]
    const logs=[]
    const expireDates = []
    for (let [name, url, expire, ping, whois, ssl, token, chat] of arr.splice(1)){
        let status = false
        let message = ""
        if (util.whoisCheck(expire)){
        try{
            const data = await util.getWhois(process.env.WHOIS,url)
            status = data.status
            message= data.message
            expireDates.push([data.expire])
        }
         catch (e) {
             console.log(e)
             message = e.toString()
         }
        } else {
            expireDates.push([expire])
            message='Дата далеко перевірка не робилась'
        }
        const curTime = moment().format('DD.MM.YYYY HH:mm');
        tabUpdate.push([curTime])
        logs.push([curTime,'Whois',url,message])
        if (status) continue
        await util.sendMessage(`Проблема з Whois домена ${url}: ${message}`,chat,token)
    }
    if (tabUpdate.length>0) {
        await s.setValues('Accounts',tabUpdate,`${letter}2`)
        await s.setValues('Accounts',expireDates,`C2`)
        await s.addRows(logs,'Logs')//.setValues('Accounts',tabUpdate,`${letter}2`)
    }
})()

async function check(){
    return {status:false}
}