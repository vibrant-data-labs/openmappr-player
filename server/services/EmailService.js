'use strict';
var _            = require('lodash'),
    Promise      = require("bluebird"),
    fs           = require('fs'),
    nodemailer   = require('nodemailer'),
    sgMail       = require('@sendgrid/mail');
var config = require("./AppConfig").get();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

function sendFromSupport(to, sub, templateName, htmlData) {
    var logPrefix = '[EmailService: ] ';
    _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
    console.log(logPrefix + 'sending email');

    var templatePath = "./client/src/templates/email_templates/" + templateName + ".html",
        templateContent = fs.readFileSync(templatePath, "utf8"),
        compiledFn = _.template(templateContent),
        html = compiledFn(htmlData);

        return new Promise(function(resolve, reject) {
        var msg = {
            to: to,
            from: process.env.EMAIL_FROM,
            subject: sub,
            html: html,
        };
        sgMail.send(msg, (error, info) =>
            error ? reject(error) : resolve(info)
        )
    });
}

function sendSupportEmail(req, res) {
    var logPrefix = '[EmailService: ] ';
    _.templateSettings.interpolate = /{{([\s\S]+?)}}/g;
    console.log(logPrefix + 'sending email');
    return new Promise(function(resolve, reject) {
        var msg = {
            to: process.env.EMAIL_TO,
            from: process.env.EMAIL_FROM,
            subject: 'New Support Message',
            text: req.body.message,
            html: req.body.message,
        };
        sgMail.send(msg, (error, info) =>
            error ? reject(error) : resolve(info)
        )
      res.end()
    })
}


module.exports = {
    sendFromSupport: sendFromSupport,
    sendSupportEmail: sendSupportEmail
};
