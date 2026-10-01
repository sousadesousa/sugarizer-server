// User handling

var mongo = require('mongodb'),
	dbutil = require('./utils/db'),
	journal = require('./journal'),
	otplib = require('otplib'),
	passwords = require('./utils/password');

var db;

var usersCollection;
var serviceName;
var classroomsCollection;
var journalCollection;
var chartsCollection;

// eslint-disable-next-line no-unused-vars
var gridfsbucket, CHUNKS_COLL, FILES_COLL;

// Init database
exports.init = function(settings, database) {
	usersCollection = settings.collections.users;
	classroomsCollection = settings.collections.classrooms;
	journalCollection = settings.collections.journal;
	chartsCollection = settings.collections.charts;
	serviceName = settings.security.service_name;
	db = database;

	var bucket = 'textBucket';
	gridfsbucket = new mongo.GridFSBucket(db,{
		chunkSizeBytes:102400,
		bucketName: bucket
	});
	CHUNKS_COLL = bucket + ".chunks";
	FILES_COLL = bucket + ".files";
};

/**
 * @api {get} api/v1/users/:id Get user detail
 * @apiName GetUser
 * @apiDescription Retrieve detail for a specific user.
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiHeader {String} x-key User unique id.
 * @apiHeader {String} x-access-token User access token.
 *
 * @apiParam {String} id Unique user id
 * 
 * @apiSuccess {String} _id Unique user id
 * @apiSuccess {String} name Unique user name
 * @apiSuccess {String} role User role (student or admin)
 * @apiSuccess {Object} color Buddy color
 * @apiSuccess {String} color.stroke Buddy strike color
 * @apiSuccess {String} color.fill Buddy fill color
 * @apiSuccess {String[]} favorites Ids list of activities in the favorite view
 * @apiSuccess {String} language Language setting of the user
 * @apiSuccess {String} password password of the user
 * @apiSuccess {String} private_journal Id of the private journal on the server
 * @apiSuccess {String} shared_journal Id of the shared journal on the server (the same for all users)
 * @apiSuccess {Number} created_time when the user was created on the server
 * @apiSuccess {Number} timestamp when the user last accessed the server
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "name": "Tarun",
 *       "role": "student",
 *       "color": {
 *         "stroke": "#00A0FF",
 *         "fill": "#00B20D"
 *       },
 *       "favorites": [
 *          "org.olpcfrance.Abecedarium",
 *          "org.sugarlabs.ChatPrototype",
 *          "org.sugarlabs.Clock",
 *          "org.olpcfrance.FoodChain",
 *          "org.sugarlabs.GearsActivity",
 *          "org.sugarlabs.GTDActivity",
 *          "org.olpcfrance.Gridpaint",
 *          "org.olpc-france.LOLActivity",
 *          "org.sugarlabs.Markdown",
 *          "org.sugarlabs.MazeWebActivity",
 *          "org.sugarlabs.PaintActivity"
 *       ],
 *       "language": "en",
 *       "password": "xxx",
 *       "private_journal": "5569f4b019e0b4c9525b3c96",
 *       "shared_journal": "536d30874326e55f2a22816f",
 *       "created_time": 1423341000747,
 *       "timestamp": 1423341000747,
 *       "_id": "5569f4b019e0b4c9525b3c97"
 *    }
 **/
exports.findById = function(req, res) {
	if (!mongo.ObjectId.isValid(req.params.uid)) {
		res.status(401).send({
			'error': 'Invalid user id',
			'code': 18
		});
		return;
	}
	{
		const collection = db.collection(usersCollection);
		dbutil.callback(collection.findOne({
			'_id': new mongo.ObjectId(req.params.uid)
		}), function(err, item) {
			res.send(removeSecrets(item));
		});
	}
};

// function to generate OTP Token for QR code.
function generateOTPToken(username, serviceName, secret){
	return otplib.authenticator.keyuri(
		username,
		serviceName,
		secret
	);
}

