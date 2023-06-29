app.directive("visualize", function($rootScope){
  return {
    restrict: "A",
    link: function(scope, element){
      const ctx = element[0].getContext('2d');
      ctx.width = 350;
      ctx.height = 100;
      $rootScope.visor=ctx;
    }
  };
});

app.directive('backButton', function(){
  return {
    restrict: 'A',
    link: function(scope, element, attrs) {
      element.bind('click', goBack);
      function goBack() {
        history.back();
        scope.$apply();
      }
    }
  }
});

app.directive('input', function($timeout) {
  return {
    restrict: 'E',
    scope: {
      'returnClose': '=',
      'onReturn': '&',
      'onFocus': '&',
      'onBlur': '&'
    },
    link: function(scope, element, attr) {
      element.bind('focus', function(e) {
        if (scope.onFocus) {
          $timeout(function() {
            scope.onFocus();
          });
        }
      });
      element.bind('blur', function(e) {
        if (scope.onBlur) {
          $timeout(function() {
            scope.onBlur();
          });
        }
      });
      element.bind('keydown', function(e) {
        if (e.which == 13) {
          if (scope.returnClose) element[0].blur();
          if (scope.onReturn) {
            $timeout(function() {
              scope.onReturn();
            });
          }
        }
      });
    }
  }
});

app.directive('disabletap', function($timeout) {
  return {
    link: function() {
      $timeout(function() {
        container = document.getElementsByClassName('pac-container');
        // disable ionic data tab
        angular.element(container).attr('data-tap-disabled', 'true');
        // leave input field if google-address-entry is selected
        angular.element(container).on("click", function(){
            document.getElementById('type-selector').blur();
        });

      },500);

    }
  };
});

app.directive('currencyInput',['$locale', '$filter', function($locale, $filter) {
  // For input validation
  var isValid = function(val) {
    return angular.isNumber(val) && !isNaN(val);
  };
  // Helper for creating RegExp's
  var toRegExp = function(val) {
    var escaped = val.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    return new RegExp(escaped, 'g');
  };
val = val.replace(decimal, '').replace(group, '').replace(currency, '').trim();
  var toView = function(val) {
    return $filter('currency')(val);
  };
  var link = function($scope, $element, $attrs, $ngModel) {
    $ngModel.$formatters.push(toView);
    $ngModel.$parsers.push(toModel);
    $ngModel.$validators.currency = isValid;
    $element.on('keyup', function() {
      $ngModel.$viewValue = toView($ngModel.$modelValue);
      $ngModel.$render();
    });
  };
  return {
    restrict: 'A',
    require: 'ngModel',
    link: link
  };
}]);

app.service('sideMenuService', function($ionicSideMenuDelegate) {
    return {
      openSideMenu: function(menuhandle)
      {
        console.log('open menu');
        return $ionicSideMenuDelegate.$getByHandle(menuhandle).toggleRight();
      }
    };
  });

app.service('fileUploadService', function ($http, $q) {
    this.uploadFileToUrl = function (file, uploadUrl) {
        //FormData, object of key/value pair for form fields and values
        var fileFormData = new FormData();
        fileFormData.append('file', file);
        var deffered = $q.defer();
        $http.post(uploadUrl, fileFormData, {
            transformRequest: angular.identity,
            headers: {'Content-Type': undefined}

        }).success(function (response) {
            deffered.resolve(response);

        }).error(function (response) {
            deffered.reject(response);
        });
        return deffered.promise;
    };
});

// app.factory('$cordovaMedia', ['$q', function ($q) {
//   return {
//     newMedia: function (src,success,error,mediaStatus) { 
//       // var s=$sce.trustAsResourceUrl(src);
//       var media = new Media(src,success,error,mediaStatus);
//       return media;
//     },

//     getCurrentPosition: function (source) {
//       var q = $q.defer();
//       source.getCurrentPosition(function (success) {
//         q.resolve(success);
//       }, function (error) {
//         q.reject(error);
//       });
//       return q.promise;
//     },

