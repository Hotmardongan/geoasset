'use strict';

var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose'),
    multer = require('multer'),
    bodyParser = require('body-parser'),
    config = require('./config'),
    crypt = require('./encode'),
    secretKey = config.secretKey,
    jsonwebtoken = require('jsonwebtoken'),
    path = require('path'),
    cors = require('cors'),
    bwipjs = require('bwip-js'),
    PdfHelp = require('./pdfgenerator');

function createToken(users) {
    var token = jsonwebtoken.sign({
        _id: users._id,
        name: users.name,
        username: users.username
    }, crypt.encode(secretKey), {
        // expirtesInMinute: 1440
        expirtesInMinute: 1
    });
    return token;
}

bwipjs.loadFont('Inconsolata', 108,
    require('fs').readFileSync('./font/Inconsolata.otf', 'binary'));

var db;
// db= mongoose.connect('mongodb://192.168.175.140/geoassets', function(err){
db = mongoose.connect(config.database, function(err) {
    if (err) {
        console.log('error connect to Database');
    }
    //else
        // console.log('Database connected');
});

var Asset = require('./models/assetModel');
var AssetCategory = require('./models/assetCategoryModel');
var AssetInspection = require('./models/assetInspectionModel');
var User = require('./models/userModel');
var Group = require('./models/groupModel');
var Menu = require('./models/menuModel');

var app = express();

app.use(bodyParser.json({
    limit: '10mb'
}));
app.use(bodyParser.urlencoded({
    limit: '10mb',
    extended: true
}));

///////////// ALLOW HEADER REQUEST //////////////////
app.use(cors());

// app.use(function(req, res, next) {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header('Access-Control-Allow-Credentials', true);
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, x-access-token");
//   res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT, OPTIONS');
//   next();
// });

//// USING PDF GENERATOR
// app.get('/api/pdfgenerate', function(req, res) {
//   // console.log(req);
//   res.set('Content-Type', 'application/javascript');
//   var pdf = new PdfHelp();
//   pdf.generatePdf(req, res);
// });

app.use('/', express.static(__dirname + '/Desktop'));

// USER BARCODE GENERATOR
app.get('/barcode', function(req, res) {
    // res.send('welcome to my API!');
    if (req.url.indexOf('/barcode/?bcid=') != 0) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('BWIP-JS: Unknown request format.', 'utf8');
    } else {
        bwipjs(req, res);
    }
});

// /////// USING MULTER MIDLEWARE /////
app.use('/api/photo',multer({
    dest: './Desktop/resources/assets',
    limits: {
        fileSize: 2 * 1024 * 1024,
        fieldNameSize: 100,
        files: 2,
        fields: 5 // at most 1MB
    },
    onFileSizeLimit: function(file) {
        fs.unlinkSync('./Desktop/resources/assets' + file.path); // delete the partially written file
        file.failed = true;
        res.json({
            uploadError: 'Upload failed. File must be less than 1 MB'
        });
    },
    rename: function(fieldname, filename) {
        // return fieldname + filename + Date.now()
        return filename.replace(/\W+/g, '-').toLowerCase() + Date.now();
    },
    onFileUploadStart: function(file) {
        // console.log(file.fieldname + ' is starting ...')
    },
    onFileUploadData: function(file, data) {
        // console.log(data.length + ' of ' + file.fieldname + ' arrived')
    },
    onFileUploadComplete: function(file, req, res) {
        var fileimage = file.name;
        req.middlewareStorage = {
            fileimage: fileimage
        }
    }
}));

app.use('/api/test', multer({
    dest: './uploads',
    limits: {
        fileSize: 2 * 1024 * 1024,
        fieldNameSize: 100,
        files: 2,
        fields: 5 // at most 1MB
    },
    onFileSizeLimit: function(file) {
        fs.unlinkSync('./uploads' + file.path); // delete the partially written file
        file.failed = true;
        res.json({
            uploadError: 'Upload failed. File must be less than 1 MB'
        });
    },
    rename: function(fieldname, filename) {
        // return fieldname + filename + Date.now()
        return filename.replace(/\W+/g, '-').toLowerCase() + Date.now();
    },
    onFileUploadStart: function(file) {
        // console.log(file.fieldname + ' is starting ...')
    },
    onFileUploadData: function(file, data) {
        // console.log(data.length + ' of ' + file.fieldname + ' arrived')
    },
    onFileUploadComplete: function(file, req, res) {
        var fileimage = file.name;
        req.middlewareStorage = {
            fileimage: fileimage
        }
    }
}));