exports.updateSecret = function(req, res){
	if (!mongo.ObjectId.isValid(req.user._id)) {
		res.status(401).send({
			'error': 'Invalid user id',
			'code': 8
		});
		return;
	}

	var uid = req.user._id;

	// Save unique secret in database.
	{
		const collection = db.collection(usersCollection);
		dbutil.callback(collection.findOne({
			_id: new mongo.ObjectId(uid),
		}), function(err, user) {
			// only update database with unique secret if tfa is false or not defined -- for existing users in databse.
			if (user.tfa === false || typeof user.tfa === "undefined") {
				var uniqueSecret = otplib.authenticator.generateSecret();
				{
					const collection = db.collection(usersCollection);
					dbutil.callback(collection.findOneAndUpdate({
						'_id': new mongo.ObjectId(uid)
					}, {
						$set:
						{
							uniqueSecret: uniqueSecret
						}
					}, {
						includeResultMetadata: true,
						safe: true,
						returnDocument: 'after'
					}), function(err, result) {
						if (err) {
							res.status(500).send({
								'error': 'An error has occurred',
								'code': 7
							});
						} else if (result) {
							var updatedUser = result.value;
							var name = updatedUser.name;
							var manualKey = updatedUser.uniqueSecret;
							var otpAuth = generateOTPToken(name, serviceName, manualKey);

							delete updatedUser.password;
							//send user, manualKey and otpAuth for QRCode async function.
							res.send({
								user: updatedUser,
								uniqueSecret: manualKey,
								otpAuth: otpAuth
							});
						} else {
							res.status(401).send({
								'error': 'Inexisting user id',
								'code': 8
							});
						}
					});
				}
			} else if (user.tfa === true) {
				res.status(500).send({
					'error': 'An error has occurred',
					'code': 7
				});
			}
		});
	}

};

exports.verifyTOTP = function(req, res) {
	//validate
	if (!mongo.ObjectId.isValid(req.user._id)) {
		res.status(401).send({
			'error': 'Invalid user id',
			'code': 8
		});
		return;
	}

	var uid = req.user._id;

	if (!req.body.userToken) {
		res.status(401).send({
			'error': 'User Token not defined',
			'code': 31
		});
		return;
	}

	var uniqueToken = req.body.userToken;

	{
		const collection = db.collection(usersCollection);
		dbutil.callback(collection.findOne({
			_id: new mongo.ObjectId(uid),
		}), function(err, user) {
			var uniqueSecret = user.uniqueSecret;
			if (!err) {
				try {
					var isValid = otplib.authenticator.check(uniqueToken, uniqueSecret);
				} catch (err) {
					res.status(401).send({
						'error': 'Could not verify OTP error in otplib',
						'code': 32
					});
				}
				if(isValid === true) {
					{
						const collection = db.collection(usersCollection);
						dbutil.callback(collection.findOneAndUpdate({
							'_id': new mongo.ObjectId(uid)
						}, {
							$set:
							{
								tfa: isValid
							}
						}, {
							includeResultMetadata: true,
							safe: true,
							returnDocument: 'after'
						}), function(err, result) {
							if (err) {
								res.status(500).send({
									'error': 'An error has occurred',
									'code': 7
								});
							} else {
								if (result && result.ok && result.value) {
									var user = result.value;
									delete user.password;
									delete user.uniqueSecret;
									res.send(user);
								} else {
									res.status(401).send({
										'error': 'Inexisting user id',
										'code': 8
									});
								}
							}
						});
					}
				} else {
					res.status(401).send({
						'error': 'Wrong TOTP!!',
						'code': 33
					});
					return;
				}
			} else {
				res.status(500).send({
					'error': 'An error has occurred',
					'code': 7
				});
			}
		});
	}

};

