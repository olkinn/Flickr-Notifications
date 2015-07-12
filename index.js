var notifier = require('node-notifier');
var path = require('path');
var request = require('request');
var async = require('async');

var BASE_URL = 'https://api.flickr.com/services/rest/';
var API_KEY = process.env.FLICKR_API_KEY;
var API_LIMIT = 3600; 
var USER_ID = process.env.FLICKR_USER_ID;

if(!API_KEY || !USER_ID){
    throw ("heey, where's your api key and user id?");
}

var getPhotosForUserId = function(userId, photoNumber, callback){
    var method = 'flickr.people.getPublicPhotos';
    var url = BASE_URL + '?method=' + method + '&api_key=' + API_KEY + '&user_id=' + userId + '&per_page=' + photoNumber + '&format=json&nojsoncallback=1';
    request(url, function (error, response, body) {
        var photoIds = JSON.parse(body).photos.photo.map(function (ph){
            return ph.id;
        });
        callback(photoIds);
    });
};

var getNumberOfFavs = function(photoId, callback){
    var method = 'flickr.photos.getFavorites';
    var url = BASE_URL + '?method=' + method + '&api_key=' + API_KEY + '&photo_id=' + photoId + '&format=json&nojsoncallback=1';
    request(url, function(error, response, body){
        if (response){
            callback(error, JSON.parse(body).photo.total);
        }
    });
};

var getNumberOfComments = function(photoId, callback){
    var method = 'flickr.photos.getInfo';
    var url = BASE_URL + '?method=' + method + '&api_key=' + API_KEY + '&photo_id=' + photoId + '&format=json&nojsoncallback=1';
    request(url, function(error, response, body){
        if (response){
            callback(error, JSON.parse(body).photo.comments._content);
        }
    });
};

var getAllFavs = function(idArray, callback){
    async.map(idArray, getNumberOfFavs, function(error, result){
        callback(result);
    });
};

var getAllComments = function(idArray, callback){
    async.map(idArray, getNumberOfComments, function(error, result){
        callback(result);
    });
};

var getFavsByUserId = function(userId, photoNumber, callback){
    getPhotosForUserId(userId, photoNumber, function(ids){
        getAllFavs(ids, function(favs){
            callback(favs);
        });
    });
};

var getCommentsByUserId = function(userId, photoNumber, callback){
    getPhotosForUserId(userId, photoNumber, function(ids){
        getAllComments(ids, function(comments){
            callback(comments);
        });
    });
};

var notify = function(message){
    notifier.notify({
        'title': 'Mac Flickr notification',
        'message': message,
        'icon': path.join(__dirname, 'logo.png'), // absolute path (not balloons)
        'sound': true, // Only Notification Center or Windows Toasters
        'wait': true // wait with callback until user action is taken on notification
    }, function (err, response) {
        // response is response from notification
    });

    notifier.on('click', function (notifierObject, options) {
        // Happens if `wait: true` and user clicks notification
    });

    notifier.on('timeout', function (notifierObject, options) {
        // Happens if `wait: true` and notification closes
    }); 
};

var checkFavs = function(userId, photoNumber, timeInterval){
    var previousFavs = [];
    var newFavs;
    
    setInterval(function(){
        getFavsByUserId(userId, photoNumber, function(favs){
            newFavs = favs;
            if (newFavs.toString() !== previousFavs.toString()){
                notify("Your photo has a new favorite!");
            }
            previousFavs = newFavs;
        });
    }, timeInterval);
};

var checkComments = function(userId, photoNumber, timeInterval){
    var previousComments = [];
    var newComments;

    setInterval(function(){
        getCommentsByUserId(userId, photoNumber, function(comments){
            newComments = comments;
            if (newComments.toString() !== previousComments.toString()){
                notify("Your photo has a new comment!");
            }
            previousComments = newComments;
        });
    }, timeInterval);
};

var checkForUpdates = function(userId, photoNumber, timeInterval){
    //API_LIMIT/2 because checkFavs works in parallel with checkComments
    //timeInterval/1000 because the timeInterval is in milliseconds
    if (2 * (photoNumber + 1) * (timeInterval/1000) > (API_LIMIT)) throw "whooa, not so many requests!";

    checkFavs(userId, photoNumber, timeInterval);
    checkComments(userId, photoNumber, timeInterval);
};

checkForUpdates(USER_ID, 20, 45000);
