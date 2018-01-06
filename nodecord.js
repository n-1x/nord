/**
* Functions for generating objects that provide access to the API.
* For each secret key a new object should be created. The objects
* returned by [connect()]{@link connect} will each maintain
* their own connection to the gateway. Multiple objects should not 
* be created with the same key.
* @module Nodecord
* @author Nicholas J D Dean <nickdean.io>
*/

const Discord = require('./Discord');
const Client = require('./Client');

/**
 * Create an object with functions for accessing the Discord API. This
 * will not connect to the gateway, so some functions are missing.
 * @param {string} token - The authorization token to use for the requests. 
 */
function register(token) {
    return new Discord(token);
}

/**
 * Return an object that will create a connection to the gateway. This 
 * provides all the functionality of the object returned by 
 * [register()]{@link register}, but also maintains it's connection 
 * allows the use of methods that require the gateway or to have 
 * 'identified'.
 * @param {string} token - The authorization token to use for the requests.
 * @param {boolean} isBot - Is the client a bot.
 */
function connect(token, isBot = true) {
    return new Client(token, isBot);
}

module.exports = { register, connect }; 