exports.disable2FA = function(req, res) {
	//validate
	if (!mongo.ObjectId.isValid(req.user._id)) {
		res.status(401).send({
			'error': 'Invalid user id',
			'code': 8
		});
		return;
	}

	var uid = req.user._id;

	//disable TOTP
	{
		const collection = db.collection(usersCollection);
		dbutil.callback(collection.findOneAndUpdate({
			'_id': new mongo.ObjectId(uid)
		}, {
			$set:
				{
					tfa: false,
					uniqueSecret: undefined
				}
		}, {
			includeResultMetadata: true,
			safe: true,
			returnDocument: 'after'
		}), function(err, result) {
			if (err) {
				res.status(500).send({
					'error': 'An error has occurred',
					'code': 7
				});
			} else {
				if (result && result.ok && result.value) {
					var user = result.value;
					delete user.password;
					delete user.uniqueSecret;
					res.send(result.value);
				} else {
					res.status(401).send({
						'error': 'Inexisting user id',
						'code': 8
					});
				}
			}
		});
	}
};

/**
 * @api {get} api/v1/users/ Get all users
 * @apiName GetAllUsers
 * @apiDescription Retrieve all users registered on the server. Query params can be mixed and match to achieve suitable results.
 * @apiGroup Users
 * @apiVersion 1.0.0
 *
 * @apiExample Example usage:
 *     "/api/v1/users"
 *     "/api/v1/users?name=tarun"
 *     "/api/v1/users?language=fr&sort=+name"
 *     "/api/v1/users?sort=+name&limit=5&offset=20"
 *
 * @apiHeader {String} x-key User unique id.
 * @apiHeader {String} x-access-token User access token.
 *
 * @apiParam {String} [name] Display name of the activity <code>e.g. name=paint</code>
 * @apiParam {Boolean} [language] To get users of specific language <code>e.g. language=fr</code>
 * @apiParam {String} [role=student] To filter users based on role <code>e.g. role=admin or role= student</code>
 * @apiParam {String} [q] Fuzzy Search <code>e.g. q=tar</code> to search user with name "Tarun"
 * @apiParam {Number} [stime] results starting from stime in ms <code>e.g. stime=712786812367</code>
 * @apiParam {String} [sort=+name] Order of results <code>e.g. sort=-name or sort=+role</code>
 * @apiParam {String} [offset=0] Offset in results <code>e.g. offset=15</code>
 * @apiParam {String} [limit=10] Limit results <code>e.g. limit=5</code>
 *
 * @apiSuccess {Object[]} users List of users
 * @apiSuccess {Number} offset Offset in users list
 * @apiSuccess {Number} limit Limit on number of results
 * @apiSuccess {Number} total total number of results
 * @apiSuccess {String} sort information about sorting used in the results
 * @apiSuccess {Object} link pagination links
 *
 * @apiSuccessExample {json} Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *     "users":[
 *       {
 *         "name": "Tarun Singhal",
 *         "role": "student",
 *         "color": {
 *           "stroke": "#005FE4",
 *           "fill": "#FF2B34"
 *         },
 *         "favorites": [
 *           "org.sugarlabs.GearsActivity",
 *           "org.sugarlabs.MazeWebActivity",
 *         ],
 *         "language": "en",
 *         "password": "xxx",
 *         "private_journal": "5569f4b019e0b4c9525b3c96",
 *         "shared_journal": "536d30874326e55f2a22816f",
 *         "created_time": 1423341000747,
 *         "timestamp": 1423341000747,
 *         "_id": "536dd30aadcd557f2a9d648b"
 *      },
 *      ...
 *     ],
 *     "limit": 10,
 *     "offset": 20,
 *     "total": 200,
 *     "sort": "+name",
 *     "links": {
 *     	"prev_page": "/api/v1/users?limit=10&offset=10",
 *     	"next_page": "/api/v1/users?limit=10&offset=30"
 *     }
 *    }
 **/
