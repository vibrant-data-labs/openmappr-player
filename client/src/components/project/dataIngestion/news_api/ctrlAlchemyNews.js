angular.module('mappr')
.controller('AlchemyNews', ['$scope', '$q', 'alchemyNewsService', 'uiService',
function($scope, $q, alchemyNewsService, uiService) {
    'use strict';

    /*************************************
    ************ Local Data **************
    **************************************/
    var logPrefix = '[ctrlAlchemyNews: ] ';
    var currentDate = new Date();

    /*************************************
    ********* Scope Bindings *************
    **************************************/
    /**
    *  Scope data
    */
    $scope.ui = {
        queryRunning: false,
        maxItemCount: 3000
    };

    // Datepicker
    $scope.dp = {
        startDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
        endDate: currentDate,

        options: {
            'year-format': "'yy'",
            'starting-day': 1
        },

        startDateOpened: false,
        endDateOpened: false,

        openDatePicker: function(type) {
            if(type == 'start') {
                this.startDateOpened = true;
            }
            else if(type == 'end') {
                this.endDateOpened = true;
            }
        }
    };

    $scope.mentions = [
        {type: 'anywhere', text: 'anywhere'},
        {type: 'person', text: 'as a Person'},
        {type: 'city', text: 'as a City'},
        {type: 'company', text: 'as a Company'},
        {type: 'organisation', text: 'as an Organisation'}
    ];

    $scope.sentiments = ['Any', 'Positive', 'Negative', 'Neutral'];
    $scope.articleParts = ['Title', 'Body'];

    $scope.taxonomies = [
        'Any',
        'Art and Entertainment',
        'Automotive and Vehicles',
        'Business and Industrial',
        'Careers',
        'Education',
        'Family and Parenting',
        'Finance',
        'Food and Drink',
        'Health and Fitness',
        'Hobbies and Interests',
        'Home and Garden',
        'Law, Government and Politics',
        'News',
        'Pets',
        'Real Estate',
        'Religion and Spirituality',
        'Science',
        'Shopping',
        'Society',
        'Sports',
        'Style and Fashion',
        'Technology and Computing',
        'Travel'
    ];

    // Form options
    $scope.fo = {
        startTimestamp: 1000,
        endTimestamp: 5000,
        where: '',
        mentioned: _.find($scope.mentions, 'type', 'company'),
        sentiment: $scope.sentiments[$scope.sentiments.indexOf('Positive')],
        taxonomy: $scope.taxonomies[$scope.taxonomies.indexOf('Technology and Computing')],
        articlePart: $scope.articleParts[0],
        itemCount: 1000,
        apiKey: ''
    };

    /**
    * Scope methods
    */

    /*************************************
    ****** Event Listeners/Watches *******
    **************************************/

    /*************************************
    ********* Initialise *****************
    **************************************/
    $scope.mapProcessor.disableMainBtn();
    $scope.mapProcessor.childProcess = processRunQuery;

    // $scope.progressHandler.addProcesses([
    //  {processType: 'alchemyNews', message: 'Running News Query'}
    // ]);

    /*************************************
    ********* Core Functions *************
    **************************************/

    function processRunQuery() {
        var postObj = {
            startDate: ($scope.dp.startDate.getTime()/1000).toFixed(0),
            endDate: ($scope.dp.endDate.getTime()/1000).toFixed(0),
            queryText: $scope.fo.where,
            queryType: $scope.fo.mentioned.type,
            sentiment: $scope.fo.sentiment,
            taxonomyLabel: $scope.fo.taxonomy,
            itemCount: $scope.fo.itemCount,
            articlePart: 'Title',
            apiKey: $scope.fo.apiKey
        };

        if($scope.ui.queryRunning) {
            console.warn('Only 1 request can be made at a time');
            return $q.reject('OngoingRequest');
        }
        if(!$scope.alchemyNewsForm.$valid) {
            console.warn(logPrefix + 'invalid form');
            uiService.log('Form is invalid!');
            return $q.reject('Invalid Form');
        }
        $scope.ui.queryRunning = true;

        return alchemyNewsService.runQuery(postObj)
        .then(
            function(data) {
                console.log(logPrefix +'query successfull!');
                $scope.ui.queryRunning = false;
                console.log(data);
            },
            function(data) {
                var uiMsg = '';
                $scope.ui.queryRunning = false;
                if(data && data.result && data.result.status.toLowerCase() == 'error') {
                    switch(data.result.statusInfo.toLowerCase()) {
                    case 'invalid-api-key':
                        uiMsg = 'API Key is invalid!';
                        break;
                    default:
                        uiMsg = 'Query was unsuccessful!';
                    }
                }
                uiService.log(uiMsg);
                console.error(logPrefix, data);
                return $q.reject('SearchFailed');
            },
            function(progress) {
                console.log('[ctrlAlchemyNews: ] ', progress);
                // $scope.progressHandler.updateProgress('alchemyNews', Math.floor(parseInt(progress, 10)));
            }
        );
    }

    // function _updateTime(timeObj, dateObj) {
    //     timeObj.setFullYear(dateObj.getFullYear());
    //     timeObj.setMonth(dateObj.getMonth());
    //     timeObj.setDate(dateObj.getDate());
    // }

}
]);