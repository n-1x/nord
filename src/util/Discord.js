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
const Loga = require('./loga');

/** 
 * A class providing functions that send http requests
 * to the API and return either the data from the request or,`
 * for requests that return no data, the status code.
 * Does not connect to the gateway or provide functions
 * that require you to. Use the {@link Client} module for that.
 * @author Nicholas J D Dean <0x2a.re>
 */
class Discord {
    /**
     * Create an object that gives access to the API using
     * the given token.
     * @param {string} token - The secret token to use when interfacing with
     * the API.
     */
    constructor(token) {
        this.token = token;
        
        //the object that does the logging
        //turn off by setting loga.level to 0
        this.loga = new Loga(6);
    }
    
    
    /**
     * Send a request to the API.
     * @param {string} method - The HTTP method.
     * @param {string} endpoint - The endpoint starting with a '/'.
     * @param {Object} data - Any data that should be send with the request, e.g. post data.
     * @returns {Promise}
     * @private
    */    
    _apiRequest(method, endpoint, data = null) {
        const url = new URL('https://discord.com/api/v8' + endpoint);
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
                    //many requests don't return data, so just
                    //return the status codes if data is still null
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



    //********CHANNEL********\\
    /**
     * Get a channel by ID. The promise resolves to a channel object.
     * @param {string} channelID
     * @returns {Promise}
     */
    getChannel(channelID) {
        this._apiRequest()
        return this._apiRequest('GET', `/channels/${channelID}`);
    }

    /**
     * Update a channel's settings. Requires the 'MANAGE_CHANNELS' 
     * permission for the guild. Returns a channel on success, 
     * and a 400 BAD REQUEST on invalid parameters. Fires a Channel 
     * Update Gateway event. If modifying a category, individual Channel 
     * Update events will fire for each child channel that also changes. 
     * For the PATCH method, all the JSON Params are optional.
     * @param {string} channelID
     * @param {*} params - The properties of the channel to modify.
     * @returns {Promise}
     */
    modifyChannel(channelID, params) {
        return this._apiRequest('PATCH', `/channels/${channelID}`, params);
    }

    /**
     * Delete a channel, or close a private message. Requires the 
     * 'MANAGE_CHANNELS' permission for the guild. Deleting a category 
     * does not delete its child channels; they will have their parent_id
     * removed and a Channel Update Gateway event will fire for each of them.
     * Returns a channel object on success. Fires a Channel Delete Gateway
     * event.
     * @param {string} channelID
     * @returns {Promise}
     */
    deleteChannel(channelID) {
        return this._apiRequest('DELETE', `/channels/${channelID}`);
    }

    /**
     * Returns the messages for a channel. If operating on a guild channel,
     * this endpoint requires the 'VIEW_CHANNEL' permission to be present on
     * the current user. If the current user is missing the 
     * 'READ_MESSAGE_HISTORY' permission in the channel then this will return 
     * no messages (since they cannot read the message history). Returns an 
     * array of shardmessage objects on success.
     * @param {string} channelID
     * @returns {Promise}
     */
    async getChannelMessages(channelID) {
        return this._apiRequest('GET', `/channels/${channelID}/messages`);
    }

    /**
     * Returns a specific message in the channel. If operating on a guild
     * channel, this endpoints requires the 'READ_MESSAGE_HISTORY' permission
     * to be present on the current user. Returns a message object on success.
     * @param {string} channelID 
     * @param {string} messageID 
     * @returns {Promise}
     */
    async getChannelMessage(channelID, messageID) {
        return this._apiRequest('GET',
            `/channels/${channelID}/messages/${messageID}`);
    }


    async createMessage(channelID, message) {
        return this._apiRequest('POST', 
            `/channels/${channelID}/messages`, message);
    }

    /**
     * Create a reaction for the message.
     * This endpoint requires the 'READ_MESSAGE_HISTORY' permission 
     * to be present on the current user. Additionally, if nobody else
     * has reacted to the message using this emoji, this endpoint requires
     * the 'ADD_REACTIONS' permission to be present on the current user.
     * Returns a 204 empty response on success.
     * @param {string} channelID 
     * @param {string} messageID 
     * @param {string} emoji
     * @returns {Promise}
     */
    async createReaction(channelID, messageID, emoji) {
        return this._apiRequest('PUT', `/channels/${channelID}` + 
             `/messages/${messageID}/reactions/${emoji}/@me`);
    }

    /**
     * Delete a reaction the current user has made for the message.
     * Returns a 204 empty response on success.
     * @param {string} channelID 
     * @param {string} messageID 
     * @param {string} emoji 
     * @returns {Promise}
     */
    async deleteOwnReaction(channelID, messageID, emoji) {
        return this._apiRequest('DELETE', `/channels/${channelID}` + 
            `/messages/${messageID}/reactions/${emoji}/@me`);
    }

    /**
     * Deletes another user's reaction. 
     * This endpoint requires the 'MANAGE_MESSAGES' permission
     * to be present on the current user. Returns a 204 empty
     * response on success.
     * @param {string} channelID 
     * @param {string} messageID 
     * @param {string} userID 
     * @param {string} emoji 
     * @returns {Promise}
     */
    deleteUserReaction(channelID, messageID, userID, emoji) {
        return this._apiRequest('DELETE', `/channels/${channelID}` + 
            `/messages/${messageID}/reactions/${emoji}/${userID}`);
    }

    /**
     * Get a list of users that reacted with this emoji.
     * Returns an array of user objects on success.
     * @param {string} channelID 
     * @param {string} messageID 
     * @param {string} emoji 
     * @returns {Promise}
     */
    getReactions(channelID, messageID, emoji) {
        return this._apiRequest('GET', `/channels/${channelID}` + 
            `/messages/${messageID}/reactions/${emoji}`);
    }

    /**
     * Deletes all reactions on a message.
     * This endpoint requires the 'MANAGE_MESSAGES'
     * permission to be present on the current user.
     * @param {string} channelID 
     * @param {string} messageID 
     * @returns {Promise}
     */
    deleteAllReactions(channelID, messageID) {
        return this._apiRequest('DELETE', `/channels/${channelID}` + 
            `/messages/${messageID}`);
    }

    /**
     * Edit a previously sent message. 
     * You can only edit messages that have been sent by the current user.
     * Returns a message object. Fires a Message Update Gateway event.
     * @param {string} channelID 
     * @param {string} messageID
     * @param {Object} params - An object containing the properties to edit.
     * @returns {Promise}
     */
    editMessage(channelID, messageID, params) {
        return this._apiRequest('PATCH', 
            `/channels/${channelID}/messages/${messageID}`, { params });
    }

    /**
     * Delete a message. 
     * If operating on a guild channel and trying to delete a message 
     * that was not sent by the current user, this endpoint requires 
     * the 'MANAGE_MESSAGES' permission. Returns a 204 empty response on
     * success. 
     * Fires a Message Delete Gateway event.
     * @param {string} channelID 
     * @param {string} messageID
     * @returns {Promise}
     */
    deleteMessage(channelID, messageID) {
        return this._apiRequest('DELETE', 
            `/channels/${channelID}/messages/${messageID}`);
    }

    /**
     * Delete multiple messages in a single request.
     * This endpoint can only be used on guild channels and requires 
     * the 'MANAGE_MESSAGES' permission. 
     * Returns a 204 empty response on success. 
     * Fires multiple Message Delete Gateway events.
     * Any message IDs given that do not exist or are invalid will count
     * towards the minimum and maximum message count (currently 2 and 100
     * respectively). Additionally, duplicated IDs will only be counted once.
     * @param {string} channelID 
     * @param {array} messages - Array of message IDs.
     * @returns {Promise}
     */
    bulkDeleteMessages(channelID, messages) {
        return this._apiRequest('POST', 
        `/channels/${channelID}/messages/bulk-delete`, messages);
    }

    /**
     * Edit the channel permission overwrites for a user or role in a channel.
     * Only usable for guild channels. Requires the 'MANAGE_ROLES' permission.
     * Returns a 204 empty response on success.
     * 
     *<h5>Keys for the paramss Object</h5>
     *allow {integer} - The bitwise value of all allowed permissions.<br />
     *deny {integer} - The bitwise value of all denied permissions.<br />
     *type {string} - 'member' for a user or 'role' for a role.
     *
     * @param {string} channelID 
     * @param {string} overwriteID 
     * @param {Object} params
     * @returns {Promise}
     */
    editChannelPermissions(channelID, overwriteID, params) {
        return this._apiRequest('PUT', 
            `/channels/${channelID}/permissions/${overwriteID}`);
    }

    /**
     * Returns a list of invite objects (with invite metadata) for the 
     * channel. Only usable for guild channels. 
     * Requires the 'MANAGE_CHANNELS' permission.
     * @param {string} channelID
     * @returns {Promise}
     */
    getChannelInvites(channelID) {
        return this._apiRequest('GET', `/channels/${channelID}/invites`);
    }

    /**
     * Create a new invite object for the channel. Only usable for guild
     * channels. Requires the CREATE_INSTANT_INVITE permission. All JSON
     * paramaters for this route are optional. Returns an invite object.
     * <h5>Keys for params Object</h5>
     * max_age {integer} - Duration of invite in seconds before expiry, 
     * or 0 for never.<br />
     * max_uses {integer} - Max number of uses or 0 for unlimited.<br />
     * temporary {boolean} - whether this invite only grants temporary membership<br />
     * unique {boolean} - If true, don't try to reuse a similar invite 
     * (useful for creating many unique one time use invites)
     * @param {string} channelID 
     * @param {Object} params
     * @returns {Promise}
     */
    createChannelInvite(channelID, params = {}) {
        return this._apiRequest('POST', `/channels/${channelID}/invites`, 
            params);
    }

    deleteChannelPermission(channelID, overwriteID) {
        return this._apiRequest('DELETE', 
            `/channels/${channelID}/permissions/${overwriteID}`);
    }

    triggerTypingIndicator(channelID) {
        return this._apiRequest('POST', `/channels/${channelID}/typing`);
    }

    addPinnedChannelMessage(channelID, messageID) {
        return this._apiRequest('PUT',
            `/channels/${channelID}/pins/${messageID}`);
    }

    deletePinnedChannelMessage(channelID, messageID) {
        return this._apiRequest('DELETE', 
            `/channels/${channelID}/pins/${messageID}`);
    }

    groupDMAddRecipient(channelID, userID, params) {
        return this._apiRequest('PUT', 
            `/channels/${channelID}/recipients/${userID}`);
    }

    groupDMRemoveRecipient(channelID, userID) {
        return this._apiRequest('DELETE',
            `/channels/${channelID}/recipients/${userID}`);
    }



    //********EMOJI********\\
    /**
     * 
     * @param {string} guildID 
     */
    listGuildEmojis(guildID) {
        return this._apiRequest('GET', `/guilds/${guildID}/emojis`);
    }

    getGuildEmoji(guildID, emojiID) {
        return this._apiRequest('GET', `/guilds/${guildID}/emojis/${emojiID}`);
    }

    createGuildEmoji(guildID, params) {
        return this._apiRequest('POST', `/guilds/${guildID}/emojis`, params);
    }

    modifyGuildEmoji(guildID, emojiID, params) {
        return this._apiRequest('PATCH', `/guilds/${guildID}/emojis/${emojiID}`, params);
    }

    deleteGuildEmoji(guildID, emojiID) {
        return this._apiRequest('DELETE', `/guilds/${guildID}/emojis/${emojiID}`);
    }



    //********GUILD********\\

    getGuild(guildID) {
        return this._apiRequest('GET', `/guilds/${guildID}`);
    }

    /**
     * Returns a list of guild channel objects.
     * @param {string} guildID
     */
    getGuildChannels(guildID) {
        return this._apiRequest("GET", `/guilds/${guildID}/channels`);
    }

    /**
     * Returns a guild member object for the specified user.
     * @param {*} guildID 
     * @param {*} userID 
     */
    getGuildMember(guildID, userID) {
        return this._apiRequest("GET", `/guilds/${guildID}/members/${userID}`);
    }

    /**
     * Returns a list of role objects for the guild.
     * @param {*} guildID 
     * @returns 
     */
    getGuildRoles(guildID) {
        return this._apiRequest("GET", `/guilds/${guildID}/roles`);
    }



    //********INVITE********\\



    //********USER********\\
    


    //********VOICE********\\



    //********WEBHOOK*******\\
}
module.exports = Discord;