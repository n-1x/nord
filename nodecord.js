//Author: Nicholas J D Dean
//Date created: 2017-12-06

const { URL } = require('url');
const https = require('https');
const wss = require('../snodesock/snodesock');

const baseURL = 'https://discordapp.com/api';

const GatewayOpcodes = {
    0: 'Dispatch',
    1: 'Heartbeat',
    2: 'Identify',
    3: 'Status Update',
    4: 'Voice State Update',
    5: 'Voice Server Ping',
    6: 'Resume',
    7: 'Reconnect',
    8: 'Request Guild Members',
    9: 'Invalid Session',
    10: 'Hello',
    11: 'Heartbeat ACK'
}


class DiscordBot {
    constructor(botToken) {
        this.token = botToken;
        this.socket = null;
        this.heartbeatIntervalObj = null;
        this.lastSequenceNum = null;
        this.hearbeatAcknowledged = null;
        this.sessionID = null;
        this.endpointURL = null;
        this.resuming = false;

        this.callbacks = {};
    }



    //Send a GET request to the API to retrieve a valid
    //URL for the websocket connection
    _requestValidWSEndpoint() {
        return new Promise((resolve, reject) => {
            const gatewayURL = new URL(baseURL + '/gateway/bot');

            gatewayURL.searchParams.append('token', this.token);
            
            //Get Gateway Bot
            https.get(gatewayURL, (res) => {
            
                if (res.statusCode != 200) {
                    reject(res.statusCode);
                }

                res.on('data', (data) => {
                    let obj = JSON.parse(data.toString());
        
                    resolve(obj);
                });
            });
        });
    }



    _heartbeat() {
        if (this.hearbeatAcknowledged === false) {
            console.log('No heartbeat ACK. Reconnecting...');
            
            this.reconnect();
        } else {
            //send a heartbeat
            this.hearbeatAcknowledged = false;
            this._sendOpcode(1, this.lastSequenceNum)
        }
    }



    _handleGatewayObject(obj) {         
        console.log(`Received OP ${obj.op}: ${GatewayOpcodes[obj.op]}`)
    
        switch (GatewayOpcodes[obj.op]) {
            case 'Dispatch':
                this.lastSequenceNum = obj.s;
                this._handleDispatch(obj.t, obj.d);
                break;

            case 'Heartbeat':
                this._heartbeat(this.lastSequenceNum);
                break;

            case 'Reconnect':
                this.reconnect();
                break;
    
            case 'Invalid Session':
                this.socket.end();
                break;
    
            case 'Hello':
                this._handleHello(obj.d.heartbeat_interval);
                break;

            case 'Heartbeat ACK':
                this.hearbeatAcknowledged = true;
                break;
        }   
    }



    _handleDispatch(dispatchName, data) {
        console.log(`Dispatch received: ${dispatchName}`);

        this._emitEvent(dispatchName, data);
    
        switch(dispatchName) {
            case 'READY':
                this.sessionID = data.session_id;
                break;

            case 'RESUMED':
                this.resuming = false;
                break;
        }
    }



    _handleHello(interval) {        
        //create a function to be run every interval
        //and store it in an object so that it can
        //be stopped in the future
        this.heartbeatIntervalObj = setInterval(() => { 
            this._heartbeat();
        }, interval);

        console.log(`Heartbeat set to ${interval}ms`);

        if (this.resuming === false) {
            //send OP 2: IDENTIFY
            this._sendOpcode(2, {
                token: this.token,
                properties: {},
                compress: false,
                large_threshold: 100,
                presence: {
                    status: "online",
                    game: {
                        name: "Waiting",
                        type: 1
                    }
                }
            });
        } else {
            //send OP 6: RESUME
            this._sendOpcode(6, {
                token: this.token,
                session_id: this.sessionID,
                seq: this.lastSequenceNum
            });
        }
    }



    //construct a Gateway Opcode and have it sent
    //to the server.
    _sendOpcode(op, d, s, t) {
        let obj = {
            op: op,
            d: d,
            s: s,
            t: t
        };

        console.log(`Sending OP ${op}: ${GatewayOpcodes[op]}`);

        this.socket.write(obj);
    }



    _emitEvent(eventName, param) {
        if (this.callbacks[eventName]) {
            this.callbacks[eventName](param);
        }
    }



    onEvent(eventName, callback) {
        this.callbacks[eventName] = callback;
    }

    

    reconnect() {
        this.resuming = true;
        this.hearbeatAcknowledged = null;
        this.connect();
    }



    async connect() {
        //Technically, this endpoint should be updated
        //even on a reconnect. But in practice I think it 
        //will never change, so only request on the first
        //connection to improve reconnect times,
        if (this.endpointURL === null) {
            console.log('Requesting endpoint...');
            const endpoint = await this._requestValidWSEndpoint();
            
            this.endpointURL = endpoint.url;
        }

        //if attempting to resume the connection, end the old one.
        if (this.resuming) {
            this.socket.socket.end();
        }

        console.log(`Connecting to '${this.endpointURL}'...`);

        this.socket = new wss(this.endpointURL);
    
        this.socket.on('data', (data) => {
            this._handleGatewayObject(JSON.parse(data));
        });
    
        this.socket.on('end', () => {
            console.log('Socket ended');
   
            clearInterval(this.heartbeatIntervalObj);
        });
    }



    sendMessage(channelID, content) {
        const endpoint = `/channels/${channelID}/messages`;
        const obj = {
            content: content
        }

        apiPost(this.token, endpoint, obj);
    }
}
module.exports = DiscordBot;



function apiPost(token, endpoint, data) {
    const url = new URL(baseURL + endpoint);
    const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bot ${token}`
        }
    }

    const req = https.request(options, res => {
        //nothing
    });

    req.write(JSON.stringify(data));
    req.end();
}