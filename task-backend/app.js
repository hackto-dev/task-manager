const express = require('express');
const app = express();
const { mongoose } = require('./db/mongoose');
const bodyParser = require('body-parser');

// Load in the mongoose models
const { List } = require('./db/models/list.model');
const { Task } = require('./db/models/task.model');
const { User } = require('./db/models/user.model');

const jwt = require('jsonwebtoken');

/* Middleware */
app.use(bodyParser.json());

// CORS Middleware
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
  res.header("Access-Control-Allow-Methods", "GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  
	res.header(
		'Access-Control-Expose-Headers',
		'x-access-token, x-refresh-token'
	);

  next();
});

// Check whether the request has a valid JWT access token
let authenticate = (req, res, next) => {
	let token = req.header('x-access-token');

	// Verify JWT
	jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
		if(err) {
			res.status(401).send(err);
		} else {
			req.user_id = decoded._id;
			next();
		}
	});
}

// Auth Middleware
let verifySession = (req, res, next) => {
    let refreshToken = req.header('x-refresh-token');

    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then((user) => {
        if (!user) {
            // User couldn't be found
            Promise.reject({
                'error': 'User not found. Make sure refresh token and user ID are legit'
            });
        } else {
            req.user_id = user._id;
            req.userObject = user;
            req.refreshToken = refreshToken;

            let isSessionValid = false;

            user.sessions.forEach((session) => {
                if (session.token === refreshToken) {
                    if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                        isSessionValid = true;
                    }
                }
            });

            if (isSessionValid) {
                next();
            } else {
                return Promise.reject({
                    'error': 'Refresh token expired or session invalid'
                });
            }
        }
    }).catch((e) => {
        res.status(401).send(e);
    });
}

/* Route Handlers */

/* List Routes */

/**
 * GET /lists
 * Purpose: Return all lists in the database
 */
app.get('/lists',authenticate,(req,res) => {
    // We want to return an array of all lists in the database.
    List.find({
		_userId: req.user_id
	}).then((lists) => {
        res.send(lists);
    }).catch((e) => {
        res.send(e);
    });
});

/**
 * POST /lists
 * Purpose: Create a list
 */
app.post('/lists', authenticate, (req,res) => {
    // Create a new list and return the new list document back to the user, which includes list ID
    // The list information will be passed in via the JSON request body.
    let title = req.body.title;

    let newList = new List({
		title,
		_userId: req.user_id
    });

    newList.save().then((listDoc) => {
        // The full list document is returned
        res.send(listDoc);
    });
});

/**
 * PATCH /lists/:id
 * Purpose: Update a specified list
 */
app.patch('/lists/:id', authenticate, (req, res) => {
    // Update the specified list with the new values specified in the JSON body of the request.
    List.findOneAndUpdate({_id: req.params.id, _userId: req.user_id},{
        $set: req.body
    }).then(() => {
        res.sendStatus(200);
    });
});

/**
 * DELETE /lists/:id
 * Purpose: Create a list
 */
app.delete('/lists/:id', authenticate, (req, res) => {
    // Delete the specified list.
    List.findOneAndRemove({
		_id: req.params.id,
		_userId: req.user_id
    }).then((removedListDoc) => {
		res.send(removedListDoc);
		
		deleteTasksFromList(removedListDoc._id);
    });
});

/**
 * GET /lists/:listId/tasks
 * Purpose: Get all tasks in a specific list
 */
app.get('/lists/:listId/tasks', authenticate, (req,res) => {
    // We want to return all the tasks that belong to a specified list (specified by listId)
    Task.find({
        _listId:req.params.listId
    }).then((tasks) => {
        res.send(tasks);
    });
});

app.get('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {
    Task.findOne({
        _id: req.params.taskId,
        _listId: req.params.listId
    }).then((task) => {
        res.send(task);
    });
})

/**
 * POST /lists/:listId/tasks
 * Purpose: Create a new task in specified list
 */
