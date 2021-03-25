/**
* Functions for generating objects that provide access to the API.
* For each secret key a new object should be created. The objects
* returned by [connect()]{@link connect} will each maintain
* their own connection to the gateway. Multiple objects should not 
* be created with the same key.
* @module nord
* @author Nicholas J D Dean <nickdean.io>
*/

const Discord = require('./util/Discord');
const Client = require('./util/Client');

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
function connect(token, intents, isBot = true) {
    return new Client(token, intents, isBot);
}

/**
 *  @property {number} GUILDS
 *  @property {number} GUILD_MEMBERS
 *  @property {number} GUILD_BANS
 *  @property {number} GUILD_EMOJIS
 *  @property {number} GUILD_INTEGRATIONS
 *  @property {number} GUILD_WEBHOOKS
 *  @property {number} GUILD_INVITES
 *  @property {number} GUILD_VOICE_STATES
 *  @property {number} GUILD_PRESENCES
 *  @property {number} GUILD_MESSAGES
 *  @property {number} GUILD_MESSAGE_REACTIONS
 *  @property {number} GUILD_MESSAGE_TYPING
 *  @property {number} DIRECT_MESSAGES
 *  @property {number} DIRECT_MESSAGE_REACTIONS
 *  @property {number} DIRECT_MESSAGE_TYPING
 */
const Intents = {
    GUILDS: 1 << 0,
    GUILD_MEMBERS: 1 << 1,
    GUILD_BANS: 1 << 2,
    GUILD_EMOJIS: 1 << 3,
    GUILD_INTEGRATIONS: 1 << 4,
    GUILD_WEBHOOKS: 1 << 5,
    GUILD_INVITES: 1 << 6,
    GUILD_VOICE_STATES: 1 << 7,
    GUILD_PRESENCES: 1 << 8,
    GUILD_MESSAGES: 1 << 9,
    GUILD_MESSAGE_REACTIONS: 1 << 10,
    GUILD_MESSAGE_TYPING: 1 << 11,
    DIRECT_MESSAGES: 1 << 12,
    DIRECT_MESSAGE_REACTIONS: 1 << 13,
    DIRECT_MESSAGE_TYPING: 1 << 14,
}

module.exports = { register, connect, Intents }; 