// ==UserScript==
// @name         TagPro LiveScoreboard
// @version      0.7.1
// @description  Live Scoreboard that plays along with TagPro NewJerseys script
// @author       zeeres
// @include      http://tagpro-*.koalabeast.com*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_log
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.12.4/jquery.min.js
// @require      http://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/jquery-ui.min.js
// @resource     jqUI_CSS  http://ajax.googleapis.com/ajax/libs/jqueryui/1.11.4/themes/smoothness/jquery-ui.css
// @updateURL    https://github.com/zeeres/TagPro-LiveScoreboard/raw/master/TagPro-LiveScoreboard.user.js
// @downloadURL  https://github.com/zeeres/TagPro-LiveScoreboard/raw/master/TagPro-LiveScoreboard.user.js
// ==/UserScript==

// Add your own imgur album links here inside quotes with commas between quoted album links
// For example: var customAlbums = ["http://imgur.com/a/0zBNw", "http://imgur.com/a/1abcD"]; (do not include comma if only 1 album)
// Images should have titles that match team names and a single digit numerical description that matches team color (0 for either/both, 1 for red, 2 for blue)
var Albums = ['https://imgur.com/a/hDzri', 'https://imgur.com/a/mTiFb', 'https://imgur.com/a/JcPvD', 'https://imgur.com/a/RyADS'];

// Add your own imgur image links here inside quotes with commas between quoted image links, it must links to the png file
// For example: var customImages = ["http://i.imgur.com/17aAwABc.png", "http://i.imgur.com/abc123DEF.png"]; (do not include comma if only 1 image)
// Images should have titles that match team names and a single digit numerical description that matches team color (0 for either/both, 1 for red, 2 for blue)
// var Images = [];  // not implemented atm

var LiveScoreboard_ImagesAlbum = 'https://imgur.com/a/wk6yl';

var fix_position_x = 'mid';  // can be either false, mid, left, right, mid-left, mid-right
var fix_position_y = 'bot';  // can be either false, top, mid, bot, top-mid, mid-bot

var client_id = 'c638f51525edea6';  // don't steal my client-id. get your own very quickly from here: https://api.imgur.com/oauth2/addclient

var default_data = {stored: true, active: true, isPrivate: false, games: 2, offsets: [[0, 0, 0, 0], [0, 0, 0, 0]], selectedhalf: 0, leagues: [], scoreboard_images: []};  // default data

var debug = false;

function logd(message) {
    if (debug) console.log(message);
}

class Settings {
    constructor(data) {
        this.prefix = 'TPLS_';
        if (GM_getValue(this.prefix+'stored') === undefined) {   // never stored values yet
            this.data = data;
            this.store_all();
        } else {
            this.data = {};
            for (var d in default_data) {
                this.data[d] = GM_getValue(this.prefix+d);
            }
        }
    }
    set(variable, value) {
        this.data[variable] = value;
        GM_setValue(this.prefix+variable, value);
        logd('have set ' + variable + ' to: ');
        logd(value);
        logd('check ' + this.prefix + variable + ' was set to:');
        logd(GM_getValue(this.prefix+variable));
    }
    delete(variable) {
        delete this.data[variable];
        GM_deleteValue(this.prefix+variable);
    }
    get(variable, share_prefix) {
        share_prefix = share_prefix || false;
        var value = (share_prefix)?(JSON.parse(window.localStorage.getItem(share_prefix+variable))):GM_getValue(this.prefix+variable);
        logd((share_prefix)?(variable + ' (from localStorage) is:'):(variable + ' is:'));
        logd(value);
        var keys = Object.keys(default_data);
        var found = false;
        for(var i = 0; i < keys.length; i++) {
            if (keys[i] === variable) found = true;
        }
        if (value === undefined && !found) {
            this.set(variable, default_data[variable]);
            return default_data[variable];
        } else return value;
    }
    share(variable) {
        window.localStorage.setItem(this.prefix+variable, JSON.stringify(this.data[variable]));
    }
    store_all() {
        for (var d in this.data) {
            GM_setValue(this.prefix+d, this.data[d]);
        }
    }
    log_all() {
        for (var d in this.data) {
            console.log(d + ': ' + this.data[d]);
        }
    }
    delete_all() {
        for (var d in this.data) {
            GM_deleteValue(this.prefix+d);
        }
    }
}

