var TMNBot = require('../bot');
var bot = new TMNBot({username: 'TokeBot', password: '' });
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

bot.on('chat', function (event) {
  if (typeof event === 'string') {
    try {
      event = JSON.parse(event);
    } catch (e) {
      return false;
    }
  }
  if (event.type === 'message') {
    if (event.message === '!toke') {
      var username = '@"' + event.user.username + '"';
      if (toking) {
        if (tokers.indexOf(username) === -1) {
          tokers.push(username);
        }
      } else {
        toking = true;
        tokers = [username];
        bot.call('chat.post', {
          message: 'A syncronized toke has been started! Join ' + username + ' by typing !toke'
        });
        setTimeout(takeAToke, tokeWaitPeriod);
      }
    }
  }
})