var TMNBot = require('../bot');
var _ = require('underscore');
var repl = require('repl');
var jf = require('jsonfile');

jf.readFile('./toke-config.js', function (err, config) {
  var bot = new TMNBot({username: '', password: ''});
  var tokers = [];
  var toking = false;
  var lastToke = null;
  var lastCreator = null;
  var roundStarted = null;
  var timeouts = {};

  var tokersList = function () {
    var users = '';
    var length = tokers.length;
    for (var i = 0; i < length; i++) {
      if (i === 0) {
        users += tokers[i];
      } else if (i === length - 1) {
        users += ' and ' + tokers[i];
      } else {
        users += ', ' + tokers[i];
      }
    }
    return users;
  };

  var takeAToke = function () {
    var users = '';
    var length = tokers.length;
    var message = 'Take a toke ';
    var messages = [];
    var str;

    tokers[tokers.length - 1] += '!';

    for (var i = 0; i < length; i++) {
      if (i === 0) {
        str = tokers[i];
      } else if (i === length - 1) {
        str = ' and ' + tokers[i];
      } else {
        str = ', ' + tokers[i];
      }

      if (message.length + str.length <= 250) {
        message += str;
      } else {
        messages.push(message);
        message = '';
      }
    }

    if (message.length) {
      messages.push(message);
    }

    length = messages.length;

    for (i = 0; i < length; i++) {
      bot.call('chat.post', {
        message: messages[i]
      });
    }

    tokers = [];
    lastToke = Date.now();
    toking = false;
  };

  var notifyToker = function (user) {
    bot.call('chat.post', {
      message: '@"' + user.username + '" joined the toke! Post !toke to take part!'
    });
  };

  var startRoundCountdown = function (time) {
    clearTimeout(timeouts.countdown3);
    clearTimeout(timeouts.countdown2);
    clearTimeout(timeouts.countdown1);
    clearTimeout(timeouts.toke);
    timeouts.countdown3 = setTimeout(countdown.bind(null, 3), time-3000);
    timeouts.countdown2 = setTimeout(countdown.bind(null, 2), time-2000);
    timeouts.countdown1 = setTimeout(countdown.bind(null, 1), time-1000);
    timeouts.toke = setTimeout(takeAToke, time);
  };

  var countdown = function (num) {
    bot.call('chat.post', {
      message: 'Get ready to toke - ' + num + '!'
    });
  };

  var addToker = function (user) {
    var mention = '@"' + user.username + '"';
    if (toking) {
      if (tokers.indexOf(mention) === -1) {
        if ((config.roundLength - (Date.now() - roundStarted)) < config.roundRenewTime) {
          startRoundCountdown(config.roundRenewTime);
        }
        tokers.push(mention);
        notifyToker(user);
      } else {
        bot.call('chat.whisper', {
          target: user.username,
          message: 'You\'re already taking part in this !toke!'
        });
      }
    } else {
      var timeoutDiff = (Date.now() - lastToke);
      if (lastCreator === user.username && timeoutDiff < config.userTimeout) {
        bot.call('chat.whisper', {
          target: user.username,
          message: 'Please either wait ' + Math.ceil((config.userTimeout - timeoutDiff)/1000) + 's seconds before starting a new toke or wait for someone else to start one!'
        });
      } else if (timeoutDiff < config.timeBetweenRounds) {
        bot.call('chat.whisper', {
          target: user.username,
          message: 'Please wait ' + Math.ceil((config.timeBetweenRounds - timeoutDiff) / 1000) + 's before starting a new group toke.'
        });
      } else {
        roundStarted = Date.now();
        toking = true;
        tokers = [mention];
        lastCreator = user.username;
        bot.call('chat.post', {
          message: 'A syncronized toke has been started by ' + mention + '! We\'ll be taking a toke in ' + Math.round(config.roundLength / 1000) + ' seconds - join in toking by posting !toke'
        });
        for (var i = 0; i < config.notifyUsernames.length; i++) {
          bot.call('chat.whisper', {
            message: 'A syncronized toke has been started by ' + mention + '! We\'ll be taking a toke in ' + Math.round(config.roundLength / 1000) + ' seconds - join in toking by posting !toke',
            target: config.notifyUsernames[i]
          });
        }
        startRoundCountdown(config.roundLength);
      }
    }
  };

  bot.on('chat', function (event) {
    if (typeof event === 'string') {
      try {
        event = JSON.parse(event);
      } catch (e) {
        return false;
      }
    }
    if (event.type === 'message') {
      if (event.message.toLowerCase() === '!toke' || event.message.trim().match(/^@"?TokeBot"? !toke$/) !== null) {
        addToker(event.user);
      } else if (event.message.toLowerCase() === '!toke on') {
        if (config.notifyUsernames.indexOf(event.user.username) === -1) {
          config.notifyUsernames.push(event.user.username);
          jf.writeFile('./toke-config.js', config, function(err) {});
          bot.call('chat.whisper', {
            message: 'OK! We\'ll notify you when a !toke takes place.',
            target: event.user.username
          });
        }
      } else if (event.message.toLowerCase() === '!toke off') {
        config.notifyUsernames = _.without(config.notifyUsernames, event.user.username);
        jf.writeFile('./toke-config.js', config, function(err) {});
        bot.call('chat.whisper', {
          message: 'OK! We\'ll no longer notify you when a !toke takes place.',
          target: event.user.username
        });
      }
    } else if (event.type === 'whisper') {
      if (event.message === '!toke') {
        addToker(event.user);
      }
    }
  });

  repl.start({
    prompt: "> ",
    input: process.stdin,
    output: process.stdout,
    useGlobal: true
  });
});