//     getDuration: function (source) {
//       return source.getDuration();
//     },

//     play: function (source) {
//       source.play({ playAudioWhenScreenIsLocked : true })
//     },

//     pause: function (source) {
//       return source.pause();
//     },

//     release: function (source) {
//       return source.release();
//     },

//     seekTo: function (source, milliseconds) {
//       return source.seekTo(milliseconds);
//     },

//     setVolume: function (source, volume) {
//       return source.setVolume(volume);
//     },

//     startRecord: function (source) {
//       return source.startRecord();
//     },

//     stopRecord: function (source) {
//       return source.stopRecord();
//     },

//     setRate: function (source,rate) {
//       return source.setRate(rate);
//     },

//     stop: function (source) {
//       return source.stop();
//     }
//   };
// }]);
app.factory('Mic', function($rootScope, $ionicPopup, $timeout, MediaDevices) {
  let audioContext = new (AudioContext || window.AudioContext)();
  let mediaRec = null;

  function count_down() {
    if ($rootScope.recording) {
      $rootScope.timer = $rootScope.timer - 1;
      if ($rootScope.timer <= 0) {
        this.stop();
      } else {
        $timeout(function() {
          count_down();
        }, 1000);
      }
    }
  }

  function save_record(file) {
    console.log("Saving file........");
    $timeout(function() {
      $rootScope.file_added = true;
      $rootScope.file = file;
      $rootScope.file.lastModifiedDate = new Date();
      $rootScope.file.name = "castaway-" + $rootScope.file.lastModifiedDate + ".wav";
      $rootScope.post.file = $rootScope.file;
      var reader = new FileReader();
      reader.onload = function(event) {
        audioContext.decodeAudioData(event.target.result, function(buffer) {
          $rootScope.post.duration = buffer.duration;
          $rootScope.post.timeLeft = buffer.duration;
          console.log("The duration of the song is: " + $rootScope.post.duration + " seconds");
        }, function(e) {
          console.error("Could not decode saved file: " + e);
        });
      };
      reader.onerror = function(event) {
        console.error("An error occurred while reading the file: ", event);
      };
      reader.readAsArrayBuffer($rootScope.file);
      console.log($rootScope.post);
    }, 1000);
  }


  function startRecording() {
    const chunks = [];
    $rootScope.timer = 180;
    $rootScope.recording = true;
    const stop = this.stop;
    mediaRec = new MediaRecorder($rootScope.mediaStream);
    mediaRec.ondataavailable = function(e) {
      chunks.push(e.data);
    };
    mediaRec.onstop = function() {
      console.log("Stopped recording...");
      let file = new Blob(chunks, { 'type': 'audio/wav' });
      save_record(file);
    };
    mediaRec.onstart = function() {
      console.log("Microphone started!");
      count_down();
      $timeout(function() {
        stop();
      }, $rootScope.timer * 1000);
    };
    mediaRec.start();
  }

  return {
    rec: function() {
      const stop = this.stop;
      if ($rootScope.mediaStream) {
        startRecording();
      } else {
        MediaDevices.getUserMedia({ audio: true, video: false }).then(function(stream) {
          console.log("Microphone connected successfully........");
          $rootScope.mediaStream = stream;
          startRecording();
        }).catch(function(err) {
          $rootScope.recording = false;
          $rootScope.file_added = false;
          $ionicPopup.alert({ template: "Microphone failed to connect" });
          console.log(err);
          stop();
        });
      }
    },

    stop: function() {
      console.log("Stop................................");
      $rootScope.recording = false;
      $rootScope.messaging = false;
      if ($rootScope.source && $rootScope.source.stop) {
        $rootScope.source.stop();
      }
      
      // if ($rootScope.mediaStream) {
      //   $rootScope.mediaStream.getAudioTracks().forEach(function(track) {
      //     track.stop();
      //   });
      // }

      if (mediaRec) {
        mediaRec.stop();
      }
    
      $rootScope.post.filter = voice_filters[0];
    }
    
  };
});
