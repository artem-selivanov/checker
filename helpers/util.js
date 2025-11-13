const axios = require("axios");
const tls = require('tls');
const { exec } = require('child_process');

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
    // apiKey оставляем в сигнатуре для совместимости, но не используем
    const domain = url
        .replace(/^https?:\/\//, '')
        .replace(/\/.*$/, '');

    let whoisOutput = null;

    // Простой ретрай на случай временного сбоя сети / whois-сервера
    for (let i = 1; i <= 3; i++) {
        try {
            whoisOutput = await execWhois(domain);
            break;
        } catch (error) {
            console.error({ domain });
            console.error('Error running whois:', error.toString());
            if (i === 3) {
                // после последней попытки — кидаем ошибку наверх или возвращаем статус
                return {
                    status: false,
                    message: 'Не вдалось отримати WHOIS для домену (whois помилка)',
                    expire: '',
                };
            }
            await sleep(5000); // как у тебя было
        }
    }

    if (!isRegistered(whoisOutput)) {
        return { status: false, message: 'Домен незареєстрований', expire: '' };
    }

    const expires = parseExpiryFromWhois(whoisOutput);

    if (!expires) {
        // Дата не найдена — зона скрывает или нестандартный формат
        return {
            status: true,
            message: 'WHOIS не містить явної дати закінчення домену',
            expire: '',
        };
    }

    if (whoisCheck(expires)) {
        return {
            status: false,
            message: `Домен треба продовжити до ${expires}`,
            expire: expires,
        };
    }

    return {
        status: true,
        message: `Все ок, дата закінчення терміну дії домену — ${expires}`,
        expire: expires,
    };
}

async function getWhoisOld(apiKey, url) {
    const domain = url
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "");


        let data = null
        for (let i = 1; i < 3; i++) {
            let response
            try {
            response = await axios.get(
                `https://api.jsonwhoisapi.com/v1/whois`,
                {
                    params: {identifier: domain},
                    headers: {
                        "Authorization": apiKey
                    }
                }
            );
            } catch (error) {
                console.error({domain})
                console.error("Error fetching WHOIS data:", error.toString());
                await sleep(30000)
                continue
            }
            data = response.data;
            console.log(data)
            if (!data.throttled) break;
            console.log(`throttled`)
            await sleep(120000)
            console.log(`Waited 60 sec`)
        }
        await sleep(10000)

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

function execWhois(domain) {
    return new Promise((resolve, reject) => {
        exec(`whois ${domain}`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                return reject(error);
            }
            resolve(stdout.toString());
        });
    });
}

function parseExpiryFromWhois(output) {
    const patterns = [
        /Registry Expiry Date:\s*([0-9T:\-\.Z ]+)/i,
        /Expiration Date:\s*([0-9T:\-\.Z ]+)/i,
        /Expiry Date:\s*([0-9T:\-\.Z ]+)/i,
        /paid-till:\s*([0-9T:\-\.Z ]+)/i,
        /expires:\s*([0-9T:\-\.Z ]+)/i,
    ];

    for (const re of patterns) {
        const m = output.match(re);
        if (m) {
            let raw = m[1].trim();

            // Попробуем привести к нормальной дате
            // Если Date её ест — вернём YYYY-MM-DD
            const d = new Date(raw);
            if (!isNaN(d.getTime())) {
                return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
            }

            // Популярный формат в .ru/.su: YYYY.MM.DD
            if (/^\d{4}\.\d{2}\.\d{2}$/.test(raw)) {
                return raw.replace(/\./g, '-'); // "YYYY-MM-DD"
            }

            // Если ничего не смогли — вернём как есть
            return raw;
        }
    }

    return null;
}

function isRegistered(output) {
    // Простейшая эвристика: если есть "No match" / "NOT FOUND" и т.п. — не зарегистрирован
    if (/No match for/i.test(output)) return false;
    if (/NOT FOUND/i.test(output)) return false;
    if (/Status:\s*free/i.test(output)) return false;
    return true;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

module.exports = {sendMessage, sslCheck, getWhois, whoisCheck}