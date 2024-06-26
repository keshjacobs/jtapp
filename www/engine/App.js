const app = angular.module('justtalk', ['ionic', 'ngCordova', 'ngAnimate', 'ionic.native', 'lazy-scroll', 'ngStorage', 'ngFileUpload', 'plgn.ionic-segment'])
  .constant('Config', {  
    live: 'https://justtalkapp.com/',
    API: 'https://api.justtalkapp.com/user/',
    media: 'https://storage.googleapis.com/justtalkstorage/',
    google_token: "ya29.a0Aa4xrXNq1uZZnCWJldINks9YixQlWRmoukmqTSu0unOEtx6XN5bTahiCYUgvz2_L6cx2BeEtJ_4QfNAbp7m4_32Jy0kdVgyiN40FcnJiTJMhX5kDKINiLQ4tJA5d_oP4yb4YSjdToGtyxqjYekqHFVSg13I-aCgYKATASARISFQEjDvL9hQWIBrv6zkwRNvqXSq9Nag0163"
  })
  .config(function ($sceDelegateProvider, Config) {
    $sceDelegateProvider.resourceUrlWhitelist([
      'self',
      Config.API + '**',
      Config.live + '**',
      Config.media + '**'
    ]);
  })
  .constant('MediaDevices', navigator.mediaDevices || window.navigator.mediaDevices)
  .factory('socket', function ($rootScope, Config) {
    var socket = io(Config.live, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity
    });

    socket.on('connect', function () {
      console.log('connected');
    });

    return {
      on: function (eventName, callback) {
        socket.on(eventName, function () {
          var args = arguments;
          $rootScope.$apply(function () {
            callback.apply(socket, args);
          });
        });
      },
      emit: function (eventName, data, callback) {
        socket.emit(eventName, data, function () {
          var args = arguments;
          $rootScope.$apply(function () {
            if (callback) {
              callback.apply(socket, args);
            }
          });
        });
      }
    };
  });

// .config(['lazyImgConfigProvider', function(lazyImgConfigProvider){
//     var scrollable = document.querySelector('#scrollable');
//     lazyImgConfigProvider.setOptions({
//       offset: 100, // how early you want to load image (default = 100)
//       errorClass: 'error', // in case of loading image failure what class should be added (default = null)
//       successClass: 'success', // in case of loading image success what class should be added (default = null)
//       onError: function(image){}, // function fired on loading error
//       onSuccess: function(image){}, // function fired on loading success
//       container: angular.element(scrollable) // if scrollable container is not $window then provide it here
//     });
//   }]);