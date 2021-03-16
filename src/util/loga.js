class Loga {
    constructor(level = 0) {
        this.logLevel = level;
    }

    log(msg, level = 0) {
        if (level <= this.logLevel) {
            console.log(msg);
        }
    }
    
    warn(msg, level = 0) {
        if (level <= this.logLevel) {
            console.warn(msg);
        }
    }
    
    error(msg, level = 0) {
        if (level <= this.logLevel) {
            console.error(msg);
        }
    }
}



module.exports = Loga;