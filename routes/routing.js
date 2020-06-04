const express = require('express')
const users = express.Router()
const path = require('path');
const cors = require('cors')
const jwt = require('jsonwebtoken')
const mongoose = require("mongoose")
const MongoClient = require('mongodb');
const multer = require('multer')
const GridFsStorage = require('multer-gridfs-storage')
const Grid = require('gridfs-stream')
const crypto = require('crypto')
const User = require('../models/model')

users.use(cors())
var id;

process.env.SECRET_KEY = 'secret'



users.post('/register', (req, res) => {
  const today = new Date()
  const userData = {
    first_name: req.body.first_name,
    last_name: req.body.last_name,
    email: req.body.email,
    password: req.body.password,
    created: today
  }

  User.findOne({
    email: req.body.email
  })
    //TODO bcrypt
    .then(user => {
      if (!user) {
        User.create(userData)
          .then(user => {
            const payload = {
              _id: user._id,
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email
            }
            let token = jwt.sign(payload, process.env.SECRET_KEY, {
              expiresIn: 1440
            })
            res.json({ token: token })
          })
          .catch(err => {
            res.send('error: ' + err)
          })
      } else {
        res.json({ error: 'User already exists' })
      }
    })
    .catch(err => {
      res.send('error: ' + err)
    })
})

users.post('/login', (req, res) => {
obj={email:req.body.email,password:req.body.password}
  User.findOne(obj)
    .then(user => {
      if (user) {
        const payload = {
          _id: user._id,
          first_name: user.first_name,
          last_name: user.last_name,
          email: user.email
          
        }
        let token = jwt.sign(payload, process.env.SECRET_KEY, {
          expiresIn: 1440
        })
        res.json({ token: token })
      } else {
        res.json({ error: 'User does not exist' })
      }
    })
    .catch(err => {
      res.send('error: ' + err)
    })
})

users.get('/profile',(req, res) => {
 
  if(req.headers.authorization.split(' ')[0]===null||req.headers.authorization.split(' ')[0]==='null'){
    res.json({error:'User does not exist'})
    return 
  }
  
  var decoded = jwt.verify(req.headers.authorization.split(' ')[0], process.env.SECRET_KEY)

  User.findOne({
   _id:decoded._id
  })
    .then(user => {
      if (user) {
        
        res.json(user)

      } else {
        res.send('User does not exist')
      }
    })
    .catch(err => {
      res.send('error: ' + err)
    })
})


users.post('/upload', (req, res) => {

  if(req.headers.authorization.split(' ')[0]===null||req.headers.authorization.split(' ')[0]==='null'){
    res.json({error:'User does not exist'})
    return 
  }
 
var decoded = jwt.verify(req.headers.authorization.split(' ')[0], process.env.SECRET_KEY)
const mongoURI = 'mongodb://localhost:27017/Mydb';

// Create mongo connection
const conn = mongoose.createConnection(mongoURI);

// Init gfs
let gfs;

conn.once('open', () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: mongoURI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          bucketName: 'uploads'
        };
        User.findByIdAndUpdate(decoded._id,
          {$push: {data: fileInfo}},
          {safe: true, upsert: true},
          function(err, doc) {
              if(err){
              console.log(err);
              }else{
              //do stuff
              console.log(doc)
              }
          }
        );
        resolve(fileInfo);
      });
    });
  }
});
const upload = multer({ storage }).single("file");
 upload(req,res, (err) => {
      if(err){
           res.json({error_code:1,err_desc:err});
           return;
      }     
  }); 
});

users.get("/files", (req, res) => {  
  
    MongoClient.connect('mongodb://localhost:27017', function(err, client){
        if(err){      
         return res.json( 
          {
          title: 'Uploaded Error', 
          message: 'MongoClient Connection error', error: err.errMsg}
          );    
          }    
    const db = client.db("Mydb"); 
    db.collection("users").find({email:"chandra@gmail.com"},{data:1}).toArray((err,doc)=>{
        console.log(doc[0].data.forEach((e)=>{
          console.log(e.filename)
        }))
    })
    const collection = db.collection('uploads.files');    
    const collectionChunks = db.collection('uploads.chunks');
    collection.find({}).toArray(function(err, docs){        
    if(err){        
      return res.render('index', {
       title: 'File error', 
       message: 'Error finding file', 
        error: err.errMsg});      
    }
  if(!docs || docs.length === 0){        
    return res.render('index', {
     title: 'Download Error', 
     message: 'No file found'});      
   }else{
  
   //Retrieving the chunks from the db          
   collectionChunks.find({})
     .sort({n: 1}).toArray(function(err, chunks){          
       if(err){            
          return res.render('index', {
           title: 'Download Error', 
           message: 'Error retrieving chunks', 
           error: err.errmsg});          
        }
      if(!chunks || chunks.length === 0){            
        //No data found            
        return res.render('index', {
           title: 'Download Error', 
           message: 'No data found'});          
      }
    
    let fileData = [];          
    for(let i=0; i<chunks.length;i++){            
      //This is in Binary JSON or BSON format, which is stored               
      //in fileData array in base64 endocoded string format               
     
      fileData.push(chunks[i].data.toString('base64'));          
    }
   
    f=[]
     //Display the chunks using the data URI format  
     docs.forEach((i)=>{   
           
     let finalFile = 'data:' + i.contentType + ';base64,' 
          + fileData.join('');          
      f.push(finalFile)
     
     })
    
    res.json(f)
     });      
    }          
   });  
 });
 
});

module.exports = users