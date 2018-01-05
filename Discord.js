//Author: Nicholas J D Dean

const { URL } = require('url');
const https = require('https');
const Loga = require('../loga/loga');

const baseURL = 'https://discordapp.com/api';

class Discord {
    constructor(token, isBot, logLevel = 0) {
        this.token = token;
        this.isBot = isBot;
        this.loga = new Loga();
    }



    apiRequest(method, endpoint, data = null) {
        const url = new URL(baseURL + endpoint);
        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': (this.isBot ? 'Bot ' : 'Bearer ') + this.token
            }
        }

        this.loga.log(`${method} ${endpoint}`, 4);

        return new Promise((resolve, reject) => {
            const req = https.request(options, res => {
                const code = res.statusCode;
                let data = null;

                res.on('data', chunk => {
                    if (!data) {
                        data = '';
                    }

                    data += chunk;
                });

                res.on('end', () => {
                    if (data) {
                        resolve(JSON.parse(data));
                    } else {
                        resolve(code);
                    }
                });
            }).on('error', err => {
                this.loga.error(`${method} failed. Error:\n${err}`);
            });
    
            if (data) {
                req.write(JSON.stringify(data));
            }
            req.end();
        });
    }



    getChannel(channelID, ignoreCache = false) {

    }



    getGuild(guildID, ignoreCache = false) {
        if (this.guilds[guildID] && !ignoreCache) {
            return this.guilds[guildID];
        } else {
            return apiGet(this.token, `/guilds/${guildID}`);
        }
    }
}
module.exports = Discord;