exports.findAll = function(req, res) {

	//prepare condition
	var query = {};
	query = addQuery('name', req.query, query);
	query = addQuery('language', req.query, query);
	query = addQuery('role', req.query, query, 'student');
	query = addQuery('q', req.query, query);
	if (req.query.stime) {
		query['timestamp'] = {
			'$gte': parseInt(req.query.stime)
		};
	}

	if (req.user && req.user.role == "teacher") {
		if (req.query && req.query['classid']) {
			var requestedUsers = req.query['classid'].split(',');
			var allowedUsers =  requestedUsers.filter(function(id) {
				return req.user.students.includes(id);
			});
			query['_id'] = {
				$in: allowedUsers.map(function(id) {
					return new mongo.ObjectId(id);
				})
			};
		} else {
			query['_id'] = {
				$in: req.user.students.map(function(id) {
					return new mongo.ObjectId(id);
				})
			};
		}
		query['_id']['$in'].push(new mongo.ObjectId(req.user._id));
	} else {
		query = addQuery('classid', req.query, query);
	}

	// add filter and pagination
	{
		const collection = db.collection(usersCollection);

		//count data
		dbutil.callback(collection.countDocuments(query), function(err, count) {

			//define var
			var params = JSON.parse(JSON.stringify(req.query));
			var route = req.route.path;
			var options = getOptions(req, count, "+name");
			//get data
			exports.getAllUsers(query, options, function(users) {

				//add pagination
				var data = {
					'users': users,
					'offset': options.skip,
					'limit': options.limit,
					'total': options.total,
					'sort': (options.sort[0][0] + '(' + options.sort[0][1] + ')'),
					'links': {
						'prev_page': ((options.skip - options.limit) >= 0) ? formPaginatedUrl(route, params, (options.skip - options.limit), options.limit) : undefined,
						'next_page': ((options.skip + options.limit) < options.total) ? formPaginatedUrl(route, params, (options.skip + options.limit), options.limit) : undefined,
					},
				};

				// Return
				res.send(data);
			});
		});
	}
};

//form query params
function formPaginatedUrl(route, params, offset, limit) {
	//set params
	params.offset = offset;
	params.limit = limit;
	var str = [];
	for (var p in params)
		if (p && Object.prototype.hasOwnProperty.call(params, p)) {
			str.push((p) + "=" + (params[p]));
		}
	return '?' + str.join("&");
}

//get all users
exports.getAllUsers = function(query, options, callback) {

	//get data
	{
		const collection = db.collection(usersCollection);
		var conf = [
			{
				$match: query
			},
			{
				$project: {
					name: 1,
					language: 1,
					role: 1,
					color: 1,
					options: 1,
					created_time: 1,
					timestamp: 1,
					tfa: 1,
					private_journal: 1,
					shared_journal: 1,
					favorites: 1,
					classrooms: 1,
					charts: 1,
					insensitive: { "$toLower": "$name" }
				}
			},
			{
				$sort: {
					"insensitive": 1
				}
			}
		];

		if (options.enableSecret == true) {
			conf[1]["$project"]["uniqueSecret"] = 1;
		}

		if (options.enablePassword == true) {
			conf[1]["$project"]["password"] = 1;
		}

		if (typeof options.sort == 'object' && options.sort.length > 0 && options.sort[0] && options.sort[0].length >=2) {
			conf[1]["$project"]["insensitive"] = { "$toLower": "$" + options.sort[0][0] };

			if (options.sort[0][1] == 'desc') {
				conf[2]["$sort"] = {
					"insensitive": -1
				};
			} else {
				conf[2]["$sort"] = {
					"insensitive": 1
				};
			}
		}

		dbutil.cursor(collection.aggregate(conf), function(err, users) {
			if (options.skip) users.skip(options.skip);
			if (options.limit) users.limit(options.limit);
			//return
			dbutil.callback(users.toArray(), function(err, usersList) {
				callback(usersList);
			});
		});
	}
};

