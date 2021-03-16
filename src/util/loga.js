class Loga {
    constructor(level = 0) {
        this.logLevel = level;
    }

    log(msg, level) {
        if (level <= this.logLevel) {
            console.log(msg);
        }
    }
    
    warn(msg, level) {
        if (level <= this.logLevel) {
            console.warn(msg);
        }
    }
    
    error(msg, level) {
        if (level <= this.logLevel) {
            console.error(msg);
        }
    }
}



module.exports = Loga;