'use strict';

module.exports = {
    emailInput : element(by.model('credentials.email')),
    passwordInput : element(by.model('credentials.password')),
    loginBtn : element(by.css('[ng-click="auth.login()"]')),
    errorMsg : element(by.binding('message')),

    setEmail : function setEmail(email) {
        this.emailInput.clear();
        this.emailInput.sendKeys(email);
    },
    setPassword : function setPassword(password) {
        this.passwordInput.clear();
        this.passwordInput.sendKeys(password);
    },
    login : function login() {
        return this.loginBtn.click();
    }

};