function getOptions(req, count, def_sort) {

	//prepare options
	var sort_val = (typeof req.query.sort === "string" ? req.query.sort : def_sort);
	var sort_type = sort_val.indexOf("-") == 0 ? 'desc' : 'asc';
	var options = {
		sort: [
			[sort_val.substring(1), sort_type]
		],
		skip: req.query.offset || 0,
		total: count,
		limit: req.query.limit || 10
	};

	//cast to int
	options.skip = parseInt(options.skip);
	options.limit = parseInt(options.limit);

	//return
	return options;
}

//private function for filtering and sorting
function addQuery(filter, params, query, default_val) {

	//check default case
	query = query || {};

	//validate
	if (typeof params[filter] != "undefined" && typeof params[filter] === "string") {

		if (filter == 'q') {
			query['name'] = {
				$regex: new RegExp(params[filter], "i")
			};
		} else if (filter == 'classid') {
			query['_id'] = {
				$in: params[filter].split(',').map(function(id) {
					return new mongo.ObjectId(id);
				})
			};
		} else if (filter == 'role') {
			if (params[filter] == 'stuteach') {
				query['$or'] = [
					{
						role: {
							$regex: new RegExp("^student$", "i")
						}
					},
					{
						role: {
							$regex: new RegExp("^teacher$", "i")
						}
					}
				];
			} else if (params[filter] != 'all') {
				query[filter] = {
					$regex: new RegExp("^" + params[filter] + "$", "i")
				};
			} 
		} else {
			query[filter] = {
				$regex: new RegExp("^" + params[filter] + "$", "i")
			};
		}
	} else {
		//default case
		if (typeof default_val != "undefined") {
			query[filter] = default_val;
		}
	}

	//return
	return query;
}


/**
 * @api {post} api/v1/users/ Add user
 * @apiName AddUser
 * @apiDescription Add a new user. Return the user created. Only admin can add another admin, student or teacher.
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiHeader {String} x-key User unique id.
 * @apiHeader {String} x-access-token User access token.
 *
 * @apiSuccess {String} _id Unique user id
 * @apiSuccess {String} name Unique user name
 * @apiSuccess {String} role User role (admin, student or teacher)
 * @apiSuccess {Object} color Buddy color
 * @apiSuccess {String} color.stroke Buddy strike color
 * @apiSuccess {String} color.fill Buddy fill color
 * @apiSuccess {String[]} favorites Ids list of activities in the favorite view
 * @apiSuccess {String} language Language setting of the user
 * @apiSuccess {String} password Password of the user
 * @apiSuccess {String} private_journal Id of the private journal on the server
 * @apiSuccess {String} shared_journal Id of the shared journal on the server (the same for all users)
 * @apiSuccess {Number} created_time when the user was created on the server
 * @apiSuccess {Number} timestamp when the user last accessed the server
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "name": "Tarun",
 *       "role": "student",
 *       "color": {
 *         "stroke": "#00A0FF",
 *         "fill": "#00B20D"
 *       },
 *       "favorites": [
 *          "org.olpcfrance.Abecedarium",
 *          "org.sugarlabs.ChatPrototype",
 *          "org.sugarlabs.Clock",
 *          "org.olpcfrance.FoodChain",
 *          "org.sugarlabs.GearsActivity",
 *          "org.sugarlabs.GTDActivity",
 *          "org.olpcfrance.Gridpaint",
 *          "org.olpc-france.LOLActivity",
 *          "org.sugarlabs.Markdown",
 *          "org.sugarlabs.MazeWebActivity",
 *          "org.sugarlabs.PaintActivity"
 *       ],
 *       "language": "en",
 *       "password": "xxx",
 *       "private_journal": "5569f4b019e0b4c9525b3c96",
 *       "shared_journal": "536d30874326e55f2a22816f",
 *       "created_time": 1423341000747,
 *       "timestamp": 1423341000747,
 *       "_id": "5569f4b019e0b4c9525b3c97"
 *    }
 **/
