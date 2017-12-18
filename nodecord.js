// Author: Nicholas J D Dean
// Date created: 2017-12-06

// Log levels
// 0  - none
// 1  - errors
// 2  - warnings
// 3  - general status info (connecting)
// 4  - full status info (connection successful) and dispatch events
// 5  - OP send and receives except heartbeat
// 6  - all OP send and receives

const { URL } = require('url');
const https = require('https');
const wss = require('../snodesock/snodesock');
const Loga = require('../loga/loga');

const baseURL = 'https://discordapp.com/api';
const loga = new Loga();

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
    constructor(botToken, logLevel = 0) {
        this.token = botToken;
        this.shardCount = null;
        this.socket = null;
        this.heartbeatIntervalObj = null;
        this.lastSequenceNum = null;
        this.hearbeatAcknowledged = null;
        this.sessionID = null;
        this.endpointURL = null;
        this.resuming = false;

        //the object that stores the callbacks registered
        //using the onDispatch function
        this.dispatchCallbacks = {};

        this.commandChar = '!';
        this.commandCallbacks = {};

        loga.level = logLevel;
    }



    //Send a GET request to the API to retrieve a valid
    //URL for the websocket connection
    _getGatewayBot() {
        return new Promise((resolve, reject) => {
            const gatewayURL = new URL(baseURL + '/gateway/bot');

            gatewayURL.searchParams.append('token', this.token);
            
            //Get Gateway Bot
            https.get(gatewayURL, (res) => {
                const code = res.statusCode;

                if (code != 200) {
                    loga.error(`Endpoint request not okay. Status: ${code}`);
                    reject(res.statusCode);
                }

                res.on('data', (data) => {
                    let obj = JSON.parse(data.toString());
        
                    resolve(obj);
                });
            }).on('error', err => {
                loga.error('Endpoint request failed, check connection');
            });
        });
    }



    _heartbeat() {
        if (this.hearbeatAcknowledged === false) {
            loga.warn('No heartbeat ACK. Reconnecting');
            
            this.reconnect();
        } else {
            //send a heartbeat
            this.hearbeatAcknowledged = false;
            this._sendOpcode(1, this.lastSequenceNum)
        }
    }



    _handleGatewayObject(obj) {   
        const opName = GatewayOpcodes[obj.op];
        
        //Heartbeats clutter logs, so give them a higher level
        //allowing them to be specifically excluded
        const logLevel = opName === 'Heartbeat ACK' ? 6 : 5;
        loga.log(`Received OP ${obj.op}: ${opName}`, logLevel);
    
        switch (opName) {
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
        loga.log(`Dispatch event: ${dispatchName}`, 4);

        this._emitEvent(dispatchName, data);
    
        switch(dispatchName) {
            case 'READY':
                this.sessionID = data.session_id;
                break;

            case 'MESSAGE_CREATE':
                //check for a command
                if (data.content[0] === this.commandChar) {
                    //remove the commandChar
                    const command = data.content.substr(1, data.content.length - 1);

                    //split the command by spaces to take the first word
                    const commandWord = command.split(' ')[0];
                    const firstWordEnd = command.indexOf(' ');
                    const length = command.length - firstWordEnd;

                    //add 1 to remove the space after the command word
                    const restOfCommand = command.substr(firstWordEnd+1, length);

                    loga.log(`Command received: ${commandWord}`);

                    //callback with all the rest of the command
                    this.commandCallbacks[commandWord](restOfCommand, data);
                }

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

        loga.log(`Heartbeat set to ${interval}ms`);

        if (this.resuming === false) {
            //send OP 2: IDENTIFY
            this._sendOpcode(2, {
                token: this.token,
                properties: {},
                compress: false,
                large_threshold: 100,
                presence: { //status object
                    since: null,
                    status: "online",
                    game: {
                        name: "arpund",
                        type: 0
                    },
                    afk: false
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

        //Place heartbeats on a higher log level.
        const logLevel = GatewayOpcodes[op] === 'Heartbeat' ? 6 : 5;
        loga.log(`Sending OP ${op}: ${GatewayOpcodes[op]}`, logLevel);

        this.socket.write(obj);
    }



    _emitEvent(eventName, param) {
        if (this.dispatchCallbacks[eventName]) {
            this.dispatchCallbacks[eventName](param);
        }
    }



    //register a callback to be run whenever
    //the specified dispatch event is received
    //this will accept either format for the event
    //names
    onEvent(eventName, callback) {
        const eName = eventName.toUpperCase().replace(' ', '_');
        this.dispatchCallbacks[eName] = callback;
    }



    //register a callback to be run when a
    //specific command word is placed after
    //this.commandChar
    registerCommand(keyWord, callback) {
        this.commandCallbacks[keyWord] = callback;
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
            loga.log('Requesting endpoint');
            const endpoint = await this._getGatewayBot();
            
            this.endpointURL = endpoint.url;
            this.shardCount = endpoint.shards;
        }

        //if attempting to resume the connection, end the old one.
        if (this.resuming) {
            this.socket.socket.end();
        }

        loga.log(`Connecting to '${this.endpointURL}'`);

        this.socket = new wss(this.endpointURL);
    
        this.socket.on('data', (data) => {
            this._handleGatewayObject(JSON.parse(data));
        });
    
        this.socket.on('end', () => {
            loga.log('End of socket');
   
            clearInterval(this.heartbeatIntervalObj);
        });

        this.socket.on('host_disconnect', (data) => {
            loga.error(`Socket disconnected by host. Reason: ${data}`);
        });
    }



    //sends a status update object as
    //defined in the developer docs
    statusUpdate(status, game = null, since = null, afk = false) {
        this._sendOpcode(3, {
            since: since,
            game: game,
            status: status,
            afk: afk
        });
    }



    voiceStateUpdate(
        guildID,
        channelID,
        selfMute = false,
        selfDeaf = false
    ) {
        this._sendOpcode(4, {
            guild_id: guildID,
            channel_id: channelID,
            selfMute: selfMute,
            selfDeaf: selfDeaf
        });
    }



    //send a message to the given channel
    sendMessage(channelID, content) {
        const obj = {
            content: content
        }

        apiPost(this.token, `/channels/${channelID}/messages`, obj);
    }
}
module.exports = DiscordBot;



//send a post request to the given api endpoint.
//the discord api requires the token for these
//endpoints to be specified in an Authorization
//header.
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

    loga.log(`POST ${endpoint}`, 4);

    const req = https.request(options, res => {

        if (res.statusCode != 200) {
            loga.error(`POST failed. Status: ${res.statusCode}`);
        }
    });

    req.write(JSON.stringify(data));
    req.end();
}