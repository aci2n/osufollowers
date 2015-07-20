// ==UserScript==
// @name osu! followers
// @version 0.24
// @author Alvaro Daniel Calace
// @namespace https://github.com/alvarocalace/osufollowers
// @description Adds a new followed players section in your osu! profile
// @require http://code.jquery.com/jquery-latest.js
// @require http://timeago.yarp.com/jquery.timeago.js
// @include https://osu.ppy.sh/u/*
// @copyright 2015, Alvaro Daniel Calace
// @downloadURL https://raw.githubusercontent.com/alvarocalace/osufollowers/master/osufollowers-latest.user.js
// @grant GM_xmlhttpRequest
// ==/UserScript==

var username;
var URL_USER = 'https://osu.ppy.sh/u/';
var URL_BEATMAP = 'https://osu.ppy.sh/b/';
var URL_BASE = 'http://itoon-osufollower.rhcloud.com';
var URL_API_SCORES = '/api/FollowedPlayersRecentTopScores';
var URL_API_PLAYERS = '/api/GetFollowedPlayers';
var URL_ADD = '/AddFollowedPlayer';
var URL_DELETE = '/DeleteFollowedPlayer';
var index = 0;
var lock = 0;
var pollingRate = 10;
var defaultTimeout = 2000;

$(window).load(
    function main(){
        username = getCookie('last_login');
        var profileUsername = $('.profile-username');
        if (username && ((URL_USER + username).match(document.URL + '*') || (profileUsername && profileUsername.first().text().trim() === username))) {
            waitForSelector('#full', init, defaultTimeout);
        }
    }
);

//MAIN INITIALIZER

function init() {
    var mainDiv = $('<div>').attr('id', 'osuFollowersMainDiv');
    $('#full').after(mainDiv);   
    mainDiv.append(prepareTitleDiv());	
    mainDiv.append(prepareScoresDiv());
	mainDiv.append(prepareShowMeMore());
	appendBatch();
    mainDiv.append('<br>');
	mainDiv.append(preparePlayersDiv());
	mainDiv.append(preparePlayersTableDiv());
	initPlayersTable();
}

//STATIC ELEMENTS

function prepareTitleDiv() {
	return $('<div>').attr('id', 'osuFollowersTitleDiv').addClass('profileStatHeader').text('Followed Players');
}

function prepareScoresDiv() {
	return $('<div>').attr('id', 'scoresDiv').append($('<table>').attr('id', 'scoresTable'));
}

function prepareShowMeMore() {
	return $('<div>').attr('id', 'showMeMoreDiv').append(
		$('<a>').attr('href', '#').text("Show me more...").click(function(event){
			event.preventDefault();
			if (!isLocked()) {
				appendBatch();
			}
		})
	).append($('<img>').attr('id', 'scoresLoadingIcon').attr('src', 'http://www.ajaxload.info/images/exemples/30.gif').css('height', '11px').css('width', '11px').hide());
}

function preparePlayersDiv() {
	return $('<div>').attr('id', 'playersDiv').append(prepareExpandPlayersButton()).append(preparePlayersInput()).append(prepareMessageSpan());
}

function prepareExpandPlayersButton() {
	return $('<a>').attr('id', 'expandPlayersButton').attr('href', '#').click(function(event) {
		event.preventDefault();
		var img = $(this).children(":first");
		img.css('-webkit-transform') === 'none' ? img.css('-webkit-transform', 'rotate(-90deg)') : img.css('-webkit-transform', '');
		var divSettings = $('#playersTableDiv');
		divSettings.css('display') === 'none' ? divSettings.show() : divSettings.hide();
	}).append($('<img>').attr('src','https://upload.wikimedia.org/wikipedia/commons/f/f7/Arrow-down-navmenu.png').css('-webkit-transform', 'rotate(-90deg)').css('padding-right', '3px').css('height', '11px').css('width', '11px'));
}

function preparePlayersInput() {
	return $('<input>').attr('id', 'playersInput').attr('placeholder', 'follow a new player!').on('keydown', function(event) {
		if (!isLocked()) {
			var player = $(this).val();
			if (event.which === 13 && player) {
				$(this).val('');
				processAdd(username, player);
			}
		}
    });	
}

