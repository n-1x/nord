//Author: Nicholas J D Dean

// Log levels
// 0  - none
// 1  - errors
// 2  - warnings
// 3  - general status info (connecting)
// 4  - full status info (connection successful) and dispatch events
// 5  - OP send and receives except heartbeat
// 6  - all OP send and receives

const WSS = require('../snodesock/snodesock');
const Discord = require('./Discord');

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



class Client extends Discord {
    constructor(token, isBot, logLevel = 0) {
        super(token, isBot, logLevel);

        this.shardCount = null;
        this.socket = null;

        //the object containing the current user. This can be set
        //when receiving the 'ready' dispatch, as that contains
        //a user object of the current user.
        this.me = null;

        //the object returned by the setInterval() call
        //for sending the heartbeat to the gateway. 
        //Needed to stop sending those calls.
        this.heartbeatIntervalObj = null;

        //the last sequence number received from the gateway
        //needed for resuming a session
        this.lastSequenceNum = null;

        //used for checking if a heartbeat was acknowledged
        //by the server when it's time to send a new one. If 
        //it wasn't then disconnect and attempt to resume.
        this.hearbeatAcknowledged = null;
        this.sessionID = null;

        //set to true while attempting to resume a connection
        //this will change what opcodes are send to identify
        //with the gateway 
        this.resuming = false;
        
        //the object that stores the callbacks registered
        //using the onDispatch function
        this.dispatchCallbacks = {};
        
        //character that indicates that the contents of a message
        //are a command
        this.commandChar = '!';

        //list of callback functions for commands, indexed by their
        //'command word'.
        this.commandCallbacks = {};

        //will hold the list of the full guild objects
        //that are received on a guild create event. These
        //objects contain more information than can be requested
        //through the API, so it's important to keep them.
        this.guilds = {};
        
        this.loga.level = logLevel;

        this._gatewayConnect();
    }
    
    
    
    _heartbeat() {
        if (this.hearbeatAcknowledged === false) {
            this.loga.warn('No heartbeat ACK. Reconnecting');
            
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
        this.loga.log(`Received OP ${obj.op}: ${opName}`, logLevel);
        
        switch (opName) {
            case 'Dispatch':
                this.lastSequenceNum = obj.s;
                this._handleDispatch(obj.t, obj.d);
                break;
            
            case 'Heartbeat':
                //if the server sends a heartbeat, send one back
                this._heartbeat(this.lastSequenceNum);
                break;
            
            case 'Reconnect':
                this.reconnect();
                break;
            
            case 'Invalid Session':
                //I think that by this point the socket
                //has already been closed by the server,
                //so socket.end won't exist, maybe    
                if (this.socket) {
                    this.socket.end();
                }
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
        this.loga.log(`Dispatch event: ${dispatchName}`, 4);
        
        this._emitEvent(dispatchName, data);
        
        switch(dispatchName) {
            case 'READY':
                this.sessionID = data.session_id;
                this.me = data.user;
                break;

            case 'GUILD_CREATE':
                this.guilds[data.id] = data;
                break;
            
            case 'MESSAGE_CREATE':
                const msg = data.content;
                //check for a command
                if (msg[0] === this.commandChar) {
                    //remove the commandChar
                    const command = msg.substr(1, msg.length - 1);
                    
                    //split the command by spaces to take the first word
                    const commandWord = command.split(' ')[0];
                    const firstSpace = command.indexOf(' ');
                    const len = command.length - firstSpace;
                    
                    //add 1 to remove the space after the command word
                    const restOfCommand = command.substr(firstSpace+1, len);
                    
                    this.loga.log(`Command received: ${commandWord}`);
                    
                    //callback with all the rest of the command
                    if (this.commandCallbacks[commandWord]) {
                        this.commandCallbacks[commandWord](restOfCommand, callback);
                    }                }
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
        
        this.loga.log(`Heartbeat set to ${interval}ms`);
        
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
                    game: null,
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
        this.loga.log(`Sending OP ${op}: ${GatewayOpcodes[op]}`, logLevel);
        
        this.socket.write(obj);
    }
    
    
    
    _emitEvent(eventName, param) {
        if (this.dispatchCallbacks[eventName]) {
            this.dispatchCallbacks[eventName](param);
        }
    }



    async _gatewayConnect() {
        this.loga.log('Requesting endpoint');
        const endpoint = this.isBot ? '/gateway/bot' : '/gateway';
        const gateway = await this.apiRequest('GET', endpoint);
        
        this.shardCount = gateway.shards;
        
        //if attempting to resume the connection, end the old one.
        if (this.resuming) {
            this.socket.socket.end();
        }
        
        this.loga.log(`Connecting to '${gateway.url}'`);
        
        this.socket = new WSS(gateway.url);
        
        this.socket.on('data', (data) => {
            this._handleGatewayObject(JSON.parse(data));
        });
        
        this.socket.on('end', () => {
            this.loga.log('End of socket');
            
            clearInterval(this.heartbeatIntervalObj);
        });
        
        this.socket.on('host_disconnect', (data) => {
            this.loga.error(`Socket disconnected by host. Reason: ${data}`);
        });
    }
    
    
    
    reconnect() {
        this.resuming = true;
        this.hearbeatAcknowledged = null;
        this._gatewayConnect();
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



    getCurrentUser() {
        if (this.me) {
            return this.me;
        } else {
            return super.apiRequest('GET', '/users/@me');
        }
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
    
    
    
    //send a message to the given channel
    sendMessage(channelID, content) {
        const obj = {
            content: content
        }
        
        super.apiRequest('POST', `/channels/${channelID}/messages`, obj);
    }
    
    
    
    async joinVoiceChannel(
        channelID,
        selfMute = false,
        selfDeaf = false
    ) {
        //get the channel object of the specified channel
//from the API.
        const channelObj = await apiGet(this.token, `/channels/${channelID}`);
        const guildID = channelObj.guild_id;
        
        if (channelObj) {
            if (channelObj.type === 2) {
                this._sendOpcode(4, {
                    guild_id: channelObj.guild_id,
                    channel_id: channelID,
                    self_mute: selfMute,
                    self_deaf: selfDeaf
                });   
            } else {
                this.loga.warning('joinVoiceChannel called on a non-voice channel');
            }
        } else {
            this.loga.warning('joinVoiceChannel called with an invalid channel ID')
        }           
    }



    //only needs a guildID because you can only be in one
    //voice channel in a guild.
    leaveVoiceChannel(guildID) {
        this._sendOpcode(4, {
            guild_id: guildID,
            channel_id: null,
            self_mute: false,
            self_deaf: false
        });
    }
}
module.exports = Client;