//Author: Nicholas J D Dean
//Date created: 2016-12-06
const { URL } = require('url');
const https = require('https');

const wss = require('./websocket.js');
const baseURL = 'https://discordapp.com/api';
const botToken = 'Mzg3Nzk0NDU1OTkxOTQzMTg2.DQjtew.rRoDSZicamMk3mIrRZUdKgZgZTo';

let hearbeatIntervalObj;
let previousS = null;


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


//pretty print some data in a box
//with a title to the console.
function logData(title, data) {
    const length = 60;
    const tLength = title.length;

    const startPos = Math.floor((length / 2) - (tLength / 2));

    let headerString = '';

    //print header
    for (let i = 0; i < length; ++i) {
        if (i < startPos) {
            headerString += '=';
        } else if (i < startPos + tLength) {
            headerString += title[i - startPos];
        } else {
            headerString += '=';
        }
    }

    console.log(headerString);
    console.log(data);
    
    let footer = '';

    for (let i = 0; i < length; ++i) {
        footer += '_';
    }
    
    console.log(footer + '\n');
}



//Send a GET request to the API to retrieve a valid
//URL for the websocket connection
function requestValidWSEndpoint() {
    return new Promise((resolve, reject) => {
        const gatewayURL = new URL(baseURL + '/gateway/bot');

        gatewayURL.searchParams.append('token', botToken);
        
        //Get Gateway Bot
        https.get(gatewayURL, (res) => {
        
            if (res.statusCode != 200) {
                reject(res.statusCode);
            }

            res.on('data', (data) => {
                console.log("Received endpoint");
                let obj = JSON.parse(data.toString());
    
                resolve(obj);
            });
        }); 
    });
}



//construct a Gateway Opcode and have it sent
//to the server.
function sendOpcode(socket, op, d, s, t) {
    let obj = {
        op: op,
        d: d
    };

    if (s != undefined) {
        obj.s = s;
    }

    if (t != undefined) {
        obj.t = t;
    }

    console.log(`Sending OP ${op}: ${GatewayOpcodes[op]}`);

    socket.write(obj);
}



function handleDispatch(socket, dispatch) {

    console.log(`Dispatch event: ${dispatch.t}`);

    switch(dispatch.t) {
        case 'READY':
            //store the session id
            break;

        case 'GUILD_CREATE':
            //get the channel id
            break;

        case 'MESSAGE_CREATE':
            //send a reply
            break;
    }
}



function handleGatewayObject(socket, obj) {    

    console.log(`Received OP ${obj.op}: ${GatewayOpcodes[obj.op]}`)

    switch (obj.op) {
        case 0: //dispatch
            handleDispatch(socket, obj);
            break;

        case 9:
            socket.end();
            break;

        case 10: //Hello

            const interval = obj.d.heartbeat_interval;

            //create a function to be run every interval
            hearbeatIntervalObj = setInterval(() => { 
                //send a heartbeat
                sendOpcode(socket, 1, previousS)
            }, interval);

            console.log(`Heartbeat set to ${interval}ms`);

            //send the identify opcode
            sendOpcode(socket, 2, {
                token: botToken,
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
            break;
    }   
}



//Handle data received from the server
function handleData(socket, data) {

    //websocket opcodes
    switch(data.opcode) {
        case 0x1: //text frame
            //assume that a text frame is a Discord Gateway Dispatch
            //take the payload and handle it
            handleGatewayObject(socket, JSON.parse(data.payload));
            break;

        case 0x8: //connection close
            console.log('Disconnect frame received');
            break;

        default:
            console.log('Unhandled opcode received: ' + data.opcode);
            break;
    }    
}



async function connect() {
    console.log('Requesting endpoint...');
    const endpoint = await requestValidWSEndpoint();
    const socket = new wss(endpoint.url);

    console.log('Connecting socket...');

    socket.on('connected', () => {
        console.log('Socket connected');
    });

    socket.on('data', (data) => {
        handleData(socket, data);
    });

    socket.on('end', () => {
        console.log('Socket disconnected');
        clearInterval(hearbeatIntervalObj);
    })
}



connect();