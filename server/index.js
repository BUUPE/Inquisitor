require('dotenv').config()

const express = require('express');
const socketIO = require('socket.io');
const path = require("path");
const fs = require('fs');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const SamlStrategy = require('passport-saml').Strategy;

const app = express();
const samlStrategy = new SamlStrategy(
  {
    path: '/login/callback',
    entryPoint: 'https://shib-test.bu.edu/idp/profile/SAML2/Redirect/SSO',
    issuer: 'http://upe-interview.bu.edu/bushibboleth/sp',
    identifierFormat: null,
    decryptionPvk: JSON.parse(`"${process.env.SHIBBOLETH_KEY}"`),
    privateCert: JSON.parse(`"${process.env.SHIBBOLETH_KEY}"`),
    cert: JSON.parse(`"${process.env.SHIBBOLETH_IDP_CERT}"`),
    validateInResponseTo: false,
    disableRequestedAuthnContext: true
  },
  (profile, done) => {
    return done(null, profile);
    /*findByEmail(profile.email, function(err, user) {
      if (err) {
        return done(err);
      }
      return done(null, user);
    });*/
  });

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(user, done) {
  done(null, user);
});

passport.use(samlStrategy);
app.use(express.static(path.join(__dirname, '../build')));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'testtest',
  resave: true,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

const ensureAuthenticated = (req, res, next) => {
  if (req.isAuthenticated())
    return next();
  else
    return res.redirect('/login');
}

app.get('/login',
  passport.authenticate('saml', { failureRedirect: '/login/fail' }),
  (req, res) => res.redirect('/secret')
);

app.post('/login/callback',
  passport.authenticate('saml', { failureRedirect: '/login/fail' }),
  (req, res) => res.redirect('/secret')
);

app.get('/login/fail',
  (req, res) => res.status(401).send('Login failed')
);

app.get('/secret',
  ensureAuthenticated,
  (req, res) => {
    const name = `${req.user['urn:oid:2.5.4.42']} ${req.user['urn:oid:2.5.4.4']}`;
    const email = req.user['urn:oid:1.3.6.1.4.1.5923.1.1.1.6'];
    const role = req.user['urn:oid:1.3.6.1.4.1.5923.1.1.1.5'];
    const roleSpecification = req.user['urn:oid:2.5.4.12'];
    const organization = req.user['urn:oid:2.5.4.10'];
    res.send(`Hello ${name} (${email})! You are a ${role} (${roleSpecification}) in ${organization}.`);
  }
);

app.get('/shibboleth/metadata',
  (req, res) => {
    res.type('application/xml');
    const cert = JSON.parse(`"${process.env.SHIBBOLETH_CERT}"`);
    res.status(200).send(samlStrategy.generateServiceProviderMetadata(cert, cert));
  }
);

app.get('/api/getAuthUser',
  (req, res) => {
    if (req.user === undefined) {
      res.json(null);
    } else {
      res.json(req.user);
    }
  }
);

app.get('/*', (req, res) => res.sendFile(path.join(__dirname, '../build/index.html')));

app.use(function(err, req, res, next) {
  console.error("Fatal error: " + JSON.stringify(err));
  next(err);
});

const serverPort = process.env.PORT || 3030;
const server = app.listen(serverPort, () => console.log(`Listening on port ${serverPort}`));

const io = socketIO(server);
io.on('connection', (client) => {
  client.on('joinInterview', interviewId => {
    client.join(interviewId);
    client.emit('joinConfirmation', `you've joined room ${interviewId}`)
    client.broadcast.to(interviewId).emit('joinNotification', `client: ${client.id} has joined room ${interviewId}`);
  });

  client.on('problemChange', ({ interviewId, problemKey }) =>
    client.broadcast.to(interviewId).emit('problemChange', problemKey));

  client.on('interviewClosed', interviewId =>
    client.broadcast.to(interviewId).emit('interviewClosed', true));
});
