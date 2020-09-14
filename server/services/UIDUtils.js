'use strict';
function generateShortUID6() {return ("000000" + (Math.random() * Math.pow(36, 6) << 0).toString(36)).slice(-6);}
function generateShortUID4() {return ("0000" + (Math.random() * Math.pow(36, 4) << 0).toString(36)).slice(-4);}
module.exports = {
    generateShortUID4: generateShortUID4,
    generateShortUID6: generateShortUID6
};