function prepareMessageSpan() {
	return $('<span>').attr('id', 'messageSpan').css('padding-left', '10px').css('color', '#848484');
}

function preparePlayersTableDiv() {
	return $('<div>').attr('id', 'playersTableDiv').css('padding-top', '5px').hide().append(
		$('<table>').attr('id', 'playersTable').addClass('beatmapListing').attr('cellspacing', '0')
			.append($('<thead>')
				.append($('<tr>')
					.append($('<th>').text('Rank'))
					.append($('<th>').text('Player'))
					.append($('<th>').text('Accuracy'))
					.append($('<th>').text('Playcount'))
					.append($('<th>').text('Performance'))
					.append($('<th>').text('Delete'))
				)
			)
	).append($('<img>').attr('id', 'playersTableLoadingIcon').attr('src', 'http://www.ajaxload.info/images/exemples/30.gif').css('height', '11px').css('width', '11px').hide());
}

//DYNAMIC ELEMENTS

function appendToScoresTable(d) {
	$('#scoresTable').append($('<tr>')
			.append($('<td>').css('width', '20%')
				.append($('<time>').addClass('timeago').attr('datetime', d.date).attr('title', formatDateForTitle(d.date)).text($.timeago(d.date)))
			)
			.append($('<td>')
			.append($('<div>').addClass('event epic1')
				.append($('<img>').attr('src', '/images/' + d.rank +'_small.png'))
				.append(' ')
				.append($('<a>').attr('href', URL_USER + d.username).attr('target', '_blank').css('font-weight', 'bold').text(d.username)) 
				.append(' got ' + d.pp + ' pp on ')
				.append($('<a>').attr('href',URL_BEATMAP + d.beatmapId).attr('target', '_blank').text(d.artist + ' - ' + d.title + ' [' + d.version + '] '))
				.append (' (' + modsToString(d.mods) + ') ')
			)
		)
	);
}

function appendToPlayersTable(d) {
	var rowClass = $('#playersTable > tbody > tr').length % 2 === 1 ? 'row2p' : 'row1p';

	var deleteButton = $('<a>').attr('href', '#').click(function(event) {
		event.preventDefault();
		if (!isLocked()) {
			if (confirm('Are you sure you want to stop following ' + d.username + '?')) {
				processDelete(username, d.username);
				$(this).closest('tr').remove();
				refreshPlayerTableRowClasses();
			}
		}
	}).append($('<img>').attr('src','https://cdn2.iconfinder.com/data/icons/windows-8-metro-style/128/delete.png').css('width', '10px').css('height', '10px'));

	var rank = d.rank ? (d.rank === '0' ? 'unranked' :'#' + d.rank) : '';
	var country = d.country ? d.country.toLowerCase() : 'mw';
	var acc = d.accuracy ? d.accuracy + '%' : '';
	var pp = d.pp ? (d.pp === '0' ? 'unavailable' : d.pp + 'pp') : '';
	var playcount = d.playcount ? commaSeparate(d.playcount) : '';
	
	$('#playersTable').append(
		$('<tr>').addClass(rowClass)//.attr('onclick','document.location="/u/' + d.username + '"')
			.append($('<td>').css('font-weight', 'bold').text(rank))
			.append($('<td>')
				.append($('<img>').attr('src', '//s.ppy.sh/images/flags/' + country + '.gif'))
				.append(' ')
				.append($('<a>').attr('target', '_blank').attr('href', URL_USER + d.username).text(d.username))
			)
			.append($('<td>').text(acc))
			.append($('<td>').text(playcount))
			.append($('<td>').css('font-weight', 'bold').text(pp))
			.append($('<td>').css('text-align', 'center')
				.append(deleteButton)
			)
	);
}

//AJAX

function processDelete(username, player) {
	closeLock();
    var url = URL_BASE + URL_DELETE; 
	var params = 'username=' + encodeURIComponent(username) + '&player=' + encodeURIComponent(player);
    createPostRequest(url, params, function(response){
        if (response.status === 200) {
			showMessage('you are not following ' + player + ' anymore');
			refreshScoresTable();
        } else {
			showMessage('a server error has occurred, please try again later');
		}
		openLock();
    });
}