app.post('/api/test', function(req, res) {
    var fileimage = req.middlewareStorage.fileimage;
    res.send(fileimage);
});
// /// USE MULTER UPDATE /////////////
app.post('/api/photo', function(req, res) {
    var fileimage = req.middlewareStorage.fileimage;
    res.json({
        success: true,
        data: fileimage
    });
});

///////////// LOGIN ROUTES //////////////////
app.post('/api/login', function(req, res) {
    User.findOne({
        username: req.body.username
    }).select("password").exec(function(err, users) {
        // if (err) throw err;
        if (!users) {
            res.send({
                message: "Authentication failed. User not found. "
            });
        } else if (users) {
            users.comparePassword(req.body.password, function(err, isMatch) {
                if (err) throw err;

                if (isMatch) {
                    var token = createToken(users);
                    // console.log(token);
                    res.json({
                        success: true,
                        message: "succesfully login!",
                        token: token
                    });
                } else {
                    res.json({
                        message: "invalid user and password!"
                    });
                }
            });
        }
    });
});

///////////// SIGN UP ROUTES //////////////////
app.post('/api/signup', function(req, res) {
    var users = new User({
        name: req.body.name,
        email: req.body.email,
        username: req.body.username,
        password: req.body.password,
        image: "user.jpg",
        role: "user",
        phone: "your phone",
        works: "work at",
        position: "your work position",
        about: "about you"
    });

    var token = createToken(users);
    users.save(function() {
        // if (err) {
        //     res.send(err);
        //     return;
        // }
        res.json({
            success: true,
            message: 'User has been created!',
            token: token
        });
    });
});


////////// PROVIDE TOKEN /////////////
app.use(function(req, res, next) {
    // console.log('some body come to our app');
    // console.log(crypt.decode(secretKey));
    var token = req.headers['x-access-token'];
    // var token = req.body.token || req.param('token') || req.headers['x-access-token'];

    if (token) {
        jsonwebtoken.verify(token, crypt.encode(secretKey), function(err, decoded) {
            if (err) {
                res.status(403).send({
                    success: false,
                    message: "Failed to authenticate user"
                });
            } else {
                req.decoded = decoded;
                next();
            }
        });
    } else {
        res.status(403).send({
            success: false,
            message: "No Token Provided"
        });
    }
});

/////////////////// ASSET CATEGORY //////////////////////
var assetCategoryRouter = require('./Routes/assetCategoryRoutes')(AssetCategory);
app.use('/api/assetcategory', assetCategoryRouter);

/////////////////// ASSET INSPECTION //////////////////////
var assetInspectionRouter = require('./Routes/assetInspectionRoutes')(AssetInspection);
app.use('/api/assetinspection', assetInspectionRouter);

/////////////////// ASSETS //////////////////////
var assetRouter = require('./Routes/assetRoutes')(Asset);
app.use('/api/assets', assetRouter);

/////////////////// USER GROUPS //////////////////////
var groupRouter = require('./Routes/groupRoutes')(Group);
app.use('/api/groups', groupRouter);

/////////////////// MENU //////////////////////
var menuRouter = require('./Routes/menuRoutes')(Menu);
app.use('/api/menus', menuRouter);


/////////////////// USER //////////////////////
var userRouter = require('./Routes/userRoutes')(User);
app.use('/api/users', userRouter);

app.get('/api/me', function(req, res) {
    User.findById(req.decoded, function(err, users) {
        if (err)
            res.status(500).send(err);
        else if (users) {
            res.send(users);
        } else {
            res.status(404).send('no asset found');
        }
    });
});

// /// USE MULTER MOBILE UPDATE /////////////
app.post('/api/photomobile', function(req, res) {
    var fileimage = req.middlewareStorage.fileimage;
    res.send(fileimage);
});

app.listen(config.port, function(err) {
    if (err)
        // console.log(err);

    console.log('connect app server api on  PORT: ' + config.port);
});


module.exports = app;