exports.addUser = function(req, res) {

	//validate
	if (!req.body.user) {
		res.status(401).send({
			'error': 'User object not defined!',
			'code': 21
		});
		return;
	}

	//parse user details
	var user = JSON.parse(req.body.user);

	//add timestamp & language
	user.created_time = +new Date();
	user.timestamp = +new Date();
	user.role = (user.role ? user.role.toLowerCase() : 'student');
	// api test condition
	if (!user.tfa) {
		user.tfa = false;
	}

	if ((req.user && req.user.role=="teacher") && (user.role=="admin" || user.role=="teacher")) {
		res.status(401).send({
			'error': 'You don\'t have permission to perform this action',
			'code': 19
		});
		return;
	}

	//validation for fields [password, name]
	if (!user.password || !user.name) {
		res.status(401).send({
			'error': "Invalid user object!",
			'code': 2
		});
		return;
	}

	//check if user already exist
	exports.getAllUsers({
		'name': new RegExp("^" + passwords.escapeRegex(user.name) + "$", "i")
	}, {}, function(item) {
		if (item.length == 0) {
			//store only a hash of the password
			passwords.hash(user.password, function(err, hash) {
				if (err) {
					res.status(500).send({
						'error': 'An error has occurred',
						'code': 10
					});
					return;
				}
				user.password = hash;
				insertUser(user, res);
			});
		} else {
			res.status(401).send({
				'error': 'User with same name already exist',
				'code': 22
			});
		}
	});
};

//private function to insert user
function insertUser(user, res) {
	//create user based on role
	if (user.role == 'admin') {
		delete user.classrooms;
		{
			const collection = db.collection(usersCollection);
			dbutil.callback(collection.insertOne(user, {
				safe: true
			}), function(err) {
				if (err) {
					res.status(500).send({
						'error': 'An error has occurred',
						'code': 10
					});
				} else {
					res.send(removeSecrets(user));
				}
			});
		}
	} else {
		//for student
		if (user.role != 'teacher') {
			delete user.classrooms;
		} else if (!user.classrooms) {
			user.classrooms = [];
		}
		{
			const collection = db.collection(usersCollection);
			// Create a new journal
			journal.createJournal(function(err, privateJournal) {
				// add journal to the new user
				user.private_journal = privateJournal._id;
				user.shared_journal = journal.getShared()._id;
				dbutil.callback(collection.insertOne(user, {
					safe: true
				}), function(err) {
					if (err) {
						res.status(500).send({
							'error': 'An error has occurred',
							'code': 10
						});
					} else {
						res.send(removeSecrets(user));
					}
				});
			});
		}
	}
}

/**
 * @api {put} api/v1/users/:uid Update user
 * @apiName UpdateUser
 * @apiDescription Update an user. Return the user updated. Student or teacher can update only his/her details but admin can update anyone.
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiHeader {String} x-key User unique id.
 * @apiHeader {String} x-access-token User access token.
 *
 * @apiParam {String} uid Unique user id to update
 * 
 * @apiSuccess {String} _id Unique user id
 * @apiSuccess {String} name Unique user name
 * @apiSuccess {String} role User role (admin, student or teacher)
 * @apiSuccess {Object} color Buddy color
 * @apiSuccess {String} color.stroke Buddy strike color
 * @apiSuccess {String} color.fill Buddy fill color
 * @apiSuccess {String[]} favorites Ids list of activities in the favorite view
 * @apiSuccess {String} language Language setting of the user
 * @apiSuccess {String} password Password of the user
 * @apiSuccess {String} private_journal Id of the private journal on the server
 * @apiSuccess {String} shared_journal Id of the shared journal on the server (the same for all users)
 * @apiSuccess {Number} created_time when the user was created on the server
 * @apiSuccess {Number} timestamp when the user last accessed the server
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "name": "Tarun",
 *       "role": "student",
 *       "color": {
 *         "stroke": "#00A0FF",
 *         "fill": "#00B20D"
 *       },
 *       "favorites": [
 *          "org.olpcfrance.Abecedarium",
 *          "org.sugarlabs.ChatPrototype",
 *          "org.sugarlabs.Clock",
 *          "org.olpcfrance.FoodChain",
 *          "org.sugarlabs.GearsActivity",
 *          "org.sugarlabs.GTDActivity",
 *          "org.olpcfrance.Gridpaint",
 *          "org.olpc-france.LOLActivity",
 *          "org.sugarlabs.Markdown",
 *          "org.sugarlabs.MazeWebActivity",
 *          "org.sugarlabs.PaintActivity"
 *       ],
 *       "language": "en",
 *       "password": "xxx",
 *       "private_journal": "5569f4b019e0b4c9525b3c96",
 *       "shared_journal": "536d30874326e55f2a22816f",
 *       "created_time": 1423341000747,
 *       "timestamp": 1423341001747,
 *       "_id": "5569f4b019e0b4c9525b3c97"
 *    }
 **/
