const MongoClient = require('mongodb');
const url = "mongodb://localhost:27017/Mydb";
const dbName = "Mydb"; 

function fileData(res,userId){  
  
         MongoClient.connect(url, function(err, client){
          if(err){      
           res.json({"err":err})
          }       
      const db = client.db(dbName);
      const collection = db.collection('uploads.files');    
      const collectionChunks = db.collection('uploads.chunks');
  collection.find({'metadata.userId': userId}).toArray(function(err, docs){      
      if(err){        
        console.log("error in connection")   
      }
    if(!docs || docs.length === 0){        
      console.log("error in file length")
     }
     else{
       d=[]
       flag=0
for(k=0;k<docs.length;k++){
    if(flag===docs.length){
      console.log(d)
    res.json(d)
    }       
     collectionChunks.find({files_id : docs[k]._id})
       .sort({n: 1}).toArray((err,chunks)=>{
         
        if(err){            
          console.log("error in file data")         
          }
        if(!chunks || chunks.length === 0){            
          //No data found            
          console.log("error in finding data")         
        }
      
      let fileData = [];          
      for(let i=0; i<chunks.length;i++){            
        
        fileData.push(chunks[i].data.toString('base64'));          
      }
       //Display the chunks using the data URI format          
      //  let finalFile = 'data:' + docs[k].contentType + ';base64,' 
      //       + fileData.join('');
      let finalFile=fileData.join('')
            d.push(finalFile) 
            flag++;
 
       });
      }
     
      res.json(d)
      }          
     }); 
     

    
   });
  };

  module.exports.fileData=fileData
  