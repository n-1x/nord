// Author: Nicholas J D Dean
// Date created: 2017-12-06
const Discord = require('./Discord');
const Client = require('./Client');
    
class Nodecord {
    static register(token, logLevel = 0) {
        return new Discord(token, logLevel);
    }

    static connect(token, isBot = true, logLevel = 0) {
        return new Client(token, isBot, logLevel);
    }
}
module.exports = Nodecord; 