exports.updateUser = function(req, res) {
	if (!mongo.ObjectId.isValid(req.params.uid)) {
		res.status(401).send({
			'error': 'Invalid user id',
			'code': 18
		});
		return;
	}

	//validate
	if (!req.body.user) {
		res.status(401).send({
			'error': 'User object not defined!',
			'code': 21
		});
		return;
	}

	var uid = req.params.uid;
	var user = JSON.parse(req.body.user);
	delete user.role; // Disable role change

	//do not update name if already exist
	if (typeof user.name !== 'undefined') {
		//check for unique user name validation
		exports.getAllUsers({
			'_id': {
				$ne: new mongo.ObjectId(uid)
			},
			'name': new RegExp("^" + passwords.escapeRegex(user.name) + "$", "i")
		}, {}, function(item) {
			if (item.length == 0) {

				//update user
				updateUser(uid, user, res);
			} else {
				res.status(401).send({
					'error': 'User with same name already exist',
					'code': 22
				});
			}
		});
	} else {
		//update user
		updateUser(uid, user, res);
	}
};

//private function to update user, store only a hash of a new password
function updateUser(uid, user, res) {
	if (typeof user.password === 'undefined' || user.password === null || user.password === '') {
		delete user.password;
		return saveUser(uid, user, res);
	}
	passwords.hash(user.password, function(err, hash) {
		if (err) {
			res.status(500).send({
				'error': 'An error has occurred',
				'code': 10
			});
			return;
		}
		user.password = hash;
		saveUser(uid, user, res);
	});
}

//private function to save user
function saveUser(uid, user, res) {
	{
		const collection = db.collection(usersCollection);
		dbutil.callback(collection.updateOne({
			'_id': new mongo.ObjectId(uid)
		}, {
			$set: user
		}, {
			safe: true
		}), function(err, result) {
			if (err) {
				res.status(500).send({
					'error': 'An error has occurred',
					'code': 10
				});
			} else {
				if (dbutil.affected(result) == 1) {
					{
						const collection = db.collection(usersCollection);
						dbutil.callback(collection.findOne({
							'_id': new mongo.ObjectId(uid)
						}), function(err, user) {
							res.send(removeSecrets(user));
						});
					}
				} else {
					res.status(401).send({
						'error': 'Inexisting user id',
						'code': 23
					});
				}
			}
		});
	}
}

/**
 * @api {delete} api/v1/users/:uid Remove user
 * @apiName RemoveUser
 * @apiDescription Remove an user from the database. Only admin can remove other users. Self removal can also be done.
 * @apiGroup Users
 * @apiVersion 1.0.0
 * @apiHeader {String} x-key User unique id.
 * @apiHeader {String} x-access-token User access token.
 * @apiParam {String} uid Unique id of the user to delete
 *
 * @apiSuccessExample Success-Response:
 *     HTTP/1.1 200 OK
 *     {
 *       "user_id": "5569f4b019e0b4c9525b3c97"
 *     }
 **/
