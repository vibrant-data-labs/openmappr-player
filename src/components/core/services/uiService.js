/**
* Provides different methods to show UI messages to the User
*/
angular.module('common')
.factory('uiService', [function() {
    "use strict";
    //http://bootstrap-growl.remabledesigns.com/

    /*************************************
    *************** API ******************
    **************************************/
    var API = {
        //notify
        log: function(message, persist, duration) {
            var timeout = persist ? 0 : duration ? duration : 1200;
            //console.log('timeout', timeout);
            return logIt(message, timeout, 'info');
        },
        logWarning: function(message, persist) {
            var timeout = persist ? 0 : 2000;
            return logIt(message, timeout, 'warning');
        },
        logSuccess: function(message, persist) {
            var timeout = persist ? 0 : 1200;
            return logIt(message, timeout, 'success');
        },
        logError: function(message, persist) {
            var timeout = persist ? 0 : 2000;
            return logIt(message, timeout, 'danger');
        },
        logUrl: function(message, url){
            return logUrl(message, url);
        },

        showProgress: logProgress,
        logProgress : logProgress,
        removeProgress :removeProgress,

        //user selections
        getPage: function(){
            return currentPage;
        },
        setPage: function(page){
            currentPage = page;
        }
    };



    /*************************************
    ********* Local Data *****************
    **************************************/
    var logNotif = null;
    var currentPage = '';
    var notificationPool = {};

    var notifDefaultOptions = {
        // notification options
        icon: null,
        title: null,
        message: 'Default message',
        url: null,
        target: '_blank'
    };

    var notifDefaultSettings = {
        // notification settings
        element: 'body',
        position: null,
        type: "info",
        allow_dismiss: true,
        newest_on_top: true,
        showProgressbar: false,
        placement: {
            from: "top",
            align: "left"
        },
        offset: 4,
        spacing: 10,
        z_index: 1099,
        delay: 5000,
        timer: 1000,
        url_target: '_blank',
        mouse_over: 'pause',
        animate: {
            enter: 'animate-fade',
            exit: 'animate-fade-right'
        },
        onShow: null,
        onShown: null,
        onClose: null,
        onClosed: null,
        icon_type: 'class',
        template: '<div data-notify="container" class="vert-align alert alert-{0}" role="alert">' +
            '<span data-notify="title">{1}</span> ' +
            '<h6 class="no-margin vert-align" data-notify="message">' +
            '<span data-notify="icon"></span> ' +
            '{2}</h5>' +
            '<div class="progress" data-notify="progressbar">' +
            '<div class="progress-bar progress-bar-{0}" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%;"></div>' +
            '</div>' +
            '<a href="{3}" target="{4}" data-notify="url"></a>' +
            '<button type="button" aria-hidden="true" class="pull-right" data-notify="dismiss">' +
            '<i class="fa fa-times toggle-icon fa-1-5x"></i>' +
            '</button>' +
            '</div>'
    };




    /*************************************
    ********* Core Functions *************
    **************************************/

    function logIt(message, timeOut, type) {
        logNotif = $.notify(
            // options
            _.assign(notifDefaultOptions, { message: message}),
            // settings
            _.assign(notifDefaultSettings, {type:type, delay: timeOut, timer: 1000, allow_dismiss: true, showProgressbar: false})
        );
        return logNotif;
    }

    function logUrl(message, url){
        logNotif = $.notify(
            // options
            _.assign(notifDefaultOptions, { message: message, url: url, target: '_blank'}),
            // settings
            _.assign(notifDefaultSettings, {type:'success'})
        );
        return logNotif;
    }


    function logProgress(taskid, message, type, amount){
        //if task progressbar already exists just update the notification object with new message
        if(notificationPool[taskid]){
            notificationPool[taskid].update({
                message: message,
                type: type,
                progress: amount
            });
        } else {
            //if task progressbar not found create a new notification object
            notificationPool[taskid] = $.notify(
                // options
                _.assign(notifDefaultOptions, { message: message}),
                // settings
                _.assign(notifDefaultSettings, {type:type, showProgressbar: true, timer: null, allow_dismiss: false, onClose: function(){delete notificationPool[taskid];}})
            );
        }

        if(amount >= 100){
            notificationPool[taskid].close();
        }
    }


    function removeProgress(taskId, message, type) {
        if(notificationPool[taskId]){
            notificationPool[taskId].close();
        }
        if(message) {
            logIt(message, 750, type);
        }
    }

    return API;
}
]);
