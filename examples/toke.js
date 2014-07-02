var TMNBot = require('../bot');
var bot = new TMNBot({username: 'TokeBot', password: 'youtokeipost' });
var tokers = [];
var toking = false;
var tokeWaitPeriod = 10000;

var takeAToke = function () {
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
  bot.call('chat.post', {
    message: 'OK - take a toke now! ' + users
  });
  tokers = [];
  toking = false;
};

var notifyToker = function (user) {
  bot.call('chat.whisper', {
    target: user.username,
    message: 'Awesome! Get ready to take a toke!'
  });
};

var addToker = function (user) {
  var mention = '@"' + user.username + '"';
  if (toking) {
    if (tokers.indexOf(mention) === -1) {
      tokers.push(mention);
      notifyToker(user);
    }
  } else {
    toking = true;
    tokers = [mention];
    bot.call('chat.post', {
      message: 'A syncronized toke has been started! We\'ll be taking a toke in ' + Math.round(tokeWaitPeriod / 1000) + ' seconds - join in toking by typing !toke'
    });
    setTimeout(takeAToke, tokeWaitPeriod);
    notifyToker(user);
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
    if (event.message === '!toke' || event.message.trim().match(/^@"?TokeBot"? !toke$/) !== null) {
      addToker(event.user);
    }
  } else if (event.type === 'whisper') {
    if (event.message === '!toke') {
      addToker(event.user);
    }
  }
})