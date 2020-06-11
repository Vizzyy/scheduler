const express = require('express');
const router = express.Router();
const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');
var secured = require('../middleware/secured');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

let creds = null;
const calendar_id = "aol2rcuqq67adv9121bpn5hias@group.calendar.google.com";
let appointment_datetime_start = null;
let appointment_datetime_end = null;
let appointment_name = null;
let appointment_email = null;

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Calendar API.
    creds = JSON.parse(content);
    authorize(creds, listEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getAccessToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err);
            oAuth2Client.setCredentials(token);
            // Store the token to disk for later program executions
            fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) return console.error(err);
                console.log('Token stored to', TOKEN_PATH);
            });
            callback(oAuth2Client);
        });
    });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
    const calendar = google.calendar({version: 'v3', auth});
    calendar.events.list({
        calendarId: calendar_id,
        timeMin: (new Date()).toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const events = res.data.items;
        if (events.length) {
            console.log('Upcoming 10 events:');
            events.map((event, i) => {
                const start = event.start.dateTime || event.start.date;
                console.log(`${start} - ${event.summary}`);
            });
        } else {
            console.log('No upcoming events found.');
        }
    });
}

router.get('/', secured(), function (req, res) {
    res.render('index');
});

function addEvent(auth){
    const calendar = google.calendar({version: 'v3', auth});
    var event = {
        'summary': appointment_name,
        'description': appointment_email,
        'start': {
            'dateTime': appointment_datetime_start,
            'timeZone': 'America/New_York',
        },
        'end': {
            'dateTime': appointment_datetime_end,
            'timeZone': 'America/New_York',
        },
        'attendees': [
            {'email': appointment_email}
        ],
        'reminders': {
            'useDefault': false,
            'overrides': [
                {'method': 'email', 'minutes': 10},
                {'method': 'popup', 'minutes': 5},
            ],
        },
    };

    console.log(event);
    calendar.events.insert({
        auth: auth,
        calendarId: calendar_id,
        resource: event,
    }, function(err, event) {
        if (err) {
            console.log('There was an error contacting the Calendar service: ' + err);
            return;
        }
        console.log('Event created: %s', event);
        console.log('Event created: %s', event.data);
    });

}


router.post(('/add'), secured(), function (request, response) {
    console.log(JSON.stringify(request.body));
    console.log(request.user._json);
    // console.log(req);
    appointment_datetime_start = ""+request.body.datetimestart+":00";
    appointment_datetime_end = ""+request.body.datetimeend+":00";
    console.log(appointment_datetime_start);
    console.log(appointment_datetime_end);
    appointment_email = request.user._json.email;
    appointment_name = request.body.dogname
    authorize(creds, addEvent);
    // appointment_datetime_start = null;
    // appointment_datetime_end = null;
    // appointment_email = null;
    // appointment_name = null;
    response.render('index');

});

module.exports = router;