function ObjectIndexOf(myArray, property, searchTerm) {  // searches for a property in a {}-object
    for(var i = 0, len = myArray.length; i < len; i++) {
        if (myArray[i][property] === searchTerm) return i;
    }
    return -1;
}


function ajax_read_albums() {
    for (var a = 0; a < Albums.length; a++) {
        var match = /([A-Za-z0-9_]+)\|([A-Za-z0-9]+)/;  // imgur description will be matched for this
        logd('Albums['+a+']: ' + Albums[a]);
        var id = Albums[a].match(/http[s]?:\/\/imgur\.com\/a\/(.+)[\/]?/)[1];  // [0] is the whole string, [1] only the matched group (.+);
        logd('id: ' + id);
        $.ajax({
            url: 'https://api.imgur.com/3/album/'+id+'/images',
            headers: {
                'Authorization': 'Client-ID '+client_id  // don't steal my client-id. get your own very quickly from here: https://api.imgur.com/oauth2/addclient
            },
            type: 'GET',
            success: function(ajax) {
                var data = settings.get('leagues');
                ajax.data.forEach(function(curr) {
                    if(curr.description && curr.title)
                    {
                        var descriptor = curr.description.match(match);
                        var league_index = ObjectIndexOf(data, "league", descriptor[1]);
                        logd('descriptor[1]:');
                        logd(descriptor[1]);
                        if (league_index === -1)  // new league
                        {
                            data.push({"league": descriptor[1], "teams": []});
                            league_index = data.length-1;
                        }
                        var team_index = ObjectIndexOf(data[league_index].teams, "team", curr.title);
                        var logo = descriptor[2];
                        if(team_index === -1)  // new team
                        {
                            data[league_index].teams.push({"team": curr.title, logos: {}});
                            team_index = data[league_index].teams.length-1;
                        }
                        logd('league_index:');
                        logd(league_index);
                        logd('team_index:');
                        logd(team_index);
                        data[league_index].teams[team_index].logos[logo] = curr.id;
                    }
                });
                logd('ajax2 data: ' + data);
                settings.set('leagues', data);
            }
        });
    }
}

function ajax_read_livescoreboard_images() {
    var id = LiveScoreboard_ImagesAlbum.match(/http[s]?:\/\/imgur\.com\/a\/(.+)[\/]?/)[1];  // [0] is the whole string, [1] only the matched group (.+);
    $.ajax({
        url: 'https://api.imgur.com/3/album/'+id+'/images',
        headers: {
            'Authorization': 'Client-ID '+client_id  // don't steal my client-id. get your own very quickly from here: https://api.imgur.com/oauth2/addclient
        },
        type: 'GET',
        success: function(ajax) {
            var images = [];  // settings.get('scoreboard_images');
            ajax.data.forEach(function(curr) {
                if(curr.title)
                {
                    var zpos = 0;
                    if (curr.description) zpos = curr.description.match(/([0-9]+)/)[1] || 0;  // if no description or description is not a number, use default z-position 0
                    logd('zpos: ' + zpos);
                    images.push({"id": curr.id, "name": curr.title, "width": curr.width, "height": curr.height, "zpos": zpos});
                }
            });
            images.sort(function(a, b) {
                if (a.zpos > b.zpos) return 1;
                else return -1;
            });
            logd(images);
            settings.set('scoreboard_images', images);
        }
    });
}

function inactive_hide() {
    $("#tpls-ul").hide();
    $("#tpls-header").css('background', '#cb6100');
}

