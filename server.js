// ===========================================================
// 							SETUP 
// ===========================================================

// ---------------------- PACKAGES -------------------------
var express = require('express'),  // call express
	app = express(),			// define the app using express
	bodyParser =require('body-parser'), // get body parser
	morgan = require('morgan'), // used to see requests
	mongoose = require('mongoose'), // for working with DB
	port = process.env.PORT || 8080; // set the port for the app

// ----------------- APP CONFIGURATION -------------------------
// use body parser to grab information from POST requests
app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());

// Handle CORS requests
app.use(function(req, res, next) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
	res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, content-type, Authorization');
	next();
});

// Log all requests to the console
app.use(morgan('dev'));

// Connect to the database
mongoose.connect('mongodb://localhost:27017/test');

// Loading users
var User = require('./app/models/user');

// Grab the JSON Web Token Package
var jwt = require('jsonwebtoken');

// Secret to create the tokens
var superSecret = 'testapplication';


// ===========================================================
// 							 ROUTES
// ============================================================

// Basic route for the home page
app.get('/', function(req, res) {
	res.send('Welcome');
});

// Get an instance of the express router
var apiRouter = express.Router();

// ----------------------- AUTHENTICATION --------------------------
// Authenticate users
apiRouter.post('/authenticate', function(req, res) {

	//find the user
	// select the name username and password explicity
	User.findOne({
		username: req.body.username
	}).select('name username password').exec(function(err, user) {
		if (err) throw err;

		// no user with that username was found
		if(!user) {
			res.json({
				success: false,
				message: 'User not found.'
			});
		} else if (user) {
			// check id password matches
			var validPassword = user.comparePassword(req.body.password);
			if (!validPassword) {
				res.json({
					success: false,
					message: 'Wrong password'
				});
			} else {

				// If user is found and password is right
				// Create a token
				var token = jwt.sign({
					name: user.name,
					username: user.username
				}, superSecret, {
					expireInMinutes: 1440 // expires in 24hours
				});

				// Return the information including token as JSON
				res.json({
					success: true,
					message: 'Token created',
					token: token
				});
			}
		}
	});
});


// ----------------------------- MIDDLEWARE --------------------------------
// Middleware to use for all requests
apiRouter.use(function(req, res, next) {
	// logging
	console.log('Connection to the application');

	// check header or url parameters or post parameters for token
	var token = req.body.token || req.param('token') || req.headers['x-access-token'];

	// decode tokens
	if (token) {

		// verifies secret and checks exp
		jwt.verify(token, superSecret, function(err, decoded) {
			if (err) {
				return res.status(403).send({
					success: false,
					message: 'Failed to authenticate token'
				});
			} else {
				// if everything is good save to request for use in other routes
				req.decoded = decoded;

				// Next route 
				next();
			}
		});
	} else {

		// if there is no token return HTTP 403
		return res.status(403).send({
			success: false,
			message: 'No token provided'
		});
	}

});

// test route 
apiRouter.get('/', function(req, res) {
	res.json({ message: 'Welcome'});
});


// --------------------- ROUTES FOR /users ------------------------------------
apiRouter.route('/users')

	// Create a user
	.post(function(req, res) {
		
		// Create a new instance of the User Model
		var user = new User();

		// Set the users information
		user.name = req.body.name;
		user.username = req.body.username;
		user.password = req.body.password;

		// Save the user and check for errors
		user.save(function(err) {
			if(err) {
				// DUplicate entry
				if (err.code == 11000)
					return res.json({ success: false, message: 'A user with the\
						same username already exists. '});
				else
					return res.send(err);

			}
			res.json({message: 'User created'});
		});
	})

	// Get all the users
	.get(function(req, res) {
		User.find(function(err, users) {
			if (err) res.send(err);

			// return the users
			res.json(users);
		});
	});


// ----------------------  ROUTE FOR users ---------------------------
apiRouter.route('/users/:user_id')

	// get the user with the given id
	.get(function(req, res) {
		User.findById(req.params.user_id, function(err, user) {
			if (err) res.send(err);

			// return this user
			res.json(user);
		});
	})

	// update the user with the given id
	.put(function(req, res) {

		// use the user model to find the right user
		User.findById(req.params.user_id, function(err, user) {

			if (err) res.send(err);

			// update the users info if it is new
			if (req.body.name) user.name = req.body.name;
			if (req.body.username) user.username = req.body.username;
			if (req.body.password) user.password = req.body.password;

			// save the user
			user.save(function(err) {
				if(err) res.send(err);

				// return a message
				res.json({ message: 'User updated'});
			});
		});
	})

	// delete the user with the given id
	.delete(function(req, res) {
		User.remove({
			_id: req.params.user_id
		}, function(err, user) {
			if (err) return res.send(err);
			res.json({ message: 'Deleted'});
		});
	});

// get user information
apiRouter.get('/me', function(req, res) {
	res.send(req.decoded);
});

// ------------------ REGISTER THE ROUTES --------------------
app.use('/api', apiRouter);

// ===========================================================
// ------------------ START THE SERVER -----------------------
// ===========================================================
app.listen(port);
console.log('Connection to the port :' + port);