app.post('/lists/:listId/tasks', authenticate, (req,res) => {
	// We want to create a new task in the specified list
	List.findOne({
		_id: req.params.listId,
		_userId: req.user_id
	}).then((list) => {
		if(list) {
			return true;
		} else {
			return false;
		}
	}).then((canCreateTask) => {
		if(canCreateTask) {
			let newTask = new Task({
				title: req.body.title,
				_listId: req.params.listId
			});

			newTask.save().then((newTaskDoc) => {
				res.send(newTaskDoc);
			});
		} else {
			res.sendStatus(404);
		}
	});
})

/**
 * PATCH /lists/:listId/tasks/:taskId
 * Purpose: Update the task specified by task ID
 */
app.patch('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {
	// We want to update the task based on the task ID specified
	List.findOne({
		_id: req.params.listId,
		_userId: req.user_id
	}).then((list)=> {
		if(list) {
			return true;
		} else {
			return false;
		}
	}).then((canUpdateTask) => {
		if(canUpdateTask) {
			Task.findOneAndUpdate({
				_id: req.params.taskId,
				_listId: req.params.listId
			}, {
				$set: req.body
			}).then(() => {
				res.send({
					message: 'Updated successfully!'
				});
			});
		} else {
			res.sendStatus(404);
		}
	})   
})

/**
 * DELETE /lists/:listId/tasks/:taskId
 * Purpose: Delete task specified by task ID
 */
app.delete('/lists/:listId/tasks/:taskId', authenticate, (req,res) => {
	// We want to delete the task based on the task ID specified
	List.findOne({
		_id: req.params.listId,
		_userId: req.user_id
	}).then((list) => {
		if (list) {
			return true;
		} else {
			return false;
		}
	}).then((canDeleteTask) => {
		if(canDeleteTask) {
			Task.findOneAndRemove({
				_id: req.params.taskId,
				_listId: req.params.listId
			}).then((removedTaskDoc) => {
				res.send(removedTaskDoc);
			});
		} else {
			res.sendStatus(404);
		}
	});
});

/* User Routes */

/**
 * POST /users
 * Purpose: Sign Up
 */
app.post('/users',(req,res) => {
    // User will sign up
    let body = req.body;

    let newUser = new User(body);

    newUser.save().then(() => {
        return newUser.createSession();
    }).then((refreshToken) => {
        //Session created successfully - refresh token returned
        // Now we generate access auth token for the user

        return newUser.generateAccessAuthToken().then((accessToken) => {
            return { accessToken,refreshToken };
        })
    }).then((authTokens) => {
        res
            .header('x-refresh-token',authTokens.refreshToken)
            .header('x-access-token',authTokens.accessToken)
            .send(newUser);
    }).catch((e) => {
        res.status(400).send(e);
    })
});

/**
 * POST /users/login
 * Purpose: Login
 */
app.post('/users/login',(req,res) => {
    let email = req.body.email;
    let password = req.body.password;

    User.findByCredentials(email,password).then((user) => {
        return user.createSession().then((refreshToken) => {
            return user.generateAccessAuthToken().then((accessToken) => {
                return { accessToken,refreshToken };
            });
        }).then((authTokens) => {
            res
                .header('x-refresh-token', authTokens.refreshToken)
                .header('x-access-token', authTokens.accessToken)
                .send(user);
        }).catch((e) => {
            res.status(400).send(e);
        });
    });
})

/**
 * GET /users/me/access-token
 * Purpose: Generates and returns an access token
 */
app.get('/users/me/access-token', verifySession, (req, res) => {
    // we know that the user/caller is authenticated and we have the user_id and user object available to us
    req.userObject.generateAccessAuthToken().then((accessToken) => {
        res.header('x-access-token', accessToken).send({
            accessToken
        });
    }).catch((e) => {
        res.status(400).send(e);
    });
})

/* Helper Methods */

let deleteTasksFromList = (_listId) => {
	Task.deleteMany({
		_listId
	}).then(() => {
		console.log("Tasks from " + _listId + " were deleted!");
	});
}

app.listen(5000,() => {
    console.log("Server listening on port 3000");
});