function create_html() {
    var data = settings.get('leagues');
    var $spectators = $('#spectators');
    $('<div id="tpls" class="col-md-12 private-game"><div id="tpls_group" class="player-group"><div id="tpls-header" class="player-group-header" style="background: #e69200; color: #fff;"><div class="team-name">TagPro LiveScoreboard</div><div class="pull-right"><label class="btn btn-default" id="tpls_switch"><input type="checkbox" name="tpls_active"> active</label></div><div class="clearfix"></div></div><ul id="tpls-ul" style="font-size:14px; background: #353535; border-radius: 0 0 3px 3px; border: 1px solid #404040; border-top: 1px solid #2b2b2b; padding: 10px; overflow-y: auto;"></ul></div></div>').insertBefore('#spectators');
    $('input[name="tpls_active"]').prop('checked', settings.get('active'));
    $('input[name="tpls_active"]').change(function() {
        settings.set('active', this.checked);
        if (this.checked) {
            settings.set('active', true);
            $("#tpls-ul").show();
            $("#tpls-header").css('background', '#e69200');
            // $("label#tpls-league").show();
            html_data();
        } else {
            settings.set('active', false);
            inactive_hide();
        }
    });

    var $playerGroup = $('#tpls-ul');
    $playerGroup.append('<div id="tpls_games">Games: </div>');
    for (var i = 1; i <= 3; i++) {
        $('#tpls_games').append('<label class="btn btn-default"><input type="radio" name="tpls_games" value="' + i + '"> ' + i + '</label>');
    }
    $('input[name="tpls_games"][value="' + settings.get('games') + '"]').attr('checked', true);
    $('input[name="tpls_games"]').change(function() {  // when one of the "games" buttons is pushed
        var games = $(this).prop('value'),
            offsets = settings.get('offsets');
        settings.set('games', games);
        while (offsets.length < games) offsets.push([0, 0, 0, 0]);
        while (games < offsets.length) offsets.pop();
        settings.set('offsets', offsets);
        settings.log_all();
        html_data();
    });
    html_data();

    if (!settings.get('active')) inactive_hide();
}

function html_data() {
    var data = settings.get('leagues'),
        games = settings.get('games'),
        offsets = settings.get('offsets'),
        $playerGroup = $('#tpls-ul');

    $('#tpls_offsets_div').remove();
    $playerGroup.append('<div id="tpls_offsets_div">Offsets: <table id="tpls_offsets"></table></div>');
    logd(offsets);
    for (var i = 0; i < games; i++) {
        $('#tpls_offsets').append('<tr><td>Game ' + parseInt(i+1) + '&nbsp;</td><td>H1</td><td><input type="text" name="tpls_offset_' + i + '_0_0" class="form-control" style="width:40px" value="' + offsets[i][0] + '"></td><td><input type="text" name="tpls_offset_' + i + '_0_1" class="form-control" style="width:40px" value="' + offsets[i][1] + '"></td><td>H2</td><td><input type="text" name="tpls_offset_' + i + '_1_0" class="form-control" style="width:40px" value="' + offsets[i][2] + '"></td><td><input type="text" name="tpls_offset_' + i + '_1_1" class="form-control" style="width:40px" value="' + offsets[i][3] + '"></td></tr>');
        //$('#tpls_offsets').append('<tr><td>Game ' + i + '</td><td style="width:40px"><div class="player-group-header"><div class="team-score pull-right"><div class="offset-value js-socket-setting" name="tpls_offset_' + i + '_1">0</div><div class="offset-buttons"><svg class="up-score" data-name="tpls_offset_' + i + '_1" data-value="1" viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><path d="M1408 1216q0 26-19 45t-45 19h-896q-26 0-45-19t-19-45 19-45l448-448q19-19 45-19t45 19l448 448q19 19 19 45z"></path></svg><svg class="down-score" data-name="tpls_offset_' + i + '_1" data-value="-1" viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><path d="M1408 704q0 26-19 45l-448 448q-19 19-45 19t-45-19l-448-448q-19-19-19-45t19-45 45-19h896q26 0 45 19t19 45z"></path></svg></div><div class="clearfix"></div></div></td><td></td></tr>');
    }
    /*$(".offset-buttons svg").click(function(e) {
        var r = $(this).data("name"),
            i = parseInt($(this).data("value"), 10);
        console.log(r, i);
    });*/
    function change_offset(elem, dvalue) {
        var offsets = settings.get('offsets'),
            value = parseInt(elem.prop('value')),
            newvalue = value+dvalue,
            match = elem.prop('name').match(/tpls_offset_([0-9]+)_([0-9]+)_([0-9]+)/),
            game = match[1],
            half = match[2],
            lr = match[3];
            logd(game + "|" + half + "|" + lr);
        if (newvalue >= 0) {
            elem.prop('value', newvalue);
            offsets[game][parseInt(2*half)+parseInt(lr)] = newvalue;
            settings.set('offsets', offsets);
        }
    }

    $('#tpls_offsets input').keydown(function (e) {
        var keyCode = e.keyCode || e.which,
            arrow = {left: 37, up: 38, right: 39, down: 40 };
        if (keyCode == arrow.up) change_offset($(this), +1);
        else if (keyCode == arrow.down) change_offset($(this), -1);
    });
    $('#tpls_offsets input').bind('mousewheel DOMMouseScroll', function (event) {
        event.preventDefault();  // disables scrolling temporarily
        if (event.originalEvent.wheelDelta > 0 || event.originalEvent.detail < 0) change_offset($(this), +1);
        else change_offset($(this), -1);
    });

    $('#tpls_half').remove();
    $playerGroup.append('<div id="tpls_half">Half: </div>');
    for (i = 0; i < settings.get('games')*2; i++) {
        $('#tpls_half').append('<label class="btn btn-default"><input type="radio" name="tpls_selected_half" value="' + i + '"> ' + parseInt(i+1) + '</label>');
    }
    $('input[name="tpls_selected_half"][value="' + settings.get('selectedhalf') + '"]').attr('checked', true);
    $('input[name="tpls_selected_half"]').change(function() {  // when one of the "half" buttons is pushed
        var half = $(this).prop('value');
        settings.set('selectedhalf', half);
    });
}