function processAdd(username, player) {
	closeLock();
    var url = URL_BASE + URL_ADD; 
	var params = 'username=' + encodeURIComponent(username) + '&player=' + encodeURIComponent(player);
    createPostRequest(url, params, function(response){
        if (response.status === 200) {
			var data = $.parseJSON(response.responseText);
			appendToPlayersTable(data);
			showMessage('you are now following ' + data.username);
			refreshScoresTable();
        } else if (response.status = 422){
			showMessage(response.responseText);
		} else {
			showMessage('a server error has occurred, please try again later');
		}
		openLock();
    });
}

function appendBatch() {
    closeLock();
    var url = URL_BASE + URL_API_SCORES + '?username=' + encodeURIComponent(username) + '&startingIndex=' + encodeURIComponent(index);
    var loadingIcon = $('#scoresLoadingIcon').show();
    createGetRequest(url, function(response){
        loadingIcon.hide();
        var data = $.parseJSON(response.responseText);
        for (var i = 0; i < data.length; i++) {
            appendToScoresTable(data[i]);
            index++;
        }
        openLock();
    });
}

function initPlayersTable() {
	closeLock();
	var data = [];
	var url = URL_BASE + URL_API_PLAYERS + '?username=' + encodeURIComponent(username);
	var loadingIcon = $('#playersTableLoadingIcon').show();
	createGetRequest(url, function(response) {
		loadingIcon.hide();
		data = $.parseJSON(response.responseText);
		for (var i = 0; i < data.length; i++) {
			appendToPlayersTable(data[i]);
		}
		openLock();
	});
}

function refreshScoresTable() {
	$('#scoresTable').empty();
	index = 0;
	appendBatch();
}

function createGetRequest(url, callback) {
    GM_xmlhttpRequest({
        method: 'GET',
        url: url,
        onload: function(response) {
			callback(response);
        }
    });
}

function createPostRequest(url, params, callback) {
    GM_xmlhttpRequest({
		method: 'POST',
		url: url,
		data: params,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded'
		},
		onload: function(response) {
			callback(response);
		}
	});
}

//UTILITIES

function showMessage(message) {
	$('#messageSpan').text(message).fadeIn(400).delay(4000).fadeOut(400);
}

function refreshPlayerTableRowClasses() {
	var rows = $('#playersTable > tbody  > tr');
	for (var i = 0; i < rows.length; i++) {
		rows[i].className = i % 2 === 1 ? 'row2p' : 'row1p';
	}
}

function getCookie(k){
	return (document.cookie.match('(^|; )' + k + '=([^;]*)') || 0)[2];
}

function modsToString(mods) {
    var str = '';
    for (var i = 0; i < mods.length; i++) {
        str += mods[i] + ', ';
    }
    return str.substring(0, str.length - 2);
}

function waitForSelector(selector, callback, timeout){
    var waited = 0;
    var interval = setInterval(function() {
        if ($(selector).length) {
            clearInterval(interval);
            callback();
        } else {
            waited += pollingRate;
            if (waited >= timeout) {
                clearInterval();
            }
        }
    }, pollingRate);
}

function formatDateForTitle(str) {
    var d = new Date(str);
    // convert to UTC
    d = new Date(d.getTime() + (d.getTimezoneOffset() * 60000));
    
    var yyyy = d.getFullYear();
    var mm = d.getMonth() + 1;
    var dd = d.getDate();
    var hh = d.getHours();
    var mi = d.getMinutes();
    var ss = d.getSeconds();

    return yyyy + '-' + pad(mm) + '-' + pad(dd) + ' ' + pad(hh) + ':' + pad(mi) + ':' + pad(ss) + ' UTC';
}

function pad(i) {
    return ("0" + i).slice(-2);
}

function commaSeparate(val){
    while (/(\d+)(\d{3})/.test(val.toString())){
        val = val.toString().replace(/(\d+)(\d{3})/, '$1'+','+'$2');
    }
    return val;
}

//SYNC LOCK
function isLocked() {
	return lock;
}

function closeLock() {
	lock--;
}

function openLock() {
	lock++;
}
