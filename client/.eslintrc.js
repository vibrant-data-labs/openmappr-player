module.exports = {
    "rules": {
        "indent": [
            2,
            4
        ],
        // "quotes": [
        //     2,
        //     "double"
        // ],
        "linebreak-style": [
            2,
            "unix"
        ],
        "semi": [
            2,
            "always"
        ],
        "no-mixed-spaces-and-tabs": [
            2,
            "smart-tabs"
        ],
        "no-trailing-spaces": [2],
        "strict": [2, "function"],
        "no-console": [0]
    },
    "env": {
        "browser": true
    },
    "globals": {
        "d3": true,
        "_": true,
        "angular": true,
        "Snap": true,
        "sigma": true,
        "$": true
    },
    "extends": "eslint:recommended"
};