function sort_data() {
    // sort data
    var data = settings.get('leagues');
    data.sort(function(a, b) {  // sort data by league name:
        var nameA = a.league.toUpperCase();
        var nameB = b.league.toUpperCase();
        return nameA.localeCompare(nameB);
    });
    for (var l = 0; l < data.length; l++) {  // sort teams in each league
        data[l].teams.sort(function(a, b) {
            var nameA = a.team.toUpperCase();
            var nameB = b.team.toUpperCase();
            return nameA.localeCompare(nameB);
        });
    }
    settings.set('leagues', data);
}

function get_default_position(axis, maxdim) {
    if (axis == 'l' || axis == 'x') {
        var posl = false;
        switch(fix_position_x) {
            case 'left':
                posl = 0;
                break;
            case 'mid':
                posl = Math.floor((window.innerWidth-maxdim)/2);
                break;
            case 'right':
                posl = window.innerWidth-maxdim;
                break;
            case 'left-mid':
                posl = Math.floor((window.innerWidth-maxdim)/4);
                break;
            case 'mid-right':
                posl = Math.floor((window.innerWidth-maxdim)/4*3);
                break;
        }
        return posl;
    } else if (axis == 't' || axis == 'y') {
        var post;
        switch(fix_position_y) {
            case 'top':
                post = 0;
                break;
            case 'mid':
                post = Math.floor((window.innerHeight-maxdim)/2);
                break;
            case 'bot':
                post = window.innerHeight-maxdim;
                break;
            case 'top-mid':
                post = Math.floor((window.innerHeight-maxdim)/4);
                break;
            case 'mid-bot':
                post = Math.floor((window.innerHeight-maxdim)/4*3);
                break;
        }
        return post;
    }
}

function getTime(show_milli) {
    var millis = Math.max(0, tagpro.gameEndsAt - Date.now());
    var min = (millis/1000/60) << 0;
    var sec = (((millis/1000) % 60 << 0));
    var mil = millis % 10 << 0;
    sec = (sec<10)?'0'+sec:sec;
    var ret = min + ":" + sec;
    if (show_milli) ret += "." + mil;
    return (millis>0)?ret:'end';
}

function hideSprite(sprite) {
    if (tagpro.ui.sprites[sprite] !== undefined) {
        setTimeout(function() {tagpro.ui.sprites[sprite].visible = false;}, 0);
    } else {
        setTimeout(hideSprite, 100);
    }
}

