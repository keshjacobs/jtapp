app.run(function (
  $ionicPlatform,
  Upload,
  socket,
  $cordovaFileTransfer,
  $cordovaFile,
  $cordovaSocialSharing,
  $cordovaDeeplinks,
  $ionicActionSheet,
  $http,
  Chat,
  $ionicModal,
  $ionicLoading,
  Config,
  $localStorage,
  $timeout,
  $location,
  $rootScope,
  $ionicHistory,
  $state,
  $ionicScrollDelegate,
  account,
  cast,
  $sce,
  $ionicPopup
) {
  $rootScope.media = Config.media;
  $rootScope.mediaStream = null;
  $rootScope.pages = 1;

  $rootScope.change_bar = function () {
    if (typeof StatusBar !== "undefined") {
      if (!$rootScope.settings.dark_mode) {
        StatusBar.styleDefault();
      } else {
        StatusBar.styleLightContent();
      }
    }
  };

  $rootScope.settings = {
    dark_mode: true,
    auto_dark: true,
  };

  $rootScope.settings.dark_mode = $localStorage.dark_mode || false;
  $rootScope.settings.auto_dark = $localStorage.auto_dark || true;

  $rootScope.prep = null;
  $rootScope.source = {};
  $rootScope.Music = {};
  $rootScope.AudioScope = null;
  $rootScope.AudioScope2 = null;
  $rootScope.saved_casts = [];
  $rootScope.library = [];
  $rootScope.messages = null;
  $rootScope.fetching_replies = false;
  $rootScope.det = { user_name: "" };
  $rootScope.voice_filters = voice_filters;
  $rootScope.songs = songs;
  $rootScope.notify = false;
  $rootScope.home_loader = false;
  $rootScope.msg_loading = true;
  $rootScope.casts_loading = false;
  $rootScope.timer = 180;
  $rootScope.mentions = [];
  $rootScope.t_id = null;
  $rootScope.cast = {};
  $rootScope.search_results = [];
  $rootScope.blocked = [];
  $rootScope.chat = {};
  $rootScope.profile = {};
  $rootScope.recording = false;
  $rootScope.messaging = false;
  $rootScope.device = {
    model: null,
    uuid: null,
    platform: null,
    serial: null,
  };

  $rootScope.mediaStream = null;
  $rootScope.mediaRec = null;

  $rootScope.fetching_cast = true;

  $rootScope.playlist = [];
  $rootScope.cast_replies = [];
  $rootScope.top_boys = [];
  $rootScope.track = 0;
  $rootScope.convo_track = 0;

  $rootScope.audio_events = function (action) {
    const message = JSON.parse(action).message;
    switch (message) {
      case "music-controls-next":
        if ($rootScope.playing_message) {
          $rootScope.next_message();
        } else {
          $rootScope.next_cast();
        }
        break;
      case "music-controls-previous":
        if ($rootScope.playing_message) {
          $rootScope.previous_message();
        } else {
          $rootScope.previous_cast();
        }
        break;
      case "music-controls-pause":
        $rootScope.pause_audio();
        break;
      case "music-controls-seek-to":
        const seekToInSeconds = JSON.parse(action).position;
        MusicControls.updateElapsed({
          elapsed: seekToInSeconds,
          isPlaying: true,
        });
        break;
      default:
        break;
    }
  };

  $ionicModal
    .fromTemplateUrl("pop-ups/record.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.record_box = modal;
    });

  $rootScope.pause_message = function () {
    if ($rootScope.chat) {
      if ($rootScope.playing_message) {
        $rootScope.playing_message.casting = false;
      }
      this.cast.casting = false;
      var casts = $rootScope.chat.conversations;
      if (casts) {
        for (var i = 0; i < casts.length; i++) {
          if (casts[i].casting) {
            casts[i].casting = false;
          }
        }
      }
    }
    $rootScope.playing_message = null;
    $rootScope.pause_audio();
  };

  $rootScope.preview = function (sound) {
    $rootScope.pause_audio();
    if (this.music.casting) {
      this.music.casting = false;
      if ($rootScope.Music) {
        $rootScope.Music.stop();
      }
    } else {
      for (var i = 0; i < $rootScope.songs.length; i++) {
        $rootScope.songs[i].casting = false;
      }
      this.music.casting = true;
      if ($rootScope.Music.stop) {
        $rootScope.Music.stop();
      }
      $rootScope.connect_music(sound, 0, 1);
    }
  };

  $rootScope.next_message = function () {
    console.log("next message....");
    $rootScope.pause_message();
    $timeout(function () {
      $rootScope.track = $rootScope.track + 1;
      if ($rootScope.playlist[$rootScope.track]) {
        $rootScope.play_message($rootScope.playlist[$rootScope.track]);
      }
    }, 1000);
  };

  $rootScope.PlayBar = function (audio_data) {
    try {
      // Delay creation of media controls
      $timeout(function () {
        if ($rootScope.MediaControls) {
          // Create media controls
          $rootScope.MediaControls.create({
            track: audio_data.title || audio_data.full_name, // Set the title of the audio track
            artist: audio_data.user_name, // Set the artist name
            isPlaying: true, // Set the initial playback state
          },()=> {
            console.log('MediaControls created successfully!');
        },()=> {
            console.error('Error creating MediaControls');
        });

          // Subscribe to media control events
          $rootScope.MediaControls.subscribe($rootScope.audio_events);

          // Listen for media control events
          $rootScope.MediaControls.listen();

          console.log("Media controls created and configured successfully.");
        } else {
          console.warn("MediaControls not available.");
        }
      }, 3000);
    } catch (error) {
      console.error("Error creating and configuring media controls:", error);
    }
  };

  $rootScope.play_audio = async function (audio) {
    var audioContext = new (AudioContext || window.AudioContext)();
    var audio_data = $rootScope.post;
    if ($rootScope.playing_message && $rootScope.playing_message.casting) {
      audio_data = $rootScope.playing_message;
    } else if ($rootScope.current_cast) {
      audio_data = $rootScope.current_cast;
    }
    if (!audio_data.timeLeft) {
      audio_data.timeLeft = audio_data.duration || 0;
    }
    var currenttime =
      parseInt(audio_data.duration) - parseInt(audio_data.timeLeft) || 1;

    try {
      const response = await fetch(audio);
      const audioData = await response.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(audioData);

      if (buffer) {
        var source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.type = "audio/wav";
        source.crossOrigin = "anonymous";
        source.connect(audioContext.destination);

        // Ended event listener
        source.onended = function () {
          console.log("Stopped track...");

          if ($rootScope.Music && $rootScope.Music.stop) {
            $rootScope.Music.stop();
            $rootScope.Music = undefined;
          }

          if (audio_data.timeLeft <= 1) {
            audio_data.timeLeft = audio_data.duration;

            if ($rootScope.playing_message) {
              $rootScope.next_message();
            } else {
              $rootScope.next_cast();
            }
          }
        };

        $rootScope.source = source;
        $rootScope.currentTime(audio_data);
        $rootScope.PlayBar(audio_data);
        $rootScope.source.started = true;
        $rootScope.source.start(0, currenttime);
        console.log("Audio playback started successfully.");

        if (audio_data.music) {
          $rootScope.connect_music(audio_data.music, currenttime, 0.2);
        }
      } else {
        console.log("Buffer not loaded!");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  $rootScope.connect_music = function (audio, ct, loudness) {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    var gainNodeL = audioContext.createGain();
    var music_source = audioContext.createBufferSource();
    $http
      .get(Config.media + audio, { responseType: "arraybuffer" })
      .success(function (bf) {
        audioContext.decodeAudioData(bf).then(function (buffer) {
          if (buffer) {
            music_source.buffer = buffer;
            music_source.crossOrigin = "anonymous";
            music_source.autoplay = true;
            music_source.connect(gainNodeL);
            gainNodeL.gain.value = loudness;
            gainNodeL.connect(audioContext.destination);
            if (music_source.start) {
              music_source.start(0, ct);
            } else if (music_source.play) {
              music_source.play(0, ct);
            } else if (music_source.noteOn) {
              music_source.noteOn(0, ct);
            }
            $rootScope.Music = music_source;
          }
        });
      });
  };

  $rootScope.pause_audio = function () {
    if ($rootScope.source.started) {
      $rootScope.source.started = false;
      $rootScope.source.stop();

      if ($rootScope.MediaControls) {
        $rootScope.MediaControls.updateIsPlaying(false);
      }
      if ($rootScope.Music.stop) {
        $rootScope.Music.stop();
      }
    }
  };

  $rootScope.unlock_media = function () {
    var audioContext = new (window.AudioContext || window.webkitAudioContext)();
    var source = audioContext.createBufferSource();
    var buffer = audioContext.createBuffer(1, 1, 22050);
    source.buffer = buffer;
    source.connect(audioContext.destination);

    if (source.start) {
      source.start(0);
    } else if (source.play) {
      source.play(0);
    } else if (source.noteOn) {
      source.noteOn(0);
    }

    source.stop();

    document.body.removeEventListener("click", $rootScope.unlock_media);
    document.body.removeEventListener("touchstart", $rootScope.unlock_media);
  };

  $rootScope.file = null;

  $rootScope.file_added = false;

  $rootScope.edit_cast = function (cast) {
    $rootScope.selected_cast = cast;
    $rootScope.mentions = cast.mentions;
    $state.go("edit_cast");
  };

  $rootScope.change_mode = function () {
    $localStorage.dark_mode = !$localStorage.dark_mode;
    $rootScope.settings.dark_mode = $localStorage.dark_mode;
    $timeout(function () {
      $rootScope.change_bar();
    }, 2000);
  };
  $rootScope.change_auto = function () {
    $localStorage.auto_dark = !$localStorage.auto_dark;
    $rootScope.settings.auto_dark = $localStorage.auto_dark;
  };

  $rootScope.cast_more = function (cast) {
    var buttons = [{ text: " Share to ..." }, { text: " Report this cast" }];
    var menu = {
      buttons: buttons,
      titleText: cast.title || cast.caster.user_name,
      cancelText: " Cancel",
      cancel: function () {
        return true;
      },
      buttonClicked: function (index) {
        if (index === 0) {
          $rootScope.share_cast(cast);
        }
        if (index === 1) {
          $rootScope.report_cast(cast);
        }
        if (cast.caster.t_id != $rootScope.t_id && index === 2) {
          $rootScope.remove_cast(cast);
        }
        if (cast.caster.t_id == $rootScope.t_id && index === 2) {
          $rootScope.edit_cast(cast);
        }
        return true;
      },
    };

    if (cast.caster.t_id != $rootScope.t_id) {
      buttons.push({ text: " Remove from timeline" });
    } else {
      buttons.push({ text: " Edit cast" });
      menu.destructiveText = " Delete cast";
      menu.destructiveButtonClicked = function () {
        $rootScope.delete_cast(cast);
        return true;
      };
    }
    $ionicActionSheet.show(menu);
  };

  $rootScope.use_voice = function (voice) {
    $rootScope.pause_cast();
    $rootScope.post.filter = voice;
    $rootScope.voice_box.hide();
  };

  $rootScope.use_music = function (song) {
    if ($rootScope.Music.stop) {
      $rootScope.Music.stop();
    }
    $rootScope.pause_cast();
    $rootScope.post.music = song.src;
    $rootScope.selected_music = song;
    $rootScope.music_box.hide();
  };

  $rootScope.cast_status = function (c) {
    if (c) {
      if (!c.expired) {
        if ($rootScope.user) {
          var user_id = $rootScope.t_id;
          var caster = null;
          if (c.caster) {
            caster = c.caster;
          } else {
            caster = c.user;
          }
          if (caster) {
            if (caster.t_id == user_id) {
              return "played_cast";
            } else {
              if (c.listens) {
                var y = c.listens.findIndex(function (l) {
                  return l.t_id == user_id || l == $rootScope.user._id;
                });
                if (y > -1) {
                  return "played_cast";
                } else {
                  return "unplayed_cast";
                }
              } else {
                return "unplayed_cast";
              }
            }
          } else {
            return "button-oran";
          }
        } else {
          return "played_cast";
        }
      } else {
        return "expired_cast";
      }
    }
  };

  $rootScope.randy = function (min, max) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  };

  $rootScope.play_status = function (c) {
    if (c) {
      if ($rootScope.user) {
        var user_id = $rootScope.t_id;
        var caster = null;
        if (c.caster) {
          caster = c.caster;
        } else {
          caster = c.user;
        }
        if (caster) {
          if (caster.t_id == user_id) {
            return "button-played";
          } else {
            if (c.listens) {
              var y = c.listens.findIndex(function (l) {
                return l.t_id == user_id || l == $rootScope.user._id;
              });
              if (y > -1) {
                return "button-played";
              } else {
                return "button-oran";
              }
            } else {
              return "button-oran";
            }
          }
        } else {
          return "button-oran";
        }
      } else {
        return "button-played";
      }
    } else {
      return "button-oran";
    }
  };

  $rootScope.has_played = async function (c) {
    if (c) {
      if ($rootScope.user) {
        var user_id = $rootScope.user._id || 0;
        if (c.caster) {
          if (c.caster._id == user_id) {
            if (c.played) {
              return false;
            } else {
              return false;
            }
          } else if (c.listens) {
            var y = c.listens.findIndex(function (l) {
              return l == user_id;
            });
            if (c.listens[y]) {
              return false;
            } else {
              return true;
            }
          } else {
            return true;
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  };

  $ionicModal
    .fromTemplateUrl("pop-ups/music.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.music_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/voices.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.voice_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/mention.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.mention_box = modal;
    });

  $rootScope.broadcasting = function () {
    $ionicLoading.show({
      templateUrl: "components/broadcasting.html",
    });
  };

  $rootScope.saving = function () {
    $ionicLoading.show({ template: "saving..." });
  };

  $rootScope.show = function () {
    $ionicLoading.show({
      templateUrl: "components/loading.html",
    });
  };

  $rootScope.hide = function () {
    $rootScope.$broadcast("scroll.refreshComplete");
    $rootScope.$broadcast("scroll.infiniteScrollComplete");
    $ionicLoading.hide();
  };

  $ionicModal
    .fromTemplateUrl("pop-ups/air_cast.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.aircast_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/auth.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.auth_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/listeners.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.listen_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/search.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.search_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/reply.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.reply_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/start.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.start_box = modal;
    });

  $ionicModal
    .fromTemplateUrl("pop-ups/recast.html", {
      scope: $rootScope,
      animation: "slide-in-up",
    })
    .then(function (modal) {
      $rootScope.recast_box = modal;
    });

  $rootScope.remove_account = function () {
    $timeout(function () {
      $rootScope.user = null;
      $localStorage.t_id = null;
      $rootScope.t_id = null;
      $localStorage.chats = null;
      $localStorage.user = null;
      $rootScope.chats = null;
      $rootScope.user = null;
      $state.go("front.talk");
    }, 1000);
  };

  $rootScope.chat_update = function (chat) {
    $rootScope.show();
    var data = {
      title: chat.title,
      chat_id: chat._id,
    };
    Chat.update(data)
      .success(function (Data) {
        if (Data.status == true) {
          $rootScope.get_messages();
          $rootScope.get_chat(chat._id);
        }
        $rootScope.hide();
      })
      .error(function () {
        $rootScope.hide();
        $ionicPopup.alert({
          template: "network error.",
        });
      });
  };

  $rootScope.get_library = function () {
    if ($rootScope.user) {
      cast
        .saved($rootScope.user._id)
        .success(function (Data) {
          $rootScope.hide();
          if (Data.status == true) {
            $rootScope.saved_casts = Data.data;
          }
        })
        .error(function () {
          $rootScope.hide();
        });
    }
  };

  $rootScope.filterReplies = function (item) {
    if (item.reply != null) {
      return item;
    }
  };

  $rootScope.filterRecasts = function (item) {
    if (item.recast) {
      return item;
    }
  };

  $rootScope.search_mention = function (key) {
    account.search_mention(key).success(function (Data) {
      if (Data.status == true) {
        $rootScope.user_results = Data.data;
      }
    });
  };

  $rootScope.refresh_profile = function () {
    if ($localStorage.t_id) {
      var id = $localStorage.t_id;
      $rootScope.t_id = id;
      $rootScope.fetching_casts = true;
      $timeout(function () {
        account
          .info(id)
          .success(function (Data) {
            $rootScope.hide();
            if (Data.status == true) {
              $rootScope.user = Data.data;
              $localStorage.user = Data.data;
              $rootScope.blocked = $rootScope.user.block_list;
              account.casts(id).success(function (Data) {
                $rootScope.fetching_casts = false;
                if (Data.status == true) {
                  $rootScope.my_casts = Data.data;
                }
              });
            }
          })
          .error(function () {
            $rootScope.fetching_casts = false;
            $rootScope.hide();
          });
      }, 2000);
    }
  };

  $rootScope.downloadAudioFile = async function (url, path) {
    if (!window.cordova) {
      return url;
    }
    if (!window.cordova.file) {
      return url;
    }
    var filePath = window.cordova.file.dataDirectory + path;
    try {
      await $cordovaFile.createDir(cordova.file.dataDirectory, "casts", true);
      var result = await $cordovaFileTransfer.download(url, filePath, {}, true);
      console.log("File downloaded:", result.toURL());
      return result.toURL() || url;
    } catch (error) {
      console.error("Error downloading file:", error);
      return url;
    }
  };

  $rootScope.account_update = function (profile) {
    if (profile) {
      if ($localStorage.pushtoken) {
        profile.pushtoken = $localStorage.pushtoken;
      }
      profile.t_id = $rootScope.t_id;
      account
        .update(profile)
        .success(function (Data) {
          if (Data.status == true) {
            $rootScope.refresh_profile();
          } else {
            $rootScope.hide();
          }
        })
        .error(function () {
          $rootScope.hide();
        });
    }
  };

  $rootScope.refresh_profile();

  $rootScope.select_user = function (user) {
    $rootScope.show();
    $state.go("confirm_request");
    $timeout(function () {
      $rootScope.selected_user = user;
      if ($rootScope.chat) {
        console.log("in chat");
        $rootScope.selected_user.title = $rootScope.chat.title;
      } else {
        console.log("out chat");
      }
      $rootScope.hide();
    }, 1000);
  };

  $rootScope.censor = function (str) {
    var bad_words = ["kill", "die", "murder", "death"];
    for (var i = 0; i != bad_words.length; i++) {
      var word = bad_words[i];
      if (str.indexOf(word) != -1) {
        return false;
      }
    }
    return true;
  };

  $rootScope.search = function (key) {
    $rootScope.search_loading = true;
    account.search(key).success(function (Data) {
      $rootScope.search_loading = false;
      if (Data.status == true) {
        $rootScope.user_results = Data.users;
        $rootScope.cast_results = Data.casts;
        $rootScope.search_results =
          $rootScope.cast_results.length + $rootScope.user_results.length;
      }
    });
  };

  $rootScope.dropall = function () {
    $rootScope.chat_detail_box.hide();
  };

  $rootScope.update_chat = function (chat) {
    if (chat) {
      Chat.update(chat).success(function () {
        $rootScope.chat_detail_box.hide();
      });
    }
  };

  $rootScope.get_chat = function (id) {
    $rootScope.msg_loading = true;
    $rootScope.pause_message();
    $rootScope.sink();
    Chat.info(id)
      .success(function (Data) {
        $rootScope.hide();
        if (Data.status == true) {
          $rootScope.chat = Data.data;
          $rootScope.chat.conversations = expire_messages(
            $rootScope.chat.conversations
          );
          $rootScope.messaging = false;
          $rootScope.msg_loading = false;
        } else {
          $rootScope.messaging = [];
        }
        $rootScope.sink();
        $rootScope.messages = $rootScope.chat.conversations;
      })
      .error(function () {
        $rootScope.sink();
        $rootScope.hide();
        $rootScope.messages = $rootScope.chat.conversations;
      });
  };

  $rootScope.open_listens = function (listeners) {
    $rootScope.listeners = listeners;
    $rootScope.listen_box.show();
  };

  $rootScope.open_cast = function (cast) {
    $rootScope.cast = cast;
    $rootScope.search_box.hide();
    $state.go("cast");
    $timeout(function () {
      $rootScope.cast.casting = true;
      $rootScope.refresh_cast(cast._id);
    }, 100);
  };

  $rootScope.float = function () {
    $timeout(function () {
      $ionicScrollDelegate.scrollTop();
    }, 500);
  };

  $rootScope.sink = function () {
    $timeout(function () {
      $ionicScrollDelegate.scrollBottom();
    }, 500);
  };

  $rootScope.open_chat = function (chat) {
    if (chat) {
      $rootScope.pause_cast();
      $rootScope.chat = chat;
      $state.go("chat");
      $rootScope.sink();
      $timeout(function () {
        $rootScope.get_chat(chat._id);
      }, 1000);
    }
  };

  $rootScope.message_user = function (user) {
    if ($rootScope.chats) {
      $rootScope.chat = null;
      for (var i = 0; i < $rootScope.chats.length; i++) {
        var chat = $rootScope.chats[i];
        if (chat.members) {
          var index = chat.members.findIndex(function (m) {
            return m.user._id == user._id;
          });
          if (index >= 0) {
            $rootScope.chat = chat;
          }
        }
      }
      if ($rootScope.chat) {
        $timeout(function () {
          $rootScope.open_chat($rootScope.chat);
        }, 1000);
      } else {
        $timeout(function () {
          $rootScope.select_user(user);
        }, 1000);
      }
    }
  };

  $rootScope.block_user = function (user) {
    $rootScope.blocked = [];
    $rootScope.blocked.push(user.t_id);
    if ($rootScope.t_id) {
      var data = {
        t_id: user.t_id,
        blocker: $rootScope.t_id,
      };
      account
        .block(data)
        .success(function (Data) {
          $rootScope.new_feed();
          if (Data.status == true) {
            $rootScope.refresh_profile();
          } else {
            $rootScope.hide();
          }
        })
        .error(function () {
          $rootScope.hide();
        });
    }
  };

  $rootScope.restricted = function (user) {
    if (user.block_list) {
      if (user.block_list.length > 0 && $rootScope.t_id) {
        if (user.block_list.indexOf($rootScope.t_id) >= 0) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } else {
      return false;
    }
  };

  $rootScope.unblock_user = function (user) {
    $rootScope.blocked.splice($rootScope.blocked.indexOf(user.t_id), 1);
    if ($rootScope.t_id) {
      var data = {
        t_id: user.t_id,
        blocker: $rootScope.t_id,
      };
      account
        .unblock(data)
        .success(function (Data) {
          if (Data.status == true) {
            $rootScope.refresh_profile();
            $rootScope.new_feed();
          } else {
            $rootScope.hide();
          }
        })
        .error(function () {
          $rootScope.hide();
        });
    }
  };

  $rootScope.like_cast = function (c) {
    if ($rootScope.user) {
      if ($rootScope.user) {
        if (c.likes) {
          if ($rootScope.liked(c)) {
            c.likes.splice(c.likes.indexOf($rootScope.user._id), 1);
            cast.unlike({
              cast_id: c._id,
              t_id: $localStorage.t_id,
              _id: $rootScope.user._id,
            });
          } else {
            c.likes.push($rootScope.user._id);
            cast.like({
              cast_id: c._id,
              _id: $rootScope.user._id,
              t_id: $localStorage.t_id,
            });
            $rootScope.toast(
              "you liked " + c.caster.user_name + "'s cast",
              true
            );
          }
        }
      }
    } else {
      $rootScope.auth_box.show();
    }
  };

  $rootScope.liked = function (c) {
    var value = false;
    if ($rootScope.user) {
      if (c) {
        if (c.likes) {
          var x = c.likes.findIndex(function (l) {
            return l == $rootScope.user._id;
          });
          if (x >= 0) {
            value = true;
          }
        }
      }
    }
    return value;
  };

  $rootScope.is_blocked = function (user) {
    var value = false;
    if ($rootScope.blocked) {
      var m = $rootScope.blocked.findIndex(function (sub) {
        return sub == user.t_id;
      });
      if (m >= 0) {
        value = true;
      }
    }
    return value;
  };

  $rootScope.subscribed = function (user) {
    var value = false;
    if ($rootScope.user) {
      var m = $rootScope.user.subscriptions.findIndex(function (sub) {
        return sub == user._id || sub._id == user._id;
      });
      if (m >= 0) {
        value = true;
      }
    }
    return value;
  };

  $rootScope.in_sub = function (user) {
    var value = false;
    if ($rootScope.user) {
      var m = user.subscriptions.findIndex(function (sub) {
        return sub == $rootScope.user._id;
      });
      if (m >= 0) {
        value = true;
      }
    }
    return value;
  };

  $rootScope.mentioned = function (user) {
    var value = false;
    var m = $rootScope.mentions.findIndex(function (sub) {
      return sub._id == user._id;
    });
    if (m >= 0) {
      value = true;
    }
    return value;
  };

  $rootScope.start_talk = function () {
    $rootScope.clear();
    $rootScope.pause_cast();
    $rootScope.post = {};
    $rootScope.record_box.show();
  };

  $rootScope.add_mention = function (user) {
    if (!$rootScope.mentioned(user)) {
      $rootScope.mentions.push(user);
      $rootScope.mention_box.hide();
    }
  };

  $rootScope.remove_mention = function (user) {
    if ($rootScope.mentioned(user)) {
      var x = $rootScope.mentions.findIndex(function (m) {
        return m == user._id;
      });
      $rootScope.mentions.splice(x, 1);
    }
  };

  $rootScope.recasted = function (c) {
    var value = false;
    if ($localStorage.t_id) {
      if (c) {
        if ($rootScope.my_casts) {
          var x = $rootScope.my_casts.findIndex(function (cast) {
            if (cast.recast) {
              return cast.recast._id == c._id;
            }
          });
          if (x >= 0) {
            value = true;
          }
        }
      }
    }
    return value;
  };

  $rootScope.replied = function (c) {
    var value = false;
    if ($localStorage.t_id) {
      if (c) {
        if (c.replies) {
          if ($rootScope.my_casts) {
            if ($rootScope.my_casts.length > 0) {
              var x = $rootScope.my_casts.findIndex(function (cast) {
                if (cast.reply) {
                  return cast.reply._id == c._id;
                }
              });
              if (x >= 0) {
                value = true;
              }
            }
          }
        }
      }
    }
    return value;
  };

  $rootScope.subscribe = function (id) {
    if ($localStorage.t_id) {
      if ($rootScope.user.subscriptions.indexOf(id) >= 0) {
        $rootScope.user.subscriptions.splice(
          $rootScope.user.subscriptions.indexOf(id),
          1
        );
        account.unsubscribe({
          user_id: id,
          t_id: $rootScope.user.t_id,
        });
      } else {
        $rootScope.user.subscriptions.push(id);
        account.subscribe({
          user_id: id,
          t_id: $rootScope.user.t_id,
        });
      }
    }
  };

  $rootScope.save_cast = function (cast) {
    $rootScope.saving();
    var uploadUrl = Config.API + "cast/save";
    cast.t_id = $rootScope.t_id;
    cast.caster = $rootScope.user._id;
    cast.file = $rootScope.file;
    cast.date_created = new Date();
    cast.mentions = $rootScope.mentions;
    cast.mentions = [];
    if ($rootScope.mentions.length > 0) {
      for (var i = 0; i < $rootScope.mentions.length; i++) {
        cast.mentions.push($rootScope.mentions[i]._id);
      }
    }
    cast.mentions = JSON.stringify(cast.mentions);
    cast.filter = JSON.stringify(cast.filter);
    Upload.upload({
      url: uploadUrl,
      data: cast,
    }).then(function (resp) {
      $rootScope.get_library();
      $state.go("front.library");
      if (resp.data.status == true) {
        $timeout(function () {
          $rootScope.hide();
          $rootScope.record_box.hide();
          $rootScope.recast_box.hide();
          $rootScope.reply_box.hide();
          $rootScope.toast("saved!", true);
          $rootScope.pause_cast();
          $rootScope.clear();
        }, 3000);
      }
    });
  };

  $rootScope.upload_cast = function (c) {
    $rootScope.pause_cast();
    $ionicPopup.show({
      template:
        "Do you want to upload " +
        (c.title ? "`" + c.title + "` cast?" : "cast?"),
      title: "Upload Cast",
      scope: $rootScope,
      buttons: [
        {
          text: "No",
          type: "button-light",
        },
        {
          text: "<b>Yes</b>",
          type: "button-light",
          onTap: function (e) {
            $rootScope.broadcasting();
            cast
              .upload(c._id)
              .success(function (Data) {
                $rootScope.hide();
                $ionicPopup.alert({ template: Data.message });
                if (Data.status == true) {
                  $timeout(function () {
                    $rootScope.clear();
                    $rootScope.record_box.hide();
                    $rootScope.recast_box.hide();
                    $rootScope.reply_box.hide();
                    $rootScope.new_feed();
                    $rootScope.refresh_profile();
                  }, 2000);
                }
              })
              .error(function () {
                $rootScope.hide();
                $ionicPopup.alert({
                  template: "network error.",
                });
              });
          },
        },
      ],
    });
  };

  $rootScope.open_aircast = function () {
    $rootScope.aircast_box.show();
    if (!$rootScope.settings.dark_mode) {
      if ($rootScope.text_color == "light") {
        StatusBar.styleLightContent();
      } else {
        StatusBar.styleDefault();
      }
    } else {
      StatusBar.styleLightContent();
    }
  };

  $rootScope.drop_aircast = function () {
    if ($rootScope.current_cast.casting) {
      $rootScope.pause_cast();
    }
    $rootScope.aircast_box.hide();
    $rootScope.current_cast = null;
    $rootScope.playlist = null;
  };

  $rootScope.close_aircast = function () {
    $rootScope.aircast_box.hide();
    $rootScope.change_bar();
  };

  $rootScope.pause_cast = function () {
    var casts =
      $rootScope.timeline ||
      $rootScope.suggested_casts ||
      $rootScope.profile.casts ||
      $rootScope.cast.replies ||
      $rootScope.my_casts ||
      $rootScope.saved_casts;
    if (casts) {
      for (var i = 0; i < casts.length; i++) {
        if (casts[i].casting) {
          casts[i].casting = false;
          break;
        }
      }
    }
    if ($rootScope.cast) {
      $rootScope.cast.casting = false;
    }
    if ($rootScope.post) {
      $rootScope.post.casting = false;
      if ($rootScope.post.cast) {
        $rootScope.post.cast.casting = false;
      }
    }
    if ($rootScope.current_cast) {
      $rootScope.current_cast.casting = false;
    }
    if (this.cast) {
      this.cast.casting = false;
    } else if (this.cast.recast) {
      this.cast.recast.casting = false;
    }
    if (this.post) {
      if (this.post.cast) {
        this.post.cast.casting = false;
      }
    }
    $rootScope.pause_audio();
  };

  $rootScope.clear = function () {
    console.log("clearing...");
    $timeout(function () {
      $rootScope.file = null;
      $rootScope.file = null;
      $rootScope.messaging = false;
      $rootScope.post.file = null;
      $rootScope.toast("cleared", true);
    }, 1000);
    $rootScope.messaging = false;
    $rootScope.file = null;
    $rootScope.file_added = false;
    $rootScope.mentions = [];
    if ($rootScope.source.stop) {
      $rootScope.clear_music();
      $rootScope.source.stop();
    }
  };

  $rootScope.count_down = function () {
    if ($rootScope.recording) {
      $rootScope.timer = $rootScope.timer - 1;
      $timeout(function () {
        $rootScope.count_down();
      }, 1000);
    }
  };

  $rootScope.share_cast = function (c) {
    var m = c.title ? c.title : "JustTalk:";
    var s = "Listen to cast by " + c.caster.user_name + " on JustTalk";
    var l = "https://justtalkapp.com/cast/" + c._id;
    $cordovaSocialSharing.share(m, s, null, l);
  };

  $rootScope.share_profile = function (user) {
    var n = user.user_name;
    var s = "subscribe to this channel to join the conversation";
    var l = "https://justtalkapp.com/profile/" + user.t_id;
    $cordovaSocialSharing.share(n, s, Config.media + user.photo, l);
  };

  $rootScope.remove_cast = function (c) {
    $ionicPopup.show({
      template:
        "Are you sure you want to remove this cast from your timeline completely?",
      title: "Remove from timeline",
      scope: $rootScope,
      buttons: [
        {
          text: "No",
          type: "button-light",
        },
        {
          text: "<b>Yes</b>",
          type: "button-light",
          onTap: function (e) {
            $rootScope.show();
            var data = {
              _id: c._id,
              t_id: $rootScope.t_id,
            };
            $rootScope.show();
            cast
              .remove(data)
              .success(function (Data) {
                $rootScope.hide();
                $ionicPopup.alert({
                  template: Data.message,
                });
                $rootScope.new_feed();
              })
              .error(function () {
                $rootScope.hide();
                $ionicPopup.alert({
                  template: "network error.",
                });
              });
          },
        },
      ],
    });
  };

  $rootScope.report_cast = function (c) {
    $ionicPopup.show({
      template: "Are you sure you want to report this cast?",
      title: "Report Cast",
      scope: $rootScope,
      buttons: [
        {
          text: "No",
          type: "button-light",
        },
        {
          text: "<b>Yes</b>",
          type: "button-light",
          onTap: function (e) {
            $rootScope.show();
            var data = {
              _id: c._id,
              t_id: $rootScope.user.t_id,
            };
            $rootScope.show();
            cast
              .report(data)
              .success(function (Data) {
                $rootScope.hide();
                $ionicPopup.alert({
                  template: Data.message,
                });
              })
              .error(function () {
                $rootScope.hide();
                $ionicPopup.alert({
                  template: "network error.",
                });
              });
          },
        },
      ],
    });
  };

  $rootScope.report_user = function (user) {
    $ionicPopup.show({
      template:
        "Are you sure you want to report this account? This account would be reviewed for any misconduct or violation to justtalk policy",
      title: "Report " + user.user_name,
      scope: $rootScope,
      buttons: [
        {
          text: "No",
          type: "button-light",
        },
        {
          text: "<b>Yes</b>",
          type: "button-light",
          onTap: function (e) {
            $rootScope.show();
            $rootScope.show();
            account
              .report({
                user_id: user._id,
                _id: $rootScope.user._id,
              })
              .success(function (Data) {
                $rootScope.hide();
                $ionicPopup.alert({
                  template: Data.message,
                });
              })
              .error(function () {
                $rootScope.hide();
                $ionicPopup.alert({
                  template: "network error.",
                });
              });
          },
        },
      ],
    });
  };

  $rootScope.next_cast = function () {
    console.log("next cast....");
    $rootScope.pause_cast();
    $timeout(function () {
      if ($rootScope.convo_track <= $rootScope.cast_replies.length - 1) {
        $rootScope.play_cast($rootScope.cast_replies[$rootScope.convo_track]);
        $rootScope.convo_track = $rootScope.convo_track + 1;
        console.log("convo_track:");
        console.log($rootScope.convo_track);
      } else {
        $rootScope.convo_track = 0;
        $rootScope.cast_replies = [];
        $rootScope.track = $rootScope.track + 1;
        if ($rootScope.playlist[$rootScope.track]) {
          $rootScope.play_cast($rootScope.playlist[$rootScope.track]);
        }
      }
    }, 2000);
  };

  $rootScope.profile_more = function (profile) {
    var block_button = { text: "Block @" + profile.user_name };
    if ($rootScope.is_blocked(profile)) {
      block_button = { text: "Unblock @" + profile.user_name };
    }
    var buttons = [
      { text: " Share this profile" },
      { text: " Report " + profile.user_name },
      block_button,
    ];
    var menu = {
      buttons: buttons,
      titleText: profile.user_name,
      cancelText: "Cancel",
      cancel: function () {},
      buttonClicked: function (index) {
        if (index === 0) {
          $rootScope.share_profile(profile);
        }

        if (index === 1) {
          $rootScope.report_user(profile);
        }

        if (index === 2) {
          if ($rootScope.is_blocked(profile)) {
            $rootScope.unblock_user(profile);
          } else {
            $rootScope.block_user(profile);
          }
        }
        if (index === 3) {
          $rootScope.message_user(profile);
        }
        return true;
      },
    };
    if ($rootScope.subscribed(profile)) {
      var blocks = [];
      if (profile.block_list) {
        blocks = profile.block_list;
      }
      if (
        !$rootScope.is_blocked(profile) &&
        blocks.indexOf($rootScope.t_id) == -1
      ) {
        buttons.push({ text: "Send a message" });
      }
    }
    $ionicActionSheet.show(menu);
  };

  $rootScope.previous_cast = function () {
    console.log("previous cast....");
    $rootScope.pause_cast();
    $timeout(function () {
      $rootScope.convo_track = $rootScope.convo_track - 1;
      if ($rootScope.cast_replies[$rootScope.convo_track]) {
        $rootScope.play_cast($rootScope.cast_replies[$rootScope.convo_track]);
      } else {
        $rootScope.track = $rootScope.track - 1;
        if ($rootScope.playlist[$rootScope.track]) {
          $rootScope.play_cast($rootScope.playlist[$rootScope.track]);
          $rootScope.convo_track = 0;
        }
      }
    }, 1000);
  };

  $rootScope.player_countdown = function (c) {
    c.duration = c.duration - 1;
    $timeout(function () {
      if (c.duration > 0) {
        $rootScope.player_countdown(c);
      }
    }, 1000);
  };

  $rootScope.track_position = function (position) {
    if ($rootScope.current_cast.casting) {
      $rootScope.pause_cast();
    }
    if (parseInt(position)) {
      console.log("t:");
      console.log(parseInt(position));
      $rootScope.current_cast.timeLeft =
        $rootScope.current_cast.duration - parseInt(position);
    }
  };

  $rootScope.track_position2 = function (position) {
    if ($rootScope.playing_message) {
      $rootScope.pause_message();
      if (position) {
        $rootScope.playing_message.timeLeft =
          $rootScope.playing_message.duration - parseInt(position);
      }
    } else {
      $rootScope.pause_cast();
      if (position) {
        $rootScope.post.timeLeft =
          $rootScope.post.duration - parseInt(position);
      }
    }
  };

  $rootScope.get_replies = function (id) {
    $rootScope.fetching_replies = true;
    $timeout(function () {
      cast.replies(id).success(function (Data) {
        $rootScope.fetching_replies = false;
        $rootScope.cast_replies = Data.data;
      });
    }, 1000);
  };

  $rootScope.currentTime = function (main_cast) {
    var pitch = 1;
    main_cast.duration = parseInt(main_cast.duration);
    main_cast.timeLeft = parseInt(main_cast.timeLeft);
    $timeout(function () {
      if ($rootScope.source) {
        var timeLeft = main_cast.duration - main_cast.timeLeft;

        if (timeLeft <= main_cast.duration) {
          main_cast.timeLeft = main_cast.timeLeft - 1;
          main_cast.bar = timeLeft;
          if (main_cast.bar >= 30) {
            cast.countStream(main_cast._id);
          }
          if (main_cast.casting && $rootScope.source.started) {
            $rootScope.currentTime(main_cast);
          }
        } else {
          $rootScope.pause_audio();
        }
      } else {
        console.log("no source!");
      }
    }, 1000 / pitch);
  };

  $rootScope.cast_listen = function (c) {
    var data = {
      t_id: $rootScope.t_id,
      cast_id: c._id,
    };
    if (c.listens) {
      if ($rootScope.user) {
        var inx = c.listens.findIndex(function (cl) {
          return cl.t_id == $rootScope.user.t_id;
        });
        if (inx < 0) {
          c.listens.push($rootScope.user);
          cast.listen(data).success(function () {});
        }
      }
    }
  };

  $rootScope.unheard_messages = function (c) {
    var total = 0;
    if (c) {
      if ($rootScope.user) {
        if (c.conversations) {
          for (var i = 0; i < c.conversations.length; i++) {
            var convo = c.conversations[i];
            if (!convo.expired) {
              if (convo.user._id != $rootScope.user._id) {
                var m = -1;
                if (convo.listens) {
                  m = convo.listens.findIndex(function (l) {
                    return l == $rootScope.user._id;
                  });
                }
                if (m <= -1) {
                  total = total + 1;
                }
              }
            }
          }
        }
      }
    }
    return total;
  };

  $rootScope.unheard = function () {
    var total = 0;
    if ($rootScope.user) {
      if ($rootScope.chats) {
        for (var j = 0; j < $rootScope.chats.length; j++) {
          var c = $rootScope.chats[j];
          if ($rootScope.unheard_messages(c) > 0) {
            total = total + 1;
          }
        }
      }
    }
    return total;
  };

  $rootScope.clear_replies = function () {
    $rootScope.cast_replies = [];
  };

  $rootScope.build_playlist = function (c) {
    if (!$rootScope.playlist || $rootScope.playlist.length < 1) {
      if ($rootScope.timeline) {
        if ($rootScope.timeline.length > 1) {
          $rootScope.playlist = $rootScope.timeline;
        } else {
          $rootScope.playlist = $rootScope.suggested_casts;
        }
      }
    } else if ($location.path() === "/front/talk") {
      $rootScope.playlist = $rootScope.timeline;
    }
    if (!c.reply) {
      $rootScope.track = $rootScope.playlist.findIndex(function (cst) {
        if (cst) {
          return cst._id == c._id;
        }
      });
    }
  };

  $rootScope.top_player = function (source, cast) {
    source.setAttribute("duration", cast.duration); // Update with actual duration
    source.setAttribute("artist", cast.caster.user_name);
    source.setAttribute("title", cast.title);
    source.setAttribute("cover", Config.media + cast.caster.photo);
    source.setAttribute("album", "JustTalk");
  };

  $rootScope.toast = function (msg, success) {
    if (window.plugins) {
      window.plugins.toast.showWithOptions({
        message: msg,
        duration: "short", // which is 2000 ms. "long" is 4000. Or specify the nr of ms yourself.
        position: "bottom",
        addPixelsY: -80, // added a negative value to move it up a bit (default 0)
        styling: {
          opacity: 0.9, // 0.0 (transparent) to 1.0 (opaque). Default 0.8
          backgroundColor: success ? "#FFFFFF" : "#FF0000", // make sure you use #RRGGBB. Default #333333
          textColor: success ? "#000000" : "#FFFFFF", // Ditto. Default #FFFFFF
          cornerRadius: 10,
        },
      });
    }
  };

  $rootScope.audio_frequency = function (audio) {
    var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var source = audioCtx.createMediaElementSource(audio);
    $rootScope.analyser = audioCtx.createAnalyser();
    source.connect($rootScope.analyser);
    $rootScope.analyser.connect(audioCtx.destination);
    $rootScope.Audiofrq = new Uint8Array($rootScope.analyser.frequencyBinCount);
    $rootScope.analyser.getByteFrequencyData($rootScope.Audiofrq);
  };

  $rootScope.random_color = function () {
    $rootScope.color =
      "#" + Math.floor(Math.random() * 16777215 + 1).toString(16);
    return $rootScope.color;
  };

  function get_color(image, callback) {
    if (image) {
      var img = new Image();
      img.crossOrigin = "*";
      img.src = image;
      img.onload = function () {
        var canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        var ctnx = canvas.getContext("2d");
        ctnx.drawImage(img, 0, 0);
        var data = ctnx.getImageData(0, 0, img.width, img.height);
        var pixels = data.data;
        var r = 0,
          g = 0,
          b = 0,
          a = 0;
        for (var i = 0, n = pixels.length; i < n; i += 4) {
          r += pixels[i];
          g += pixels[i + 1];
          b += pixels[i + 2];
          a += pixels[i + 3];
        }
        r = Math.floor(r / (img.width * img.height));
        g = Math.floor(g / (img.width * img.height));
        b = Math.floor(b / (img.width * img.height));
        a = Math.floor(a / (img.width * img.height));
        var hsp = Math.sqrt(
          0.299 * (r * r) + 0.587 * (g * g) + 0.114 * (b * b)
        );
        if (hsp > 127.5) {
          $rootScope.text_color = "dark";
        } else {
          $rootScope.text_color = "light";
        }
        callback(
          "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
        );
      };
    } else {
      callback(null);
    }
  }

  $rootScope.play_casts = function (cs) {
    $rootScope.playlist = cs.sort(
      (a, b) => new Date(b.date_created) - new Date(a.date_created)
    );
    $rootScope.play_cast($rootScope.playlist[0]);
  };

  $rootScope.play_cast = function (c) {
    if (c.casting) {
      console.log("paused!");
      $rootScope.pause_cast();
    } else {
      console.log("play!");
      $rootScope.pause_audio();
      var r = this;
      if (r.cast) {
        r.cast.casting = true;
        if (r.cast.recast) {
          r.cast.recast.casting = true;
        }
      } else if (r.post) {
        r.post.cast.casting = true;
      }
      if (c.recast) {
        $rootScope.current_cast = c.recast;
      } else {
        $rootScope.current_cast = c;
      }
      $rootScope.current_cast.casting = true;
      $timeout(function () {
        if (
          !$rootScope.current_cast.timeLeft ||
          $rootScope.current_cast.timeLeft < 1
        ) {
          $rootScope.current_cast.timeLeft = $rootScope.current_cast.duration;
          $rootScope.current_cast.bar = 0;
        }
        get_color(Config.media + c.caster.photo, function (color) {
          $rootScope.color = color;
        });
        $rootScope.build_playlist($rootScope.current_cast);
        if (!$rootScope.current_cast.reply) {
          $rootScope.get_replies($rootScope.current_cast._id);
        }
        if ($rootScope.current_cast) {
          $rootScope.play_audio(Config.media + $rootScope.current_cast.cast);
          $rootScope.cast_listen($rootScope.current_cast);
        }
      }, 1000);
    }
  };

  $rootScope.test_cast = function (post) {
    $rootScope.post = post;
    if (!post.casting) {
      $rootScope.post.casting = true;
      var file = URL.createObjectURL($rootScope.post.file);
      $rootScope.play_audio(file);
    } else {
      $rootScope.pause_cast();
    }
  };

  $rootScope.replay_cast = function (post) {
    $rootScope.pause_audio();
    $rootScope.post = post;
    if (!$rootScope.post.casting) {
      for (var i = 0; i < $rootScope.saved_casts.length; i++) {
        $rootScope.saved_casts[i].casting = false;
      }
      $rootScope.post.casting = true;
      if (!$rootScope.post.timeLeft) {
        $rootScope.post.timeLeft = $rootScope.post.duration;
      }
      $rootScope.play_audio(Config.media + $rootScope.post.cast);
    } else {
      $rootScope.post.casting = false;
    }
  };

  $rootScope.select_music = function (file) {
    $rootScope.pause_cast();
    if ($rootScope.post) {
      $rootScope.post.music = URL.createObjectURL(file);
    }
  };

  $rootScope.clear_music = function () {
    $rootScope.post.music = null;
    $rootScope.selected_music = null;
  };

  $rootScope.play_directcast = function (c) {
    $rootScope.play_cast(c);
    $rootScope.aircast_box.show();
  };

  $rootScope.fetch_profile = function (id) {
    $rootScope.fetching_casts = true;
    $rootScope.profile_casts = null;
    $timeout(function () {
      account.info(id).success(function (Data) {
        if (Data.status == true) {
          $rootScope.profile = Data.data;
          get_color(
            Config.media + $rootScope.profile.photo_header,
            function (color) {
              $rootScope.profile_color = color;
            }
          );
          $timeout(function () {
            account.casts(id).success(function (Data) {
              $rootScope.fetching_casts = false;
              if (Data.status == true) {
                if ($rootScope.profile) {
                  $rootScope.profile_casts = Data.data;
                }
              }
            });
          }, 1000);
        }
      });
    }, 1000);
  };

  $rootScope.refresh_cast = function (id) {
    $rootScope.casts_loader = true;
    $timeout(function () {
      cast
        .info(id)
        .success(function (Data) {
          $rootScope.casts_loader = false;
          $rootScope.hide();
          if (Data.status == true) {
            $rootScope.cast = Data.data;
            $rootScope.get_replies($rootScope.cast._id);
          }
        })
        .error(function () {
          $rootScope.hide();
          $rootScope.casts_loader = false;
        });
    }, 1000);
  };

  $rootScope.trustlink = function (link) {
    return $sce.trustAsResourceUrl(link);
  };

  $rootScope.timediff = function (start) {
    var u = start;
    return moment(u).fromNow();
  };

  if ($localStorage.user) {
    $rootScope.user = $localStorage.user;
  }

  if ($localStorage.t_id) {
    $rootScope.t_id = $localStorage.t_id;
    account
      .info($localStorage.t_id)
      .success(function (Data) {
        $rootScope.hide();
        if (Data.status == true) {
          $rootScope.user = Data.data;
          $localStorage.user = $rootScope.user;
        }
      })
      .error(function () {
        $rootScope.hide();
      });
  }

  $rootScope.get_notifications = function () {
    if ($rootScope.t_id) {
      $timeout(function () {
        account.notifications($rootScope.t_id).success(function (Data) {
          $rootScope.hide();
          if (Data.status == true) {
            $rootScope.notifications = Data.data;
          }
        });
      }, 1000);
    }
  };

  $rootScope.listen_to = function (casts) {
    var boys = [];
    if (casts) {
      casts.map(function (cast) {
        if (boys.indexOf(cast.caster) <= -1) {
          boys.push(cast.caster);
        }
      });
    }
    return boys;
  };

  $rootScope.discovery = function () {
    $rootScope.casts_loading = true;
    var coord = {
      lat: 0,
      long: 0,
    };
    if ($rootScope.user) {
      coord = $rootScope.user.coord;
    }
    cast.trending(coord).success(function (Data) {
      if (Data.status == true) {
        $rootScope.trending_topics = $rootScope.censor_casts(Data.data);
        $rootScope.top_boys = $rootScope.listen_to($rootScope.trending_topics);
      }
    });
    account.suggestion(coord).success(function (Data) {
      if (Data.status == true) {
        $rootScope.suggested_users = Data.data;
      }
    });
    cast.suggestion(coord).success(function (Data) {
      if (Data.status == true) {
        $rootScope.suggested_casts = $rootScope.censor_casts(Data.data);
        $rootScope.casts_loading = false;
      }
      $rootScope.hide();
    });
  };

  if ($localStorage.chats) {
    $rootScope.chats = $localStorage.chats;
  }

  $rootScope.get_messages = function () {
    if ($rootScope.t_id) {
      $rootScope.fetching_msg = true;
      Chat.all($rootScope.t_id).success(function (Data) {
        $rootScope.fetching_msg = false;
        $rootScope.hide();
        if (Data.status == true) {
          $localStorage.chats = Data.data;
          $rootScope.chats = $localStorage.chats;
          $rootScope.fetching_msg = false;
        }
      });

      Chat.requests($rootScope.t_id).success(function (Data) {
        if (Data.status == true) {
          $rootScope.requests = Data.data;
        }
      });
    }
  };

  $rootScope.chatter = function (chat) {
    var p = {};
    if (chat) {
      if (chat.members) {
        var m = chat.members.findIndex(function (member) {
          if (member.user) {
            return member.user.t_id != $rootScope.t_id;
          }
        });
        if (m >= 0) {
          p = chat.members[m].user;
        }
      }
    }
    return p;
  };

  $rootScope.delete_cast = function (c) {
    $ionicPopup.show({
      template: "Are you sure you want to delete cast?",
      title: "Delete Cast",
      scope: $rootScope,
      buttons: [
        {
          text: "No",
          type: "button-light",
        },
        {
          text: "<b>Yes</b>",
          type: "button-light",
          onTap: function (e) {
            $rootScope.show();
            cast
              .delete(c._id)
              .success(function (Data) {
                $rootScope.hide();
                $ionicPopup.alert({ template: Data.message });
                if (Data.status == true) {
                  $rootScope.new_feed();
                  $rootScope.refresh_profile();
                }
              })
              .error(function () {
                $rootScope.hide();
              });
            if ($location.path() === "/edit_cast") {
              window.history.back();
            }
          },
        },
      ],
    });
  };

  $rootScope.get_contacts = function () {
    $rootScope.contact_loader = true;
    account.contacts($rootScope.t_id).success(function (Data) {
      $rootScope.contact_loader = false;
      if (Data.status == true) {
        $rootScope.contact_list = Data.data;
      }
    });
  };

  $rootScope.censor_casts = function (casts) {
    var new_casts = casts;
    if ($rootScope.user) {
      casts.map(function (cast, i) {
        var id = cast._id;
        if (cast.recast) {
          id = cast.recast._id;
        }
        var z = $rootScope.user.cast_list.indexOf(id);
        var index = $rootScope.user.block_list.indexOf(cast.caster.t_id);
        if (z >= 0) {
          new_casts.splice(i, 1);
        } else if (index >= 0) {
          new_casts.splice(i, 1);
        }
      });
    }
    return new_casts;
  };

  $rootScope.get_talk = function () {
    $timeout(function () {
      $rootScope.home_loader = true;
      if ($rootScope.t_id) {
        cast
          .timeline($rootScope.t_id)
          .success(function (Data) {
            $rootScope.home_loader = false;
            if (Data.status == true) {
              $rootScope.timeline = $rootScope.censor_casts(Data.data);
              $rootScope.home_loader = false;
              $rootScope.hide();
            }
          })
          .error(function () {
            $rootScope.home_loader = false;
            $rootScope.hide();
          });
      }
    }, 1000);
  };

  var date = new Date();
  $rootScope.today = date;
  var hour = $rootScope.today.getHours();
  if (hour >= 5 && hour < 12) {
    $rootScope.greetings = "Good morning";
    if ($rootScope.settings.auto_dark) {
      if ($rootScope.settings.dark == true) {
        $rootScope.change_mode();
      }
    }
  } else if (hour >= 12 && hour < 18) {
    $rootScope.greetings = "Good afternoon";
    if ($rootScope.settings.auto_dark) {
      if ($rootScope.settings.dark == true) {
        $rootScope.change_mode();
      }
    }
  } else {
    $rootScope.greetings = "Good evening";
    if ($rootScope.settings.auto_dark) {
      if ($rootScope.settings.dark == false) {
        $rootScope.change_mode();
      }
    }
  }

  $ionicPlatform.registerBackButtonAction(function () {
    if ($location.path() === "/front/talk") {
      navigator.app.exitApp();
    } else {
      $ionicHistory.goBack();
    }
  }, 100);

  if ($location.path() === "/front/messages") {
    $rootScope.chat = null;
  }

  $rootScope.get_subscriptions = function (id) {
    account.subscriptions(id).success(function (Data) {
      if (Data.status == true) {
        $rootScope.subscriptions = Data.data;
      }
    });
  };

  $rootScope.new_feed = function () {
    $rootScope.get_talk();
    $rootScope.get_library();
    $rootScope.discovery();
    $rootScope.get_messages();
    $rootScope.get_notifications();
    $rootScope.get_subscriptions($rootScope.t_id);
  };
  $rootScope.new_feed();

  function expire_messages(conversations) {
    var new_conversations = [];
    var today = new Date();
    var exp_date = new Date();
    if (conversations) {
      for (var i = 0; i < conversations.length; i++) {
        var message = conversations[i];
        if (message.date_expired) {
          exp_date = new Date(message.date_expired);
        }
        if (today > exp_date) {
          console.log("passed expiring date");
          message.expired = true;
        }
        new_conversations.push(message);
      }
    } else {
      new_conversations = conversations;
    }
    return new_conversations;
  }

  $rootScope.handleToken = function (token) {
    $rootScope.pushtoken = token;
    console.log("firebase token:", token);
    $localStorage.pushtoken = token;
    if ($rootScope.user) {
      $rootScope.user.pushtoken = token;
      $rootScope.account_update($rootScope.user);
    }
    FirebasePlugin.setBadgeNumber(0);
  };

  $rootScope.handleFirebaseMessage = function (data) {
    $rootScope.notify = true;
    if (data.tap || data.tapped || data.Tapped || data.Tap) {
      if (data.notifications) {
        $state.go("front.notification");
      } else if (data.cast) {
        $state.go("front.talk");
      } else if (data.chat || data.message) {
        $state.go("front.messages");
      }
    }

    FirebasePlugin.getBadgeNumber(function (n) {
      var badgeNumber = n ? n + 1 : 1;
      FirebasePlugin.setBadgeNumber(badgeNumber);
    });
  };

  $ionicPlatform.ready(function () {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (position) {
          // Success callback
          if ($rootScope.user) {
            $rootScope.user.coord = {
              lat: position.coords.latitude,
              long: position.coords.longitude,
            };
            $rootScope.account_update($rootScope.user);
          }
        },
        function (error) {
          // Error callback
          console.error("Error getting current position:", error);
          // You might want to handle the error here, depending on your application's requirements
        }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      // Handle the case where geolocation is not supported by the browser
    }

    // Add event listeners for unlocking media
    ["click", "touchstart", "touchend"].forEach(function (eventName) {
      document.body.addEventListener(eventName, $rootScope.unlock_media);
    });

    // Initialize MediaControls

      $rootScope.MediaControls = window.MusicControls || window.MediaControls || MusicControls || MediaControls;
    
    if ($rootScope.MediaControls) {
        console.log('MediaControls initialized successfully!');
    } else {
        console.error('MediaControls initialization failed!');
    }

    // Socket event listeners
    socket.on("message", function (data) {
      $rootScope.get_messages();
      if ($rootScope.chat) {
        $rootScope.get_chat($rootScope.chat._id);
      }
    });

    socket.on("talk", function (data) {
      $rootScope.new_feed();
      $rootScope.refresh_profile();
    });

    // Change status bar if available
    if (typeof StatusBar !== "undefined") {
      $rootScope.change_bar();
    }
    // Deeplinks routing
    $cordovaDeeplinks
      .route({
        "/cast/:id": { target: "single_cast" },
        "/profile/:id": { target: "aprofile" },
      })
      .subscribe(
        function (match) {
          console.log("Match deep route:", match);
          $timeout(function () {
            $state.go(match.$route.target, { id: match.$args.id });
          }, 2000);
        },
        function (nomatch) {
          console.log("Deep Match none:", nomatch);
        }
      );

    // Fetch device information
    if (window.device) {
      $rootScope.device = window.device || device;
    }

    // FirebasePlugin operations if available
    var FirebasePlugin = window.FirebasePlugin || this.firebasePlugin;
    if (FirebasePlugin) {
      FirebasePlugin.getToken(function (token) {
        $rootScope.handleToken(token);
      });

      FirebasePlugin.grantPermission(function (hasPermission) {
        console.log(
          "Aeby Push Permission was " + (hasPermission ? "granted" : "denied")
        );
      });

      FirebasePlugin.onTokenRefresh(function (token) {
        console.log("justtalk signed fcm generated token:", token);
        if (token && $rootScope.user) {
          $rootScope.handleToken(token);
        }
      });

      FirebasePlugin.onMessageReceived(function (data) {
        $rootScope.handleFirebaseMessage(data);
      });
    }

    if (window.cordova) {
      // Promises for permission requests
      var request_location = new Promise((resolve, reject) => {
        cordova.plugins.diagnostic.requestLocationAuthorization(
          function (status) {
            handlePermissionStatus(status);
            resolve();
          },
          function (error) {
            console.error(error);
            reject(error);
          },
          cordova.plugins.diagnostic.locationAuthorizationMode.ALWAYS,
          cordova.plugins.diagnostic.locationAccuracyAuthorization.REDUCED
        );
      });

      var request_notification = new Promise((resolve, reject) => {
        cordova.plugins.diagnostic.isRemoteNotificationsEnabled(
          function (isEnabled) {
            if (!isEnabled) {
              cordova.plugins.diagnostic.requestRemoteNotificationsAuthorization(
                {
                  successCallback: function () {
                    console.log(
                      "Successfully requested remote notifications authorization"
                    );
                    resolve();
                  },
                  errorCallback: function (err) {
                    console.error(
                      "Error requesting remote notifications authorization: " +
                        err
                    );
                    reject(err);
                  },
                  types: [
                    cordova.plugins.diagnostic.remoteNotificationType.ALERT,
                    cordova.plugins.diagnostic.remoteNotificationType.SOUND,
                    cordova.plugins.diagnostic.remoteNotificationType.BADGE,
                  ],
                  omitRegistration: false,
                }
              );
            }
          },
          function (err) {
            reject(err);
          }
        );
      });

      var request_microphone = new Promise((resolve, reject) => {
        cordova.plugins.diagnostic.isMicrophoneAuthorized(function (isEnabled) {
          if (!isEnabled) {
            cordova.plugins.diagnostic.requestMicrophoneAuthorization(
              function () {
                console.log("Successfully requested microphone authorization");
                resolve();
              },
              function (err) {
                console.error(
                  "Error requesting microphone authorization: " + err
                );
                reject(err);
              }
            );
          }
        });
      });

      var request_contacts = new Promise((resolve, reject) => {
        cordova.plugins.diagnostic.isContactsAuthorized(function (isEnabled) {
          if (!isEnabled) {
            cordova.plugins.diagnostic.requestContactsAuthorization(
              function () {
                console.log("Successfully requested Contacts authorization");
                resolve();
              },
              function (err) {
                console.error(
                  "Error requesting Contacts authorization: " + err
                );
                reject(err);
              }
            );
          }
        });
      });

      var request_storage = new Promise((resolve, reject) => {
        cordova.plugins.diagnostic.isExternalStorageAuthorized(function (
          isEnabled
        ) {
          if (!isEnabled) {
            cordova.plugins.diagnostic.requestExternalStorageAuthorization(
              function () {
                console.log("Successfully requested Storage authorization");
                resolve();
              },
              function (err) {
                console.error("Error requesting Storage authorization: " + err);
                reject(err);
              }
            );
          }
        });
      });

      // Handle permission requests
      request_microphone.then(function () {
        request_location.then(function () {
          request_storage.then(function () {
            request_notification.then(function () {
              request_contacts.then(function () {
                console.error("All permissions authorized!");
              });
            });
          });
        });
      });
    }

    // Function to handle permission status
    function handlePermissionStatus(status) {
      switch (status) {
        case cordova.plugins.diagnostic.permissionStatus.NOT_REQUESTED:
          console.log("Permission not requested");
          break;
        case cordova.plugins.diagnostic.permissionStatus.DENIED_ALWAYS:
          console.log("Permission denied");
          break;
        case cordova.plugins.diagnostic.permissionStatus.GRANTED:
          console.log("Permission granted always");
          break;
        case cordova.plugins.diagnostic.permissionStatus.GRANTED_WHEN_IN_USE:
          console.log("Permission granted only when in use");
          break;
      }
    }
  });
});
