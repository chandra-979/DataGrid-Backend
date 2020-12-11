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
const nodemailer=require('nodemailer')
const User = require('../models/model')
const { ok } = require('assert');
const config = require('../config.json');

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


// Create mongo connection
const conn = mongoose.createConnection(process.env.MONGODB_URI || config.connectionString);

// Init gfs
let gfs;

conn.once('open', () => {
  // Init stream
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create storage engine
const storage = new GridFsStorage({
  url: process.env.MONGODB_URI || config.connectionString,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      crypto.randomBytes(16, (err, buf) => {
        if (err) {
          return reject(err);
        }
        const filename = buf.toString('hex') + path.extname(file.originalname);
        const fileInfo = {
          filename: filename,
          metadata:{userId:decoded._id,OriginalName:file.originalname},
          bucketName: 'uploads'
          
        };
        User.findByIdAndUpdate(decoded._id,
          {$push: {data: fileInfo}},
          {safe: true, upsert: true},
          function(err, doc) {
              if(err){
              console.log(err);
              }
          }
        );
        console.log(fileInfo)
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

users.post('/file',(req, res,) => {  

  let fileName = req.body.filename;  
  
    MongoClient.connect(process.env.MONGODB_URI || config.connectionString, function(err, client){
        if(err){      
          console.log(1)
         res.sendStatus(403)
             }    
    const db = client.db('Mydb');
    const collection = db.collection('uploads.files');    
    const collectionChunks = db.collection('uploads.chunks');
collection.find({filename: fileName}).toArray(function(err, docs){        
    if(err){        
      console.log(2)
      res.sendStatus(403)      
    }
  if(!docs || docs.length === 0){ 
    console.log(3)       
    res.send("no files found")     
   }else{
  
   //Retrieving the chunks from the db          
   collectionChunks.find({files_id : docs[0]._id})
     .sort({n: 1}).toArray(function(err, chunks){          
       if(err){            
          res.sendStatus(403)          
        }
      if(!chunks || chunks.length === 0){            
        //No data found            
        res.sendStatus(403)        
      }
    
    let fileData = [];          
    for(let i=0; i<chunks.length;i++){            
      //This is in Binary JSON or BSON format, which is stored               
      //in fileData array in base64 endocoded string format               
     
      fileData.push(chunks[i].data.toString('base64'));          
    }
    
     //Display the chunks using the data URI format          
     let finalFile = 'data:' + docs[0].contentType + ';base64,' 
          + fileData.join('');   
    res.json(finalFile)
     });      
    }          
   });  
 });
});

users.post("/update",(req,res)=>{

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
       
       User.update({_id:decoded._id},{$set:{first_name:req.body.first_name,last_name:req.body.last_name}},(err,resl)=>
       {
         if(err)
         res.sendStatus(403)
         console.log(resl);
         res.json({"message":"success"})
       })

     } else {
       res.sendStatus(403)
     }
   })
   .catch(err => {
     res.send('error: ' + err)
   })

})


users.post("/delete",(req,res)=>{
  if(req.headers.authorization.split(' ')[0]===null||req.headers.authorization.split(' ')[0]==='null'){
    res.json({error:'User does not exist'})
    return 
  }
 
var decoded = jwt.verify(req.headers.authorization.split(' ')[0], process.env.SECRET_KEY)

  MongoClient.connect(process.env.MONGODB_URI || config.connectionString, function(err, client){
        if(err){      
         res.sendStatus(403)
             } 

    const db = client.db('Mydb');
    const collection = db.collection('uploads.files');    
    const collectionChunks = db.collection('uploads.chunks');
collection.find({'metadata.OriginalName': req.body.filename}).toArray(function(err, docs){        
    if(err){        
      console.log(1)
      res.sendStatus(403)      
    }
  if(!docs || docs.length === 0){   
    console.log(2)     
    res.sendStatus(403)     
   }else{
  console.log(1)
   //Retrieving the chunks from the db          
   collectionChunks.findOneAndDelete({files_id : docs[0]._id},(err,result)=>{
     console.log(3)

    collection.findOneAndDelete({'metadata.OriginalName': req.body.filename});
    User.update({},{$pull:{'data':{'_id':req.body.id}}},(err,resu)=>{
      console.log(resu)
    });
    res.json("deletion success")

   })
           
    }          
   });  
 });

})


users.post("/remove",(req,res)=>{

  if(req.headers.authorization.split(' ')[0]===null||req.headers.authorization.split(' ')[0]==='null'){
    res.json({error:'User does not exist'})
    return 
  }
 
var decoded = jwt.verify(req.headers.authorization.split(' ')[0], process.env.SECRET_KEY)

MongoClient.connect(process.env.MONGODB_URI || config.connectionString, function(err, client){
  if(err){      
   res.sendStatus(403)
       } 

const db = client.db('Mydb');
const collection = db.collection('uploads.files');    
const collectionChunks = db.collection('uploads.chunks');
collection.find({'metadata.OriginalName': req.body.filename}).toArray(function(err, docs){        
if(err){        
console.log(1)
res.sendStatus(403)      
}
if(!docs || docs.length === 0){   
console.log(2)     
res.sendStatus(403)     
}else{
console.log(1)
User.update({},{$pull:{'data':{'_id':req.body.id}}},(err,resu)=>{
  console.log(resu)
});
res.json("deletion success")

}
})
})
});

users.post('/download', (req, res) => {
  // Check file exist on MongoDB
  mongoose.connect(process.env.MONGODB_URI || config.connectionString)
  Grid.mongo=mongoose.mongo
  var connection=mongoose.connection
  connection.on('error',console.error.bind(console,'connection error:'))
connection.once('open', () => {
  // Init stream
  gfs = Grid(connection.db);
  gfs.collection('uploads')
  var filename = req.body.filename;
gfs.files.findOne({ filename: filename }, (err, file) => {
  if (err || !file) {
      res.status(404).send('File Not Found');
return
  } 
let contentType=file.contentType;
var readstream = gfs.createReadStream({ filename: filename });
res.set('Content-Type', contentType)
res.set('Content-Disposition', 'attachment; filename="' + file.filename + '"');
readstream.on("error", function(err) { 
  res.end();
});
readstream.pipe(res) 
return ok("{}")
}); 
});
});

users.post('/forgotpassword', function(req, res) {

  console.log(req.body.email)
  
  let token = jwt.sign({Email: req.body.email},
      'chandra',
      { 
          expiresIn: '1h' 
      }
    );

  
   console.log('step 1')
   
      console.log('step 2')
      var smtpTrans = nodemailer.createTransport({
         service: 'Gmail', 
         auth: {
          user: 'chandra7799225680@gmail.com',
          pass: 'Chandra@2598'
        }
      });

      User.findOneAndUpdate({email:req.body.email},{$set:{token:token}},(err,result)=>{
        if(err)
        console.log('error occur in db')
        else if(!result)
        res.sendStatus(403)
        else{
          console.log(result)
        console.log("token set to user model")
        }
    
      })
    
      var mailOptions = {

        to: req.body.email,
        from: 'chandra7799225680@gmail.com',
        subject: 'Node.js Password Reset',
        text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
          'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
          'If you did not request this, please ignore this email and your password will remain unchanged.\n',
        html:'<p>Click on below link to reset Your password</p><br><a  href="http://localhost:4200/reset/'+token+'">Reset My Password</a>'
      };
      console.log('step 3')
      smtpTrans.sendMail(mailOptions, function(err) {
      res.json({"message":"email sent to ur mail"})
      console.log(' Email sent to Your mail')
      console.log(token)
});  
});
users.post('/resetpassword',(req,res)=>{
  let decoded=jwt.decode(req.body.resettoken,'chandra')
  User.find({email:decoded.Email},(err,result)=>{
    if(result[0].email===decoded.Email)
    {
      User.findOneAndUpdate({email:decoded.Email},{$set:{password:req.body.newPassword}},(err,result)=>{
        console.log(result)
      })
      res.json({"message":"Password reset successful"})
    }
    else{
      res.json({"message":"token expires or wrong"})
    }
  })
})
module.exports = users