exports.removeUser = function(req, res) {
	if (!mongo.ObjectId.isValid(req.params.uid)) {
		res.status(401).send({
			'error': 'Invalid user id',
			'code': 18
		});
		return;
	}

	//delete user from db
	var uid = req.params.uid;
	{
		const collection = db.collection(usersCollection);
		dbutil.callback(collection.findOneAndDelete({
			'_id': new mongo.ObjectId(uid)
		}, {includeResultMetadata: true}), function(err, user) {
			if (err) {
				res.status(500).send({
					'error': 'An error has occurred',
					'code': 10
				});
			} else {
				if (user && user.ok && user.value) {
					// Remove user charts
					{
						const collection = db.collection(chartsCollection);
						dbutil.callback(collection.deleteMany({
							user_id: new mongo.ObjectId(uid)
						}, {
							safe: true
						}),
						function(err) {
							if (err) {
								res.status(500).send({
									error: "An error has occurred",
									code: 10
								});
							} else {
								// Remove user form classroom
								{
									const collection = db.collection(classroomsCollection);
									dbutil.callback(collection.updateMany({},
										{
											$pull: { students: uid }
										}, {
											safe: true
										}),
									function(err) {
										if (err) {
											res.status(500).send({
												error: "An error has occurred",
												code: 10
											});
										} else {
											if (user.value.private_journal) {
												{
													const collection = db.collection(journalCollection);
													dbutil.callback(collection.findOneAndDelete({
														_id: new mongo.ObjectId(user.value.private_journal)
													}, {
														includeResultMetadata: true,
														safe: true
													}),
													function(err, result) {
														if (err) {
															return res.status(500).send({
																'error': 'An error has occurred',
																'code': 10
															});
														} else {
															if (result && result.value && result.ok && typeof result.value.content == 'object') {
																var cont = [];
																for (var i=0; i<result.value.content.length; i++) {
																	if (result.value.content[i] && mongo.ObjectId.isValid(result.value.content[i].text)) {
																		cont.push(result.value.content[i].text);
																	}
																}
																var deleteCount = 0;
																for (var i=0; i < cont.length; i++) {
																	dbutil.callback(gridfsbucket.delete(cont[i]), function() {
																		deleteCount++;
																		if (deleteCount == cont.length) return res.send({
																			'user_id': uid
																		});
																	});
																}
																if (cont.length == 0) return res.send({
																	'user_id': uid
																});
															} else {
																return res.send({
																	'user_id': uid
																});
															}
														}
													});
												}
											} else {
												return res.send({
													'user_id': uid
												});
											}
										}
									}
									);
								}
							}
						});
					}
				} else {
					res.status(401).send({
						'error': 'Inexisting user id',
						'code': 23
					});
				}
			}
		});
	}
};

//replace a legacy clear password by its hash
exports.rehashPassword = function(uid, password, callback) {
	passwords.hash(password, function(err, hash) {
		if (err) {
			if (callback) callback(err);
			return;
		}
		{
			const collection = db.collection(usersCollection);
			dbutil.callback(collection.updateOne({
				'_id': new mongo.ObjectId(uid)
			}, {
				$set: {
					password: hash
				}
			}, {
				safe: true
			}), function(err) {
				if (callback) callback(err);
			});
		}
	});
};

//private function to remove password and 2FA secret from a user sent to client
function removeSecrets(user) {
	if (user) {
		delete user.password;
		delete user.uniqueSecret;
	}
	return user;
}

//update user's time stamp
exports.updateUserTimestamp = function(uid, callback) {

	{
		const collection = db.collection(usersCollection);
		dbutil.callback(collection.updateOne({
			'_id': new mongo.ObjectId(uid)
		}, {
			$set: {
				timestamp: +new Date()
			}
		}, {
			safe: true
		}), function(err) {
			callback(err);
		});
	}
};
