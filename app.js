const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session)
const flash = require('connect-flash');
const csrf = require('csurf');
const router = require('./router');
const markdown = require('marked');
const sanitizeHTML = require('sanitize-html');
const app = express();

app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.use('/api', require('./router-api'));


let sessionOptions = session({
    secret: "Supersecret session secret",
    store: new MongoStore({client: require('./db')}),
    resave: false,
    saveUninitialized: false,
    cookie: {maxAge: 1000*60*60*24,httpOnly:true}
});



app.use(sessionOptions);
app.use(flash());

app.use(function(req, res, next) {
    //make markdown available to ejs templates
    res.locals.filterUserHTML = function(content) {
        return sanitizeHTML(markdown(content), {allowedTags: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'bold', 'i', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'], allowedAttributes: {}})

    }


    //add error/flash messages to all templates
    res.locals.errors = req.flash("errors");
    res.locals.success = req.flash("success");
    //make user id available to the req object
    if (req.session.user) {req.visitorId = req.session.user._id} else {req.visitorId = 0}
    
    //make user session data available to the ejs templates
    res.locals.user = req.session.user;
    next();
});



app.use(express.static('public'));
//app.use(express.static(__dirname));
app.use(express.static('./'));
app.set('views', 'views');
app.set('view engine', 'ejs');

app.use(csrf());
app.use(function(req, res, next) {
    res.locals.csrfToken = req.csrfToken();
    next();
});

app.use('/', router);

app.use(function(err, req, res, next){
    if(err) {
        if(err.code == "EBADCSRFTOKEN") {
            req.flash('errors', "Invalid request detected, please try again.");
            req.session.save(()=> res.redirect('/'));
        } else {
            res.render("404");

        }
    }
});
const server = require('http').createServer(app);

const io = require('socket.io')(server);

io.use(function(socket, next) {
    sessionOptions(socket.request, socket.request.res, next);
});

io.on('connection', (socket) => {
    if (socket.request.session.user) {
        let user = socket.request.session.user;
        socket.emit('welcome', {username: user.username, avatar: user.avatar});
        socket.on('chatMessageFromBrowser', (data) => {
            socket.broadcast.emit('chatMessageFromServer', {message: sanitizeHTML(data.message, {allowedTags:[], allowedAttributes: []}), username: user.username, avatar: user.avatar});
        })
    
    }
});

module.exports = server;