var WhereAmI = function(){
    if (window.location.port) {
        return('game');
    } else if (window.location.pathname.startsWith('/groups/')) {
        return('group');
    } else {
        return('elsewhere');
    }
};

var IAmIn = WhereAmI();
var settings = new Settings(default_data);
// settings.delete_all();
// settings = new Settings(default_data);
// settings.log_all();

if(IAmIn === 'group')  // group page
{
    var init = false;
    tagpro.group.socket.on('private',function(priv) {
        if (!priv.isPrivate) settings.set('isPrivate', false);
        if (priv.isPrivate && !init)
        {
            ajax_read_albums();
            ajax_read_livescoreboard_images();
            sort_data();
            settings.store_all();
            create_html();
            html_data();
            settings.set('isPrivate', true);
            init = true;
            tagpro.group.socket.on('setting',function(setting) {
                if (setting.name === 'redTeamName') {
                    settings.set('redTeamName', setting.value);
                } else if (setting.name === 'blueTeamName') {
                    var redTeamName = settings.get('redTeamName'),
                        blueTeamName = settings.get('blueTeamName');
                    logd(redTeamName);
                    logd(blueTeamName);
                    logd(setting.value);
                    if (redTeamName === blueTeamName) {  //  || setting.value === 'Blue' && blueTeamName === 'Blue'  // TODO: also triggers when refreshing/coming back from game, workaround?
                        var games = settings.get('games'),
                            offsets = settings.get('offsets');
                        for (var i = 0; i < games; i++ ){
                            var $offset00 = $('input[name="tpls_offset_' + i + '_0_0"]'),
                                $offset01 = $('input[name="tpls_offset_' + i + '_0_1"]'),
                                offset00val = $('input[name="tpls_offset_' + i + '_0_0"]').val(),
                                offset01val = $('input[name="tpls_offset_' + i + '_0_1"]').val(),
                                $offset10 = $('input[name="tpls_offset_' + i + '_1_0"]'),
                                $offset11 = $('input[name="tpls_offset_' + i + '_1_1"]'),
                                offset10val = $('input[name="tpls_offset_' + i + '_1_0"]').val(),
                                offset11val = $('input[name="tpls_offset_' + i + '_1_1"]').val();
                            $offset00.val(offset01val);
                            $offset01.val(offset00val);
                            $offset10.val(offset11val);
                            $offset11.val(offset10val);
                            offsets[i] = [offset01val, offset00val, offset11val, offset10val];
                        }
                        settings.set('offsets', offsets);
                    }
                    settings.set('blueTeamName', setting.value);
                }
            });
        }
    });
}
else if (IAmIn === 'game') {
    tagpro.ready(function() {
        var leagues = settings.get('leagues'),
            shared_leagues = settings.get('leagues', 'TPNJ_'),
            lastRedTeam = settings.get('lastRedTeam', 'TPNJ_'),
            lastBlueTeam = settings.get('lastBlueTeam', 'TPNJ_'),
            known_teams = settings.get('known_teams', 'TPNJ_');
        logd('leaguesies:');
        logd(leagues);
        logd('shared_leaguesies:');
        logd(shared_leagues);
        for (var i = 0; i < leagues.length; i++) {  // add logos to the shared_leagues object
            var index1 = ObjectIndexOf(shared_leagues, 'league', leagues[i].league);
            for (var j = 0; j < leagues[i].teams.length; j++) {
                var index2 = ObjectIndexOf(shared_leagues[index1].teams, 'team', leagues[i].teams[j].team);
                logd('team:');
                logd(leagues[i].teams[j].team);
                logd('index1: ' + index1 + ', index2: ' + index2);
                logd('shared_leagues[' + index1 + ']:');
                logd(shared_leagues[index1]);
                logd('leagues[' + i + ']:');
                logd(leagues[i]);
                // if (!shared_leagues[index1].teams[index2].logos) shared_leagues[index1].teams[index2]["logos"] = {};
                if (index1 >= 0 && index2 >= 0) shared_leagues[index1].teams[index2].logos = leagues[i].teams[j].logos;
            }
        }

        if (tagpro.group.socket && settings.get('isPrivate') && settings.get('active'))  // if script is activated and group is private
        {
            var offsets = settings.get('offsets'),
                selectedhalf = settings.get('selectedhalf'),
                images = settings.get('scoreboard_images'),
                position = settings.get('position'),
                maxwidth = 0,
                maxheight = 0,
                window_height = window.innerHeight,
                window_width = window.innerWidth;
            for (i = 0; i < images.length; i++) {
                if (images[i].width > maxwidth) maxwidth = images[i].width;
                if (images[i].height > maxheight) maxheight = images[i].height;
            }
            logd(maxwidth, maxheight, window_width, window_height);
            var posl = get_default_position('l', maxwidth),
                post = get_default_position('t', maxheight);
            $('body').append('<div id="LiveScoreboard_Container" style="position:absolute; width: ' + maxwidth + 'px; height: ' + maxheight + 'px; left: ' + posl + 'px; top: ' + post + 'px;"><div id="LiveScoreboard"></div></div>');

            // hideSprite('redScore');
            // hideSprite('blueScore');
            // hideSprite('redFlag');
            // hideSprite('blueFlag');
            // hideSprite('timer');
            tagpro.ui.scores = function() {};
            tagpro.ui.updateFlags = function(e, t, n) {};
            tagpro.ui.timer = function(e, t, n, r) {
                var i = tagpro.ui.sprites.timer;
                i || (i = tagpro.ui.sprites.timer = new PIXI.Text("",{
                    fill: "#FFFFFF",
                    strokeThickness: 4,
                    stroke: "#000000",
                    font: "bold 30pt Arial"
                }),
                      i.alpha = 0.0,
                      i.anchor.x = 0.5,
                      e.addChild(tagpro.ui.sprites.timer)),
                    i.text != r && i.setText(r),
                    i.visible = !!tagpro.settings.ui.matchState;
            };
            // tagpro.ui.sprites.redScore.alpha = 0;
            // tagpro.ui.sprites.blueScore.alpha = 0;
            // tagpro.ui.sprites.redFlag.alpha = 0;
            // tagpro.ui.sprites.blueFlag.alpha = 0;
            // tagpro.ui.sprites.timer.alpha = 0;
            console.log(tagpro.ui.sprites);
            // tagpro.renderer.layers.ui.removeChild(tagpro.ui.sprites.redScore);
            // tagpro.renderer.layers.ui.removeChild(tagpro.ui.sprites.blueScore);
            // tagpro.renderer.layers.ui.removeChild(tagpro.ui.sprites.redFlag);
            // tagpro.renderer.layers.ui.removeChild(tagpro.ui.sprites.blueFlag);
            // tagpro.renderer.layers.ui.removeChild(tagpro.ui.sprites.timer);
            var $LiveScoreboard_Container = $('#LiveScoreboard_Container'),
                $LiveScoreboard = $('#LiveScoreboard');
            for (i = 0; i < images.length; i++) {
                logd(images[i].zpos);
                $LiveScoreboard.append('<div id="' + images[i].name + '" style="position:absolute; height: ' + images[i].height + 'px; width: ' + images[i].width + 'px; background-image: url(http://i.imgur.com/' + images[i].id + '.png);"></div>');
            }
            $LiveScoreboard_Container.draggable({
                delay: 100,
                snap: true,
                grid: [10, 10],
                // axis: "x",  // restricts dragging in the y-axis
                containment: 'window',
                scroll: false,
                drag: function(event, ui) {
                },
                stop: function(event, ui) {
                    settings.set('position', {'top': ui.position.top, 'left': ui.position.left});
                    // $LiveScoreboard_Container.css('border', 'none');
                }
            });

            // $('#GameCardL1').hide();
            // $('#GameCardL2').hide();

            // add time
            $LiveScoreboard.append('<div id="timer" style="position:absolute; left:292px; top:15px; width:52px; height:14px; text-align:center;"></div>');
            $("#timer").append('<div id="timerText" style="text-align:center; font-weight:bold; color:white; font-family:\'Sans\'; font-size:12px">00:00</div>');
            // add scores
            $LiveScoreboard.append('<div id="redScore" style="position:absolute; left:245px; top:30px; width:45px; height:45px; text-align:center;"></div>');
            $LiveScoreboard.append('<div id="blueScore" style="position:absolute; left:345px; top:30px; width:45px; height:45px; text-align:center;"></div>');
            rhalfindex = (selectedhalf % 2 === 0?0:2);
            bhalfindex = (selectedhalf % 2 === 0?1:3);
            $("#redScore").append('<div id="redScoreText" style="text-align:center; font-weight:bold; color:white; font-family:\'Sans\'; font-size:40px">' + offsets[Math.floor(selectedhalf/2)][rhalfindex] + '</div>');
            $("#blueScore").append('<div id="blueScoreText" style="text-align:center; font-weight:bold; color:white; font-family:\'Sans\'; font-size:40px">' + offsets[Math.floor(selectedhalf/2)][bhalfindex] + '</div>');
            // add cumulative scores if in half 2
            logd('offset:');
            logd(offsets[Math.floor(selectedhalf/2)]);
            $LiveScoreboard.append('<div id="redScore2" style="position:absolute; left:284px; top:71px; width:32px; height:24px; text-align:center; font-weight:bold; color:white; font-family:\'Sans\'; font-size:20px">' + parseInt(offsets[Math.floor(selectedhalf/2)][0] + offsets[Math.floor(selectedhalf/2)][2] + (tagpro.score.r || 0)) + '</div>');
            $LiveScoreboard.append('<div id="blueScore2" style="position:absolute; left:320px; top:71px; width:32px; height:24px; text-align:center; font-weight:bold; color:white; font-family:\'Sans\'; font-size:20px">' + parseInt(offsets[Math.floor(selectedhalf/2)][1] + offsets[Math.floor(selectedhalf/2)][3] + (tagpro.score.b || 0)) + '</div>');
            // $("#redScore").append('<div id="redScore2Text" style="text-align:center; font-weight:bold; color:white; font-family:\'Sans\'; font-size:20px">' + parseInt(offsets[Math.floor(selectedhalf/2)] + (tagpro.score.r || 0)) + '</div>');
            // $("#blueScore").append('<div id="blueScore2Text" style="text-align:center; font-weight:bold; color:white; font-family:\'Sans\'; font-size:20px">' + parseInt(offsets[Math.floor(selectedhalf/2)] + (tagpro.score.b || 0)) + '</div>');
            tagpro.socket.on('score', function(score) {
                var selectedhalf = settings.get('selectedhalf'),
                    offsets = settings.get('offsets'),
                    rhalfindex = (selectedhalf % 2 === 0?0:2),
                    bhalfindex = (selectedhalf % 2 === 0?1:3),
                    rs = parseInt(offsets[Math.floor(selectedhalf/2)][rhalfindex]) + parseInt(score.r),
                    bs = parseInt(offsets[Math.floor(selectedhalf/2)][bhalfindex]) + parseInt(score.b),
                    rs2 = parseInt(parseInt(offsets[Math.floor(selectedhalf/2)][0]) + (selectedhalf % 2 === 1?parseInt(offsets[Math.floor(selectedhalf/2)][2]):0) + parseInt(score.r)),
                    bs2 = parseInt(parseInt(offsets[Math.floor(selectedhalf/2)][1]) + (selectedhalf % 2 === 1?parseInt(offsets[Math.floor(selectedhalf/2)][3]):0) + parseInt(score.b));
                $("#redScoreText").html(rs);
                $("#blueScoreText").html(bs);
                $("#redScore2").html(rs2);
                $("#blueScore2").html(bs2);
                /*offsets[Math.floor(selectedhalf/2)][rhalfindex] = rs;
                offsets[Math.floor(selectedhalf/2)][bhalfindex] = bs;*/
                //settings.set('offsets', offsets);
            });
            if (selectedhalf%2===0) {
                $("#redScore2").hide();
                $("#blueScore2").hide();
            }

            var d, img;
            if(lastRedTeam) d = lastRedTeam.split('.');
            if (d !== undefined) {
                try {
                    img = shared_leagues[d[0]].teams[d[1]].logos.L440;  // if lastRedTeam is not of the format "league.team.jersey"
                } catch(e) {
                    logd('L440 Logo for red team not found!');
                    img = 'SViDkXM';  // blank image
                }
            }
            var db, imgb;
            if(lastBlueTeam) db = lastBlueTeam.split('.');
            if (db !== undefined) {
                try {
                    imgb = shared_leagues[db[0]].teams[db[1]].logos.L440;
                } catch(e) {
                    logd('L440 Logo for blue team not found!');
                    imgb = 'SViDkXM';
                }
            }
            // $LiveScoreboard.append('<div id="redlogo" style="position:absolute; left:138px; top:15px; width:80px; height:80px; text-align:center; background-size: 100% 100%; background-image: url(http://i.imgur.com/' + img + '.png);"></div>');
            // $LiveScoreboard.append('<div id="bluelogo" style="position:absolute; left:418px; top:15px; width:80px; height:80px; text-align:center; background-size: 100% 100%; background-image: url(http://i.imgur.com/' + imgb + '.png);"></div>');
            // $('<div id="redlogo" style="position:absolute; left:138px; top:15px; width:80px; height:80px; text-align:center; background-size: 100% 100%; background-image: url(http://i.imgur.com/' + img + '.png); clip-path: url(#clipRed);"><svg width="0" height="0"><defs><clipPath id="clipRed"><circle cx="0" cy="160" r="300"/></clipPath></defs></svg></div>').insertAfter('#BG');
            $('<div id="redlogo" style="position:absolute; left:138px; top:15px; width:80px; height:80px;"><img width="100%" height="100%" style="clip-path: url(#clipRed);" src="http://i.imgur.com/' + img + '.png"><svg width="0" height="0"><defs><clipPath id="clipRed"><circle cx="90" cy="170" r="170"/></clipPath></defs></svg></div>').insertAfter('#BG');
            $('<div id="bluelogo" style="position:absolute; left:418px; top:15px; width:80px; height:80px;"><img width="100%" height="100%" style="clip-path: url(#clipBlue);" src="http://i.imgur.com/' + imgb + '.png"><svg width="0" height="0"><defs><clipPath id="clipBlue"><circle cx="-10" cy="170" r="170"/></clipPath></defs></svg></div>').insertAfter('#redlogo');
            $(window).resize(function() {
                $LiveScoreboard_Container.css('top', post || parseInt(position.top*(window.innerHeight/window_height)));
                $LiveScoreboard_Container.css('left', posl || parseInt(position.left*(window.innerWidth/window_width)));
                settings.set('position', {'top': $LiveScoreboard_Container.css('top'), 'left': $LiveScoreboard_Container.css('left')});
            });

             tagpro.socket.on('end', function(data) {
                 var selectedhalf = parseInt(settings.get('selectedhalf')),
                     offsets = settings.get('offsets'),
                     ofs = offsets[Math.floor(selectedhalf/2)];
                 logd('endoffsets:');
                 logd(offsets);
                 logd('ofs:');
                 logd(ofs);
                 logd('new half: ' + parseInt(selectedhalf+1));
                 logd('selectedhalf%2===' + selectedhalf%2);
                 if(selectedhalf%2===0) {
                     offsets[selectedhalf/2] = [parseInt(ofs[0]+parseInt(tagpro.score.r)), parseInt(ofs[1] + parseInt(tagpro.score.b)), ofs[2], ofs[3]];
                 } else {
                     offsets[Math.floor(selectedhalf/2)] = [ofs[0], ofs[1], parseInt(ofs[2]+parseInt(tagpro.score.r)), parseInt(ofs[3]+parseInt(tagpro.score.b))];
                 }
                 settings.set('selectedhalf', parseInt(selectedhalf+1));
                 settings.set('offsets', offsets);
             });

            (function update_time() {
                var time = getTime(false);
                $("#timerText").html(time);
                setTimeout(update_time, 100);
            })();
        } else {  // if not in group
            settings.set('isPrivate', false);
        }
    });
}
