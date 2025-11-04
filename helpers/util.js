const axios = require("axios");
const tls = require('tls');

async function sendMessage(sendData, id, bot, parse_mode = 'Markdown') {
    const text = await Promise.resolve(sendData);
    //console.log('here')
    //50909827
    const data = {
        chat_id: id,
        parse_mode,
        text: text,
        disable_web_page_preview: true
    };
    await axios.post(`https://api.telegram.org/bot${bot}/sendMessage`, data)
        .then((res) => {
            //console.log(res)
        }).catch((err) => {
            console.error(err);
        });
}

async function sslCheck(url, port = 443) {
    const hostname = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    return new Promise((resolve, reject) => {
        const socket = tls.connect(
            {
                host: hostname,
                port: port,
                servername: hostname, // SNI support
                timeout: 5000,
            },
            () => {
                const cert = socket.getPeerCertificate();
                socket.end();

                if (!cert || !cert.valid_to) {
                    return reject(new Error('Не удалось получить сертификат'));
                }

                const now = new Date();
                const validFrom = new Date(cert.valid_from);
                const validTo = new Date(cert.valid_to);

                const result = {
                    hostname,
                    validFrom,
                    validTo,
                    status: now >= validFrom && now <= validTo,
                };

                resolve(result);
            }
        );

        socket.on('error', (err) => {
            reject(new Error(`Ошибка соединения: ${err.message}`));
        });

        socket.on('timeout', () => {
            socket.destroy();
            reject(new Error('Таймаут соединения'));
        });
    });
}

async function getWhois(apiKey, url) {
    const domain = url
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");

    try {
        let data = null
        for (let i = 1; i < 5; i++) {
            const response = await axios.get(
                `https://api.jsonwhoisapi.com/v1/whois`,
                {
                    params: {identifier: domain},
                    headers: {
                        "Authorization": apiKey
                    }
                }
            );
            data = response.data;
            console.log(data)
            if (!data.throttled) break;
            console.log(`throttled`)
            await sleep(60000)
            console.log(`Waited 60 sec`)
        }


        if (!data.registered) {
            return {status: false, message: "Домен незареєстрований", expire: ""};
        }

        if (whoisCheck(data.expires)) {
            return {
                status: false,
                message: `Домен треба продовжити до ${data.expires}`,
                expire: data.expires
            };
        }

        return {
            status: true,
            message: `Все ок, дата закінчення терміну дії домену — ${data.expires}`,
            expire: data.expires
        };

    } catch (error) {
        console.error("Error fetching WHOIS data:", error);
        return {
            status: false,
            message: error.toString(),
            expire: ""
        };
    }
}

function whoisCheck(date) {
    if (date == '') return true
    const targetDate = new Date(date);
    const now = new Date();

    const diffMs = targetDate - now;

    const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

    return diffMs <= oneMonthMs
    /*
// Проверка: остался ли месяц или меньше
    if (diffMs <= oneMonthMs && diffMs > 0) {
        console.log('Остался месяц или меньше до указанной даты.');
    } else if (diffMs <= 0) {
        console.log('Дата уже прошла.');
    } else {
        console.log('До даты больше месяца.');
    }*/

}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

module.exports = {sendMessage, sslCheck, getWhois, whoisCheck}