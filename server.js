var express = require('express')
var cors = require('cors')
var bodyParser = require('body-parser')
var app = express()
const mongoose = require('mongoose')
const config = require('./config.json');
const port = process.env.NODE_ENV === 'production' ? (process.env.PORT || 80) : 4000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.set('view engine', 'hbs')
app.set('view engine', 'ejs');

app.use(cors())
app.use(
  bodyParser.urlencoded({
    extended: false
  })
)



const connectionOptions = { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: true };
mongoose.connect(process.env.MONGODB_URI || config.connectionString, connectionOptions);
mongoose.Promise = global.Promise;

var route = require('./routes/routing')

app.use('/', route)

app.listen(port, function() {
  console.log('Server is running on